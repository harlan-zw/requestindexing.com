import type { GscdumpIntegration } from '../composables/useGscdumpIntegration'
// Hydrates and refreshes the dedicated gscdump integration state used by the
// v1 HTTP and realtime clients. See ADR-0002.

import { createSessionExpiredHandler } from '~~/layers/core/app/composables/auth'
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'
import { logWarn } from '~~/shared/logging'
import { errorStatusCode } from '~~/shared/sentry'
import { GSCDUMP_INTEGRATION_KEY } from '../composables/useGscdumpIntegration'
import { isProAppPath } from '../utils/_is-pro-app-path'

function useClientIntegration() {
  const { data } = useNuxtData<GscdumpIntegration | null>(GSCDUMP_INTEGRATION_KEY)
  const error = useState<Error | null>(`${GSCDUMP_INTEGRATION_KEY}:error`, () => null)
  const status = useState<'idle' | 'pending' | 'success' | 'error'>(`${GSCDUMP_INTEGRATION_KEY}:status`, () => 'idle')
  const refreshRevision = useState(`${GSCDUMP_INTEGRATION_KEY}:refresh-revision`, () => 0)
  const expireSession = createSessionExpiredHandler()
  let generation = 0
  let disposed = false
  let sessionExpired = false
  let expiring: Promise<void> | null = null
  onScopeDispose(() => {
    disposed = true
    generation++
  })

  async function refresh(recoverRealtime = true) {
    if (disposed)
      return
    if (expiring)
      return expiring
    const requestGeneration = ++generation
    const isCurrent = () => !disposed && requestGeneration === generation
    status.value = 'pending'
    error.value = null
    try {
      const next = await getAppFetch()<GscdumpIntegration | null>('/api/pro/gscdump-integration')
      if (!isCurrent())
        return
      data.value = next
      status.value = 'success'
      sessionExpired = false
      if (recoverRealtime)
        refreshRevision.value++
    }
    catch (err) {
      if (isCurrent()) {
        error.value = err instanceof Error ? err : new Error(String(err))
        status.value = 'error'
        // This endpoint authenticates the host session. An engine permission
        // error from the ticket proxy is not evidence that this session ended.
        if (errorStatusCode(err) === 401) {
          data.value = null
          if (!sessionExpired) {
            sessionExpired = true
            expiring = expireSession(isCurrent)
            try {
              await expiring
            }
            catch (expiryError) {
              if (isCurrent())
                sessionExpired = false
              throw expiryError
            }
            finally {
              expiring = null
            }
          }
        }
      }
      throw err
    }
  }

  if (data.value === undefined)
    data.value = null

  return { integration: data, refresh, error, status }
}

export default defineNuxtPlugin({
  name: 'pro-gscdump-auth',
  enforce: 'pre',
  async setup() {
    const route = useRoute()
    // Create within the plugin scope, before any activation request awaits.
    const { integration, refresh } = useClientIntegration()
    let activated = false

    async function activate() {
      if (activated)
        return
      activated = true

      // Refresh on tab focus + every 5 min idle so webhook-triggered version
      // bumps land without an explicit user action.
      useEventListener(window, 'focus', () => {
        void refresh().catch(err => logWarn('gscdump.integration.probe_failed', err, { trigger: 'focus' }))
      })
      useIntervalFn(() => {
        void refresh().catch(err => logWarn('gscdump.integration.probe_failed', err, { trigger: 'interval' }))
      }, 5 * 60 * 1000)

      if (integration.value === null) {
        await refresh().catch(err => logWarn('gscdump.integration.probe_failed', err, { trigger: 'activate' }))
      }
    }

    if (isProAppPath(route.path)) {
      await activate()
    }
    else {
      const stop = watch(() => route.path, (path) => {
        if (isProAppPath(path)) {
          stop()
          void activate()
        }
      })
    }
    return {
      provide: {
        // Ticket401 can originate from either host auth or an engine key.
        // Revalidate through the host read before choosing the login flow.
        // Verification alone must not re-arm a rejected engine credential.
        refreshGscdumpIntegration: () => refresh(false).catch(err => logWarn('gscdump.integration.probe_failed', err, { trigger: 'realtime' })),
      },
    }
  },
})
