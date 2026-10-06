import type { GscdumpIntegration } from '../composables/useGscdumpIntegration'
// Hydrates and refreshes the dedicated gscdump integration state used by the
// v1 HTTP and realtime clients. See ADR-0002.

import { logWarn } from '~~/shared/logging'
import { $fetch } from '#imports'
import { GSCDUMP_INTEGRATION_KEY } from '../composables/useGscdumpIntegration'
import { isProAppPath } from '../utils/_is-pro-app-path'

function useClientIntegration() {
  const { data } = useNuxtData<GscdumpIntegration | null>(GSCDUMP_INTEGRATION_KEY)
  const error = useState<Error | null>(`${GSCDUMP_INTEGRATION_KEY}:error`, () => null)
  const status = useState<'idle' | 'pending' | 'success' | 'error'>(`${GSCDUMP_INTEGRATION_KEY}:status`, () => 'idle')

  async function refresh() {
    status.value = 'pending'
    error.value = null
    try {
      data.value = await $fetch<GscdumpIntegration | null>('/api/pro/gscdump-integration')
      status.value = 'success'
    }
    catch (err) {
      error.value = err instanceof Error ? err : new Error(String(err))
      status.value = 'error'
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
  setup() {
    const route = useRoute()
    let activated = false

    async function activate() {
      if (activated)
        return
      activated = true

      const { integration, refresh } = useClientIntegration()

      if (integration.value === null) {
        await refresh().catch(err => logWarn('gscdump.integration.probe_failed', err, { trigger: 'activate' }))
      }

      // Refresh on tab focus + every 5 min idle so webhook-triggered version
      // bumps land without an explicit user action.
      useEventListener(window, 'focus', () => {
        void refresh().catch(err => logWarn('gscdump.integration.probe_failed', err, { trigger: 'focus' }))
      })
      useIntervalFn(() => {
        void refresh().catch(err => logWarn('gscdump.integration.probe_failed', err, { trigger: 'interval' }))
      }, 5 * 60 * 1000)
    }

    if (isProAppPath(route.path)) {
      return activate()
    }
    const stop = watch(() => route.path, (path) => {
      if (isProAppPath(path)) {
        stop()
        void activate()
      }
    })
  },
})
