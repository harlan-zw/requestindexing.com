import { afterEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'
import { parseSignupTouchCookie } from '../../shared/signup-attribution'
import plugin from './signup-attribution.client'

const harness = vi.hoisted(() => ({ cookie: undefined as unknown, route: undefined as unknown }))
vi.mock('#imports', () => ({
  defineNuxtPlugin: (setup: unknown) => setup,
  useCookie: () => harness.cookie,
  useRoute: () => harness.route,
}))
const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
  vi.unstubAllGlobals()
})

it('captures a static landing before OAuth and keeps its first source across client navigation', async () => {
  const cookie = ref<string | null>(null)
  const route = reactive({ path: '/tools/google-indexing-checker', fullPath: '/tools/google-indexing-checker?utm_source=Docs', query: { utm_source: 'Docs', url: 'https://private.example/selected' } })
  harness.cookie = cookie
  harness.route = route
  vi.stubGlobal('location', { hostname: 'requestindexing.com', protocol: 'https:' })
  vi.stubGlobal('document', { referrer: 'https://search.example/private?token=secret' })
  const scope = effectScope()
  scopes.push(scope)
  await scope.run(() => plugin({} as never))
  await nextTick()
  expect(parseSignupTouchCookie(cookie.value ?? undefined)).toMatchObject({ _tag: 'campaign', utmSource: 'docs', landingPath: '/tools', referrerDomain: 'search.example' })
  expect(cookie.value).not.toContain('private')
  route.path = '/login'
  route.fullPath = '/login?utm_source=Later'
  route.query.utm_source = 'Later'
  await nextTick()
  expect(parseSignupTouchCookie(cookie.value ?? undefined)).toMatchObject({ utmSource: 'docs' })
})
