import type { SiteFleetRow } from '~~/layers/core/app/types'
import { createLogoutHandler } from '~~/layers/core/app/composables/auth'
import { useAsyncData } from '#imports'

/**
 * The `useAsyncData` key of the Team's Site roster. The dashboard layout, its
 * sidebar, and every page that lists Sites share this one entry, so a change
 * to the roster updates all of them at once.
 */
export const SITES_DATA_KEY = 'sites'

export async function fetchSites() {
  const toast = useToast()
  const { user } = useUserSession()
  const logout = createLogoutHandler()
  const fetchFn = useRequestFetch()
  return useAsyncData<{ sites: SiteFleetRow[] }>(SITES_DATA_KEY, async () => {
    return fetchFn(`/api/sites/list`, {
      query: {
        teamId: user.value?.currentTeamId,
      },
      async onResponseError(res) {
        if ([401].includes(res.response.status)) {
          await logout(true)
          toast.add({
            id: 'unauthorized-error',
            title: 'Oops, looks like session has expired.',
            description: 'Please login again to continue.',
            color: 'error',
          })
        }
        else { toast.add({ id: 'unauthorized-error', title: 'Error fetching Sites', description: res.error?.message, color: 'error' }) }
      },
    })
  }, {
    // The dashboard layout and most dashboard pages both call `fetchSites()`.
    // On the server, Nuxt runs the handler again for the second call, so every
    // signed-in render read the roster twice, one after the other: 1.6 to
    // 1.9 s each in production (Workers Logs, 2026-10-01). Within one server
    // render the roster cannot change, so the second call reuses the first
    // answer. The browser keeps Nuxt's default: hydration reuses the payload,
    // and a client navigation reads the roster again.
    getCachedData: (key, nuxtApp, ctx) => {
      if (import.meta.server && ctx.cause === 'initial')
        return nuxtApp.payload.data[key]
      if (nuxtApp.isHydrating)
        return nuxtApp.payload.data[key]
      if (ctx.cause !== 'refresh:manual' && ctx.cause !== 'refresh:hook')
        return nuxtApp.static.data[key]
      return undefined
    },
  })
}
