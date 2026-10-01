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
        else { toast.add({ id: 'unauthorized-error', title: 'Error fetching sites', description: res.error?.message, color: 'error' }) }
      },
    })
  })
}
