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

// work around nuxt-auth-utils async context bug
export function createLogoutHandler() {
  const { session } = useUserSession()
  const toast = useToast()

  const nextTickFn = nextTick
  return async (force?: boolean) => {
    if (!force) {
      toast.add({ id: 'logout', title: 'See you next time!', description: 'You have logged out of the site.', color: 'success' })
      await navigateTo('/')
    }
    else {
      // A forced logout means the session expired under an existing account, so
      // the sign-in door is the right one. `/pro/onboarding` is for new ones.
      await navigateTo('/login')
    }
    await nextTickFn(() => {
      // can't access clear API here
      $fetch('/api/_auth/session', { method: 'DELETE' })
        .finally(() => {
          session.value = null
        })
    })
  }
}
