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
  const { session, loggedIn } = useUserSession()
  const route = useRoute()
  const principal = computed(() => loggedIn.value && session.value?.user?.id != null ? String(session.value.user.id) : null)
  const principalRevision = ref(0)
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
    const requestPrincipal = principal.value
    if (requestPrincipal === null)
      return
    const requestGeneration = ++generation
    const isCurrent = () => !disposed && requestGeneration === generation && principal.value === requestPrincipal
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
      // Retired account reads cannot change the current session or publish errors.
      if (!isCurrent())
        return
      error.value = err instanceof Error ? err : new Error(String(err))
      status.value = 'error'
      // This endpoint authenticates the host session. An engine permission
      // error from the ticket proxy is not evidence that this session ended.
      if (errorStatusCode(err) === 401) {
        data.value = null
        if (!sessionExpired) {
          sessionExpired = true
          const expiryRevision = principalRevision.value
          const expiryPath = route.fullPath
          // Our clear retires the request too. Permit that single transition,
          // but never a later principal or the reader's own navigation.
          const ownsExpiry = () => !disposed && route.fullPath === expiryPath
            && ((principal.value === requestPrincipal && principalRevision.value === expiryRevision)
              || (principal.value === null && principalRevision.value === expiryRevision + 1))
          expiring = expireSession(ownsExpiry)
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
            if (!disposed && principalRevision.value !== expiryRevision && principal.value !== null)
              principalRevision.value++
          }
        }
      }
      throw err
    }
  }

  if (data.value === undefined)
    data.value = null

  watch(principal, () => {
    generation++
    data.value = null
    error.value = null
    status.value = 'idle'
    sessionExpired = false
    principalRevision.value++
  }, { flush: 'sync' })
  watch([principalRevision, () => isProAppPath(route.path)], () => {
    if (principal.value !== null && isProAppPath(route.path) && data.value === null && status.value !== 'pending')
      void refresh().catch(err => logWarn('gscdump.integration.probe_failed', err, { trigger: 'identity' }))
  })

  return { integration: data, refresh, error, status }
}

export default defineNuxtPlugin({
  name: 'pro-gscdump-auth',
  enforce: 'pre',
  setup() {
    const route = useRoute()
    // Create within the plugin scope, before any activation request awaits.
    const { integration, refresh, status } = useClientIntegration()
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

      if (integration.value === null && status.value !== 'pending') {
        await refresh().catch(err => logWarn('gscdump.integration.probe_failed', err, { trigger: 'activate' }))
      }
    }

    if (isProAppPath(route.path)) {
      // Analytics authenticate through their session proxy. Optional settings
      // must not hold the app mount or its first current-data read.
      void activate()
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
