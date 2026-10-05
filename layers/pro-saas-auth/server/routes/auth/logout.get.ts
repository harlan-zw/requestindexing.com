import { getQuery, sendRedirect } from 'h3'
import { safeAuthRedirect } from '../../../shared/utils/auth-redirect'

// Static route takes precedence over the OAuth provider route.
export default defineEventHandler(async (event) => {
  const destination = safeAuthRedirect(getQuery(event).redirect) ?? '/'
  await clearUserSession(event)
  return sendRedirect(event, destination)
})
