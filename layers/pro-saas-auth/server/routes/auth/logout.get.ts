import { defineHandler, getQuery, sendRedirect } from 'nuxt/server'
import { safeAuthRedirect } from '../../../shared/utils/auth-redirect'

// Static route takes precedence over the OAuth provider route.
export default defineHandler(async (event) => {
  const destination = safeAuthRedirect(getQuery(event).redirect) ?? '/'
  await clearUserSession(event)
  return sendRedirect(event, destination)
})
