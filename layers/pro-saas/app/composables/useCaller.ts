// useCaller: client seam for user context. Hydrated from SSR payload via the
// useFetch key.
// See CONTEXT.md and docs/adr/0002-caller-is-the-user-context-seam.md.

import type { Caller } from '../../shared/caller'
import { logWarn } from '~~/shared/logging'

const FETCH_KEY = 'app:caller'
const LOGIN_PATH = '/login'

function isProLoginPath(path: string): boolean {
  return path === LOGIN_PATH || path.startsWith(`${LOGIN_PATH}/`) || path.startsWith(`${LOGIN_PATH}?`)
}

function isProSessionRoute(path: string): boolean {
  return path.startsWith('/pro/dashboard')
}

function loginRedirectFor(fullPath: string): string {
  if (!isProSessionRoute(fullPath) || isProLoginPath(fullPath))
    return LOGIN_PATH
  return `${LOGIN_PATH}?redirect=${encodeURIComponent(fullPath)}`
}

function shouldRedirectToLogin(path: string): boolean {
  return isProSessionRoute(path) && !isProLoginPath(path)
}

export function useCaller() {
  const route = useRoute()
  const nuxtApp = useNuxtApp()
  const { loggedIn } = useSession()
  const enabled = computed(() => loggedIn.value && isProSessionRoute(route.path))
  const initiallyEnabled = enabled.value

  const { data, refresh, error, status } = useFetch<Caller | null>('/api/pro/caller', {
    key: FETCH_KEY,
    server: true,
    deep: false,
    immediate: initiallyEnabled,
    getCachedData: (key, nuxtApp, context) => context.cause === 'initial'
      ? nuxtApp.payload.data[key] ?? nuxtApp.static.data[key]
      : undefined,
    onResponseError: ({ response }) => {
      if (response?.status !== 401 || !import.meta.client)
        return
      const currentPath = nuxtApp._route?.path ?? route.path
      const currentFull = nuxtApp._route?.fullPath ?? route.fullPath
      if (shouldRedirectToLogin(currentPath))
        nuxtApp.runWithContext(() => navigateTo(loginRedirectFor(currentFull)))
    },
  })

  // Fire once when navigating into a pro route from a non-pro / auth route.
  if (import.meta.client) {
    watch(enabled, (now, prev) => {
      if (now && !prev && data.value == null && status.value !== 'pending')
        refresh()
    })
  }

  return {
    caller: data,
    refresh,
    error,
    status,
    user: computed(() => data.value?.user ?? null),
    memberships: computed(() => data.value?.memberships ?? []),
    isAdmin: computed(() => !!data.value?.isAdmin),
  }
}

/**
 * Imperative refresh — call after a server-side mutation that affected the
 * caller (role flip, team rename).
 */
export async function useRefreshCaller(): Promise<void> {
  await refreshNuxtData(FETCH_KEY).catch(err => logWarn('auth.optional_probe_failed', err, { probe: 'refreshCaller' }))
}
