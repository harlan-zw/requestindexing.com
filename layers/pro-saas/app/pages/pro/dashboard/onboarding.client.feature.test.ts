import { afterEach, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, onMounted, ref } from 'vue'

const session = ref({ hasSites: true, gscdumpConnected: true })
Object.assign(globalThis, {
  onMounted,
  definePageMeta: () => {},
  useRoute: () => ({ query: { step: 'sync' } }),
  useRouter: () => ({ replace: vi.fn() }),
  useUserSession: () => ({ session, fetch: vi.fn() }),
  useRobotsRule: () => {},
  useSeoMeta: () => {},
})

const { default: Onboarding } = await import('./onboarding.vue')
const apps: ReturnType<typeof createApp>[] = []

function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(Onboarding)
  for (const name of ['ProAlert', 'ProGscScopeMissingAlert', 'UIcon', 'UButton', 'ProSiteAddForm'])
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
  return host
}

afterEach(() => {
  apps.splice(0).forEach(app => app.unmount())
  document.body.innerHTML = ''
})

it('resumes a connected account without claiming a new sync', async () => {
  session.value = { hasSites: true, gscdumpConnected: true }
  const host = mount()
  await nextTick()
  expect(host.textContent).toContain('indexing evidence for your connected Sites')
  expect(host.textContent).not.toContain('First sync started')
  expect(host.textContent).not.toContain('pulling your Search Console history now')
})

it('offers recovery instead of setup success when a bookmarked final step has no Site', async () => {
  session.value = { hasSites: false, gscdumpConnected: true }
  const host = mount()
  await nextTick()
  expect(host.textContent).toContain('Connect a Site to finish setup')
  expect(host.querySelector('button')?.disabled).toBe(true)
})
