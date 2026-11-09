import type { SignupTouch } from '../../shared/signup-attribution'
import { afterEach, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive, ref } from 'vue'
import plugin from './signup-attribution.client'

const harness = vi.hoisted(() => ({ cookie: undefined as unknown, route: undefined as unknown, rawCookie: undefined as string | undefined }))
vi.mock('#imports', () => ({
  defineNuxtPlugin: (setup: unknown) => setup,
  useCookie: (_name: string, options: { decode: (raw: string) => unknown }) => {
    if (harness.rawCookie)
      (harness.cookie as { value: unknown }).value = options.decode(harness.rawCookie)
    return harness.cookie
  },
  useRoute: () => harness.route,
}))
const scopes: ReturnType<typeof effectScope>[] = []
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
  harness.rawCookie = undefined
  vi.unstubAllGlobals()
})

it('recovers a malformed URI cookie without stopping static-page initialization', async () => {
  const cookie = ref(null)
  harness.cookie = cookie
  harness.rawCookie = '%E0%A4%A'
  harness.route = reactive({ path: '/', fullPath: '/?utm_source=Docs', query: { utm_source: 'Docs' } })
  vi.stubGlobal('location', { hostname: 'requestindexing.com', protocol: 'https:' })
  vi.stubGlobal('document', { referrer: '' })
  const scope = effectScope()
  scopes.push(scope)
  await scope.run(() => plugin({} as never))
  await nextTick()
  expect(cookie.value).toMatchObject({ _tag: 'campaign', utmSource: 'docs' })
})

it('captures a static landing before OAuth and keeps its first source across client navigation', async () => {
  const cookie = ref<SignupTouch | null>(null)
  const route = reactive({ path: '/tools/google-indexing-checker', fullPath: '/tools/google-indexing-checker?utm_source=Docs', query: { utm_source: 'Docs', url: 'https://private.example/selected' } })
  harness.cookie = cookie
  harness.route = route
  vi.stubGlobal('location', { hostname: 'requestindexing.com', protocol: 'https:' })
  vi.stubGlobal('document', { referrer: 'https://search.example/private?token=secret' })
  const scope = effectScope()
  scopes.push(scope)
  await scope.run(() => plugin({} as never))
  await nextTick()
  expect(cookie.value).toMatchObject({ _tag: 'campaign', utmSource: 'docs', landingPath: '/tools', referrerDomain: 'search.example' })
  expect(JSON.stringify(cookie.value)).not.toContain('private')
  route.path = '/login'
  route.fullPath = '/login?utm_source=Later'
  route.query.utm_source = 'Later'
  await nextTick()
  expect(cookie.value).toMatchObject({ utmSource: 'docs' })
})
