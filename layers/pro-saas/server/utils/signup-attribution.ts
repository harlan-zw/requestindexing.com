import type { H3Event } from 'h3'
import { deleteCookie, getCookie, getHeader, getQuery, getRequestURL, setCookie } from 'h3'
import { captureSignupTouch, parseSignupTouchCookie, resolveSignupAttribution, SIGNUP_TOUCH_COOKIE } from '../../shared/signup-attribution'

export { SIGNUP_TOUCH_COOKIE } from '../../shared/signup-attribution'
export function readSignupAttribution(event: H3Event) {
  return resolveSignupAttribution(parseSignupTouchCookie(getCookie(event, SIGNUP_TOUCH_COOKIE)))
}
export function clearSignupAttribution(event: H3Event) {
  deleteCookie(event, SIGNUP_TOUCH_COOKIE, { path: '/' })
}
export function captureFirstSignupTouch(event: H3Event) {
  if (event.method !== 'GET' || parseSignupTouchCookie(getCookie(event, SIGNUP_TOUCH_COOKIE)))
    return
  const url = getRequestURL(event)
  const referrer = getHeader(event, 'referer')
  const now = Date.now()
  const previousUrl = referrer && URL.canParse(referrer) ? new URL(referrer) : null
  // A native signup click can arrive before a static landing hydrates.
  // Recover only bounded campaign fields from the exact same-origin page.
  const handoff = (url.pathname === '/login' || url.pathname.startsWith('/auth/')) && previousUrl?.origin === url.origin
    ? captureSignupTouch({ path: previousUrl.pathname, query: Object.fromEntries(previousUrl.searchParams), hostname: url.hostname, now })
    : null
  const touch = handoff?._tag === 'campaign' ? handoff : captureSignupTouch({ path: url.pathname, query: getQuery(event), referrer, hostname: url.hostname, now })
  if (touch)
    setCookie(event, SIGNUP_TOUCH_COOKIE, JSON.stringify(touch), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60, secure: !import.meta.dev })
}
