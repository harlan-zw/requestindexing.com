import type { ComputedRef } from 'vue'
import type { UserSelect } from '#shared/types/database'

export function useAuthenticatedUser() {
  const { loggedIn, user } = useUserSession()
  if (!loggedIn) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized',
    })
  }
  return user as unknown as ComputedRef<UserSelect>
}

/**
 * Sends the user back to login after `readSessionScoped` reports an expired
 * session. Every page that loads session-scoped data ends that state the same
 * way, so the redirect lives here instead of in each page.
 */
export function createSessionExpiredHandler() {
  const { clear } = useUserSession()
  const route = useRoute()
  return async () => {
    await clear()
    await navigateTo({ path: '/login', query: { redirect: route.fullPath } })
  }
}

export function createLogoutHandler() {
  const { clear } = useUserSession()
  const toast = useToast()

  return async (force?: boolean) => {
    await clear()
    if (!force) {
      await navigateTo('/')
      toast.add({ id: 'logout', title: 'See you next time!', description: 'You have logged out of the site.', color: 'success' })
    }
    else {
      // A forced logout means the session expired under an existing account, so
      // the sign-in door is the right one. `/pro/onboarding` is for new ones.
      await navigateTo('/login')
    }
  }
}
