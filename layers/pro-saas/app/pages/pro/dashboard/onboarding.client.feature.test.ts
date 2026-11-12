import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, createApp, defineComponent, h, nextTick, onMounted, onScopeDispose, ref, Suspense, watch } from 'vue'

// The page runs on `@nuxtseo/pro-shell`'s real flow and frame. Only the Nuxt
// seams they read are stood in for: the route, the app config with this app's
// copy, and the Step registry, which a plugin fills in the app.
const route = vi.hoisted(() => ({ query: { step: 'sync' } as Record<string, string> }))
vi.mock('nuxt/app', async () => {
  const { PRO_SHELL_COPY_OVERRIDES } = await import('../../../pro-shell')
  return {
    tryUseNuxtApp: () => ({}),
    useRoute: () => route,
    useRouter: () => ({ replace: vi.fn() }),
    useAppConfig: () => ({ proShell: { copy: PRO_SHELL_COPY_OVERRIDES } }),
  }
})
vi.mock('@nuxtseo/pro-shell/app/composables/useProShellOnboarding', async (original) => {
  const { FIRST_RUN_STEPS } = await import('#layers/pro-saas/shared/onboarding')
  return {
    ...await original<typeof import('@nuxtseo/pro-shell/app/composables/useProShellOnboarding')>(),
    useProShellOnboardingSteps: () => computed(() => FIRST_RUN_STEPS),
  }
})
vi.mock('#components', () => {
  const passthrough = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
  return { UiCard: passthrough, UiSkeleton: passthrough, UiWizardProgress: defineComponent({ render: () => null }), UiWizardNav: passthrough }
})

vi.mock('~~/layers/core/app/composables/fetch', () => ({
  fetchSites: async () => ({ data: ref({ sites: [{ siteId: 'ri_1' }] }) }),
}))

const session = ref({ hasSites: true, gscdumpConnected: true })
Object.assign(globalThis, {
  onMounted,
  onScopeDispose,
  watch,
  useFetch: () => ({ data: ref({ _tag: 'Missing' }) }),
  definePageMeta: () => {},
  useRoute: () => route,
  useToast: () => ({ add: vi.fn() }),
  useUserSession: () => ({ session, fetch: vi.fn() }),
  useRobotsRule: () => {},
  useSeoMeta: () => {},
})

const { default: Onboarding } = await import('./onboarding.vue')
const apps: ReturnType<typeof createApp>[] = []

async function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp({ render: () => h(Suspense, null, { default: () => h(Onboarding) }) })
  for (const name of ['ProAlert', 'ProGscScopeMissingAlert', 'UIcon', 'UButton', 'ProSiteAddForm', 'ProSetupExample', 'ProSetupExitFeedback', 'ProOnboardingAnswers'])
    app.component(name, defineComponent({ render: () => null }))
  app.component('UiWizardProgress', defineComponent({ render: () => null }))
  app.component('UiAuthHeading', defineComponent({
    props: ['title', 'description'],
    setup: props => () => h('div', [h('h1', props.title), h('p', props.description)]),
  }))
  app.component('UiWizardNav', defineComponent({
    props: ['nextLabel', 'nextDisabled'],
    setup: props => () => h('button', { disabled: props.nextDisabled }, props.nextLabel),
  }))
  app.mount(host)
  apps.push(app)
  for (let index = 0; index < 12; index++) {
    await Promise.resolve()
    await nextTick()
  }
  return host
}

let warnings: MockInstance<typeof console.warn>
beforeEach(() => {
  warnings = vi.spyOn(console, 'warn')
})
afterEach(() => {
  const renderWarnings = warnings.mock.calls.map(([message]) => String(message)).filter(message => /Failed to resolve component|no <Suspense> boundary/.test(message))
  warnings.mockRestore()
  expect(renderWarnings).toEqual([])
})

afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  document.body.innerHTML = ''
})

it('resumes a connected account without claiming a new sync', async () => {
  session.value = { hasSites: true, gscdumpConnected: true }
  const host = await mount()
  await nextTick()
  expect(host.textContent).toContain('indexing evidence for your connected Sites')
  expect(host.querySelector('[data-testid="first-site-report"]')).not.toBeNull()
  expect(host.textContent).not.toContain('First sync started')
  expect(host.textContent).not.toContain('pulling your Search Console history now')
})

it('offers recovery instead of setup success when a bookmarked final step has no Site', async () => {
  session.value = { hasSites: false, gscdumpConnected: true }
  const host = await mount()
  await nextTick()
  expect(host.textContent).toContain('Connect a Site to finish setup')
  expect(host.querySelector('button')?.disabled).toBe(true)
})
