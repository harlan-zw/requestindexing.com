import { watch } from 'vue'
import { defineNuxtPlugin, useCookie, useRoute } from '#imports'
import { captureSignupTouch, parseSignupTouchCookie, SIGNUP_TOUCH_COOKIE } from '../../shared/signup-attribution'

export default defineNuxtPlugin(() => {
  const route = useRoute()
  // Prerendered assets bypass server middleware. Capture before navigation;
  // the auth boundary still parses this untrusted, bounded cookie.
  const cookie = useCookie<string | null>(SIGNUP_TOUCH_COOKIE, {
    maxAge: 30 * 24 * 60 * 60,
    sameSite: 'lax',
    path: '/',
    secure: location.protocol === 'https:',
    encode: value => encodeURIComponent(value ?? ''),
    decode: value => decodeURIComponent(value ?? ''),
  })
  watch(() => route.fullPath, () => {
    if (parseSignupTouchCookie(cookie.value ?? undefined))
      return
    const touch = captureSignupTouch({ path: route.path, query: route.query, referrer: document.referrer, hostname: location.hostname, now: Date.now() })
    if (touch)
      cookie.value = JSON.stringify(touch)
  }, { immediate: true })
})
