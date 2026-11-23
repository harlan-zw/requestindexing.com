import type { MockInstance } from 'vitest'
import { provideProShellOnboardingSteps } from '@nuxtseo/pro-shell/app/composables/useProShellOnboarding'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, onMounted, onScopeDispose, ref, Suspense, watch } from 'vue'
import { FIRST_RUN_STEPS } from '#layers/pro-saas/shared/onboarding'

// The page runs on `@nuxtseo/pro-shell`'s real flow and frame. Only the Nuxt
// seams they read are stood in for: the route and the app config with this
// app's copy. The host provides the steps a plugin registers in the app.
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
vi.mock('#components', () => {
  const passthrough = defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) })
  // The frame's Next: a button that reports its label and disabled state.
  const nav = defineComponent({
    props: ['nextLabel', 'nextDisabled'],
    setup: props => () => h('button', { disabled: props.nextDisabled }, props.nextLabel),
  })
  return { UiCard: passthrough, UiSkeleton: passthrough, UiWizardProgress: defineComponent({ render: () => null }), UiWizardNav: nav }
})

vi.mock('~~/layers/core/app/composables/fetch', () => ({
  fetchSites: async () => ({ data: ref({ sites: [{ siteId: 'ri_1', domain: 'example.com', property: 'sc-domain:example.com', syncStatus: 'synced' }] }) }),
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
  const app = createApp({
    setup() {
      provideProShellOnboardingSteps(FIRST_RUN_STEPS)
      return () => h(Suspense, null, { default: () => h(Onboarding) })
    },
  })
  for (const name of ['ProAlert', 'ProGscScopeMissingAlert', 'ProGscConnectReturnAlert', 'ULink', 'UIcon', 'UFormField', 'USelect', 'UiStatusBadge', 'ProSiteAddForm', 'ProSetupExample', 'ProSetupExitFeedback', 'ProOnboardingAnswers'])
    app.component(name, defineComponent({ render: () => null }))
  app.component('UiWizardProgress', defineComponent({ render: () => null }))
  // The Connect action is the step's only way forward, so the stub keeps its
  // test id and link for the assertions below.
  app.component('UButton', defineComponent({
    props: ['to', 'label'],
    setup: (props, { attrs }) => () => props.to ? h('a', { 'href': props.to, 'data-testid': attrs['data-testid'] }, props.label) : null,
  }))
  app.component('UiAuthHeading', defineComponent({
    props: ['title', 'description'],
    setup: props => () => h('div', [h('h1', props.title), h('p', props.description)]),
  }))
  app.component('UiWizardNav', defineComponent({
    props: { nextLabel: String, nextDisabled: Boolean, skipLabel: String, showNext: { type: Boolean, default: true } },
    setup: props => () => h('div', [
      props.skipLabel ? h('button', { 'data-testid': 'step-skip' }, props.skipLabel) : null,
      props.showNext ? h('button', { 'disabled': props.nextDisabled, 'data-testid': 'step-next' }, props.nextLabel) : null,
    ]),
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
  expect(host.textContent).toContain('Open the dashboard to see what Google has reported about your Sites.')
  expect(host.querySelector('[data-testid="first-site-report"]')).not.toBeNull()
  expect(host.textContent).not.toContain('First sync started')
  expect(host.textContent).not.toContain('pulling your Search Console history now')
  expect(host.querySelector('button')?.disabled).toBe(false)
})

it('offers recovery instead of setup success when a bookmarked final step has no Site', async () => {
  session.value = { hasSites: false, gscdumpConnected: true }
  const host = await mount()
  await nextTick()
  expect(host.textContent).toContain('Connect a Site to finish setup')
  expect(host.querySelector('button')?.disabled).toBe(true)
})

it('offers no Skip on Connect Google, so a new account can only connect', async () => {
  route.query = { step: 'connect' }
  session.value = { hasSites: false, gscdumpConnected: false }
  const host = await mount()
  expect(host.querySelector('[data-testid="connect-gsc-btn"]')?.getAttribute('href'))
    .toBe('/auth/integrations/gsc/connect?scope=read&returnTo=%2Fpro%2Fdashboard%2Fonboarding%3Fstep%3Dsites')
  expect(host.querySelector('[data-testid="step-skip"]')).toBeNull()
  expect(host.querySelector('[data-testid="step-next"]')).toBeNull()
  route.query = { step: 'sync' }
})

it('offers Continue on Connect Google once Google is connected, still with no Skip', async () => {
  route.query = { step: 'connect' }
  session.value = { hasSites: false, gscdumpConnected: true }
  const host = await mount()
  expect(host.querySelector('[data-testid="step-skip"]')).toBeNull()
  expect(host.querySelector('[data-testid="step-next"]')).not.toBeNull()
  route.query = { step: 'sync' }
})
