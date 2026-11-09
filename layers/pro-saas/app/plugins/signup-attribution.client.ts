import type { SignupTouch } from '../../shared/signup-attribution'
import { watch } from 'vue'
import { defineNuxtPlugin, useCookie, useRoute } from '#imports'
import { captureSignupTouch, parseSignupTouchCookie, SIGNUP_TOUCH_COOKIE } from '../../shared/signup-attribution'

export default defineNuxtPlugin(() => {
  const route = useRoute()
  // Prerendered assets bypass server middleware. Capture before navigation;
  // the auth boundary still parses this untrusted, bounded cookie.
  const cookie = useCookie<SignupTouch | null>(SIGNUP_TOUCH_COOKIE, {
    maxAge: 30 * 24 * 60 * 60,
    sameSite: 'lax',
    path: '/',
    secure: location.protocol === 'https:',
    encode: value => encodeURIComponent(JSON.stringify(value ?? null)),
    decode: parseSignupTouchCookie,
  })
  watch(() => route.fullPath, () => {
    if (cookie.value)
      return
    const touch = captureSignupTouch({ path: route.path, query: route.query, referrer: document.referrer, hostname: location.hostname, now: Date.now() })
    if (touch)
      cookie.value = touch
  }, { immediate: true })
})
