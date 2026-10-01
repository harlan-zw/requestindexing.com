// Opens a WebSocket to gscdump.com once pro auth resolves and translates
// sync/enrichment events into per-site invalidation bumps, so mounted
// `useGscQuery` instances re-fetch without a page reload.
//
// Auth + lifecycle:
// - Waits for `useGscdumpIntegration()` to report `connected`. Without it, no
//   connection is opened (anonymous / unconnected user state). The client
//   never holds a gscdump API key: it authenticates same-origin through the
//   v1 proxy, which resolves the caller's stored credential server-side,
//   including for minting the realtime ticket.
// - Connects only on /pro/dashboard/* routes; the gscdump-auth plugin already
//   gates activation behind the same predicate.
// - Closes the socket on tab unload. We do NOT close on route change off the
//   dashboard — re-entering is common and reconnect cost > keep-alive cost.
// - Keeps the resume cursor in localStorage per account, as nuxtseo.com does.
//   With the SDK's in-memory default, every full page load had no cursor, so
//   the SDK asked for a resync and `refreshNuxtData()` re-read the whole page.
//
// Event handling:
// - `sync.site_complete` / `sync.complete` / `enrichment.complete` →
//   `bumpGscInvalidation(siteId)` so per-site queries refresh.
// - `sync.progress` is high-volume and informational only; ignored here
//   (consumed by `ProGscStatus` polling already).
// - `sync.failed`, `job.failed`, `auth.failed`, `needs_reauth` → telemetry
//   only; the dashboard surfaces these through other channels.

import type { RealtimeV1Event } from '@gscdump/contracts/v1'
import type { GscdumpRealtimeV1Client } from '@gscdump/sdk/v1'
import type { GscdumpIntegration } from '../composables/useGscdumpIntegration'
import type { CursorStorage } from '../internal/gscdump-realtime-cursor'
import { createRealtimeV1Schemas } from '@gscdump/contracts/v1/realtime'
import { createGscdumpRealtimeV1Client, createGscdumpV1Client } from '@gscdump/sdk/v1'
import { logWarn } from '~~/shared/logging'
import { GSCDUMP_INTEGRATION_KEY } from '../composables/useGscdumpIntegration'
import { bumpGscInvalidation } from '../internal/composables/useGscInvalidation'
import { createGscdumpCursorStore } from '../internal/gscdump-realtime-cursor'
import { isProAppPath } from '../utils/_is-pro-app-path'

// Reading `window.localStorage` itself throws where the browser blocks site
// data. Each call goes through here, so the cursor store's own guard covers it.
const lazyLocalStorage: CursorStorage = {
  getItem: key => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: key => localStorage.removeItem(key),
}

export default defineNuxtPlugin({
  name: 'pro-gscdump-realtime',
  // Run after `00.gscdump-auth.client.ts` so the integration state is hydrated.
  dependsOn: ['pro-gscdump-auth'],
  setup() {
    const route = useRoute()
    let activated = false
    let stopWatch: (() => void) | null = null
    let realtime: GscdumpRealtimeV1Client | null = null

    function invalidateAffectedSites(event: RealtimeV1Event): void {
      if (event.name === 'site.lifecycle.progress')
        return

      const siteIds = new Set(
        event.changes
          .filter(change => change.type === 'site')
          .map(change => change.id),
      )
      if (event.subject.type === 'site')
        siteIds.add(event.subject.id)

      for (const siteId of siteIds)
        bumpGscInvalidation(siteId)
    }

    function activate(): void {
      if (activated)
        return
      activated = true

      const integration = useNuxtData<GscdumpIntegration | null>(GSCDUMP_INTEGRATION_KEY).data
      const { user } = useUserSession()

      stopWatch = watch(
        () => integration.value?.connected ?? false,
        (connected) => {
          if (realtime) {
            realtime.stop()
            realtime = null
          }
          if (!connected)
            return

          // Session-proxied: the browser never holds a gscdump API key. The
          // proxy resolves the caller's stored credential server-side and
          // mints the realtime ticket on their behalf.
          const http = createGscdumpV1Client({
            apiRoot: '/api/_gscdump',
            credential: 'session-proxy',
            fetch: (request, init) => {
              const headers = new Headers(init?.headers)
              headers.delete('authorization')
              return fetch(request, { ...init, headers })
            },
          })
          const userId = user.value?.id
          const client = createGscdumpRealtimeV1Client({
            // Without a signed-in id there is no account to key the cursor
            // by, so the SDK keeps it in memory for this page load only.
            ...(userId != null && {
              cursorStore: createGscdumpCursorStore(createRealtimeV1Schemas(), String(userId), lazyLocalStorage),
            }),
            // The body is empty on purpose. A ticket's origin is host policy,
            // so the proxy substitutes its own request origin; sending one from
            // the browser is rejected as an unexpected body and the ticket
            // never minted. Same call shape as nuxtseo.com.
            ticketProvider: () => http.createRealtimeTicket({ body: {} }),
            applyEvent: async event => invalidateAffectedSites(event),
            resync: async () => refreshNuxtData(),
            onObservation: (observation) => {
              if (observation.type === 'error')
                logWarn('gscdump.integration.probe_failed', observation.error, { source: 'realtime' })
            },
          })
          realtime = client
          void client.start().catch((err) => {
            logWarn('gscdump.integration.probe_failed', err, { source: 'realtime', stage: 'connect' })
            if (realtime === client) {
              client.stop()
              realtime = null
            }
          })
        },
        { immediate: true },
      )

      useEventListener(window, 'beforeunload', () => {
        realtime?.stop()
        realtime = null
      })
    }

    if (isProAppPath(route.path)) {
      activate()
      return
    }
    const stop = watch(() => route.path, (path) => {
      if (isProAppPath(path)) {
        stop()
        activate()
      }
    })

    onScopeDispose(() => {
      stopWatch?.()
      realtime?.stop()
      realtime = null
    })
  },
})
