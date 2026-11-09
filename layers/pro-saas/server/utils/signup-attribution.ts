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
  const touch = captureSignupTouch({ path: url.pathname, query: getQuery(event), referrer: getHeader(event, 'referer'), hostname: url.hostname, now: Date.now() })
  if (touch)
    setCookie(event, SIGNUP_TOUCH_COOKIE, JSON.stringify(touch), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60, secure: !import.meta.dev })
}
