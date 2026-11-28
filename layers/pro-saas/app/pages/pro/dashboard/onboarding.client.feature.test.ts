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
const appFetchMock = vi.hoisted(() => vi.fn(async () => ({ _tag: 'Collecting', phase: 'discovering' })))
// The First Site report's saved read. A new Site is still being inspected.
vi.mock('~~/layers/core/app/utils/app-fetch', () => ({
  getAppFetch: () => appFetchMock,
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
const { default: ProOnboardingAgentStep } = await import('../../../components/pro/ProOnboardingAgentStep.vue')
const { default: ProGscConsentPreview } = await import('../../../components/pro/ProGscConsentPreview.vue')
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
  for (const name of ['ProAlert', 'ProGscScopeMissingAlert', 'ProGscConnectReturnAlert', 'ULink', 'UIcon', 'UiIcon', 'UAvatar', 'UFormField', 'USelect', 'UiStatusBadge', 'UiFavicon', 'ProSiteAddForm', 'ProSetupExample', 'ProSetupExitFeedback', 'ProOnboardingAnswers'])
    app.component(name, defineComponent({ render: () => null }))
  app.component('UiWizardProgress', defineComponent({ render: () => null }))
  app.component('ProOnboardingAgentStep', ProOnboardingAgentStep)
  app.component('ProGscConsentPreview', ProGscConsentPreview)
  // Each action reports its purpose, so a test can count the solid buttons.
  app.component('UiCopyButton', defineComponent({ props: ['label', 'purpose'], setup: props => () => h('button', { 'data-testid': 'copy-setup-prompt', 'data-purpose': props.purpose }, props.label) }))
  app.component('UiButton', defineComponent({ props: ['to', 'label', 'purpose'], setup: (props, { attrs }) => () => props.to ? h('a', { 'href': props.to, 'data-purpose': props.purpose }, props.label) : h('button', { 'type': 'button', 'data-testid': attrs['data-testid'], 'data-purpose': props.purpose, 'onClick': attrs.onClick as () => void }, props.label) }))
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
    props: { nextLabel: String, nextDisabled: Boolean, skipLabel: String, showNext: { type: Boolean, default: true }, nextPurpose: { type: String, default: 'cta' } },
    emits: ['next', 'skip', 'back'],
    setup: (props, { emit }) => () => h('div', [
      props.skipLabel ? h('button', { 'data-testid': 'step-skip', 'onClick': () => emit('skip') }, props.skipLabel) : null,
      props.showNext ? h('button', { 'disabled': props.nextDisabled, 'data-testid': 'step-next', 'data-purpose': props.nextPurpose, 'onClick': () => emit('next') }, props.nextLabel) : null,
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

it('opens the last step on the First Site report, with no setup claim before a result', async () => {
  session.value = { hasSites: true, gscdumpConnected: true }
  const host = await mount()
  await nextTick()
  expect(host.querySelector('h1')?.textContent).toBe('Check which pages Google indexed')
  expect(host.textContent).not.toContain('You\'re set up')
  expect(host.querySelector('[data-testid="first-site-report"]')?.textContent).toContain('Finding URLs to inspect')
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
  // The last step's guide describes the report, so it waits for a Site.
  expect(host.querySelector('[data-step-guide]')).toBeNull()
})

it.each([
  ['agent', 'Why start with an agent'],
  ['connect', 'Why connect Google'],
  ['sites', 'What a Site is'],
  ['sync', 'Saved verdicts come first'],
])('shows the %s step guide beside the step, named by its heading', async (step, heading) => {
  route.query = { step }
  session.value = { hasSites: true, gscdumpConnected: true }
  const host = await mount()
  await nextTick()
  const guides = host.querySelectorAll('[data-step-guide]')
  expect(guides).toHaveLength(1)
  const title = guides[0]!.querySelector('h2')
  expect(title?.textContent?.trim()).toBe(heading)
  expect(guides[0]!.getAttribute('aria-labelledby')).toBe(title?.id)
  route.query = { step: 'sync' }
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

it('previews the Google consent before Connect Google, with the signed-in Google account', async () => {
  route.query = { step: 'connect' }
  session.value = { hasSites: false, gscdumpConnected: false, user: { id: 1, authProvider: 'google', email: 'ada@example.com', name: 'Ada', avatarUrl: null } } as typeof session.value
  const host = await mount()
  const preview = host.querySelector('[data-testid="gsc-consent-preview"]')
  expect(preview?.textContent).toContain('View Search Console data for your verified sites')
  expect(host.querySelector('[data-testid="gsc-consent-account"]')?.textContent).toContain('ada@example.com')
  // The access facts moved into the preview and the step guide: no disclosure rows.
  expect(host.querySelector('[data-testid="gsc-access"]')).toBeNull()
  route.query = { step: 'sync' }
})

it('names no Google account in the consent preview for a GitHub sign-in', async () => {
  route.query = { step: 'connect' }
  session.value = { hasSites: false, gscdumpConnected: false, user: { id: 1, authProvider: 'github', email: 'ada@example.com', name: 'Ada', avatarUrl: null } } as typeof session.value
  const host = await mount()
  expect(host.querySelector('[data-testid="gsc-consent-preview"]')).not.toBeNull()
  expect(host.querySelector('[data-testid="gsc-consent-account"]')).toBeNull()
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

it('opens Agent setup with Skip agent setup and no connection status', async () => {
  route.query = { step: 'agent', agent: 'claude' }
  session.value = { hasSites: false, gscdumpConnected: false }
  const host = await mount()
  expect(host.textContent).toContain('Choose your agent')
  expect(host.querySelector('[data-testid="step-skip"]')?.textContent).toBe('Skip agent setup')
  expect(host.querySelector('[data-agent-route="claude"]')?.getAttribute('aria-pressed')).toBe('true')
  expect(host.querySelector('a[href="https://claude.ai/directory/gscdump"]')).toBeNull()
  // Request Indexing cannot read an agent connection, so it claims none.
  expect(host.textContent).not.toMatch(/connected|waiting/i)
  route.query = { step: 'sync' }
})

it('leads Agent setup with the skip line, and shows Continue only once an agent is chosen', async () => {
  route.query = { step: 'agent' }
  session.value = { hasSites: false, gscdumpConnected: false }
  const host = await mount()
  expect(host.textContent).toContain('You can set up agents later, and connect more than one.')
  expect(host.querySelectorAll('[data-testid="step-skip"]')).toHaveLength(1)
  expect(host.querySelector('[data-testid="step-next"]')).toBeNull()
  route.query = { step: 'sync' }
})

it.each(['coding-agent', 'claude', 'chatgpt', 'gemini'])('defers the %s authorization and shows Continue after a choice', async (agent) => {
  route.query = { step: 'agent', agent }
  session.value = { hasSites: false, gscdumpConnected: false }
  const host = await mount()
  expect(host.querySelector('[data-agent-setup="route"]')).toBeNull()
  expect(host.querySelector('[data-testid="step-next"]')?.getAttribute('data-purpose')).toBe('cta')
  route.query = { step: 'sync' }
})

it('carries the chosen agent through the Connect Google return', async () => {
  route.query = { step: 'connect', agent: 'coding-agent' }
  session.value = { hasSites: false, gscdumpConnected: false }
  const host = await mount()
  expect(host.querySelector('[data-testid="connect-gsc-btn"]')?.getAttribute('href'))
    .toBe('/auth/integrations/gsc/connect?scope=read&returnTo=%2Fpro%2Fdashboard%2Fonboarding%3Fstep%3Dsites%26agent%3Dcoding-agent')
  route.query = { step: 'sync' }
})

it('records agent_setup_skipped when Skip agent setup is clicked', async () => {
  appFetchMock.mockClear()
  route.query = { step: 'agent' }
  session.value = { hasSites: false, gscdumpConnected: false }
  const host = await mount()
  const skip = host.querySelector<HTMLButtonElement>('[data-testid="step-skip"]')!
  skip.click()
  await nextTick()
  expect(appFetchMock).toHaveBeenCalledWith('/api/pro/onboarding/observation', { method: 'POST', body: { type: 'agent_setup_skipped' } })
  route.query = { step: 'sync' }
})

it('records agent_setup_selected with the chosen route when continuing past Agent setup', async () => {
  appFetchMock.mockClear()
  route.query = { step: 'agent', agent: 'claude' }
  session.value = { hasSites: false, gscdumpConnected: false }
  const host = await mount()
  const next = host.querySelector<HTMLButtonElement>('[data-testid="step-next"]')!
  next.click()
  await nextTick()
  expect(appFetchMock).toHaveBeenCalledWith('/api/pro/onboarding/observation', { method: 'POST', body: { type: 'agent_setup_selected', agent: 'claude' } })
  route.query = { step: 'sync' }
})
