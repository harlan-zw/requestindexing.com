import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, onMounted, ref, Suspense } from 'vue'
import ProAccountDeletionScope from '../../../components/pro/ProAccountDeletionScope.vue'

const fixture = vi.hoisted(() => ({
  fetch: vi.fn(),
  navigateTo: vi.fn(),
  signOut: vi.fn(),
  toasts: [] as { title?: string }[],
}))

vi.mock('#layers/pro-saas-auth/app/components/auth/ProConnectedAccounts.vue', () => ({
  default: { render: () => null },
}))

Object.assign(globalThis, {
  onMounted,
  definePageMeta: () => {},
  useRoute: () => ({ query: {} }),
  navigateTo: fixture.navigateTo,
  $fetch: fixture.fetch,
  // The sign-out handler toasts "See you next time!" and navigates to `/`.
  createLogoutHandler: () => fixture.signOut,
  useUserSession: () => ({ session: ref({ user: { name: 'Harlan Agent', email: 'agent@example.test', authProvider: 'google' } }) }),
  useFetch: () => ({ data: ref({ _tag: 'NotGranted' }), error: ref(null), refresh: vi.fn() }),
})

const { default: AccountPage } = await import('./account.vue')

const apps: ReturnType<typeof createApp>[] = []

function passthrough(tag: string) {
  return defineComponent({
    props: ['title', 'description'],
    setup: (props, { slots }) => () => h(tag, [props.title, props.description, slots.default?.()]),
  })
}

async function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp({ render: () => h(Suspense, null, { default: () => h(AccountPage) }) })
  for (const name of ['ProGscScopeMissingAlert', 'ProSectionHeader', 'ProCard', 'UAvatar', 'USkeleton', 'ProNavIcon', 'UAlert'])
    app.component(name, passthrough('div'))
  app.component('ProAccountDeletionScope', ProAccountDeletionScope)
  app.component('NuxtLink', passthrough('a'))
  app.component('ULink', defineComponent({
    props: ['to'],
    setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()),
  }))
  app.component('UButton', defineComponent({
    emits: ['click'],
    setup: (_props, { slots, emit }) => () => h('button', { type: 'button', onClick: () => emit('click') }, slots.default?.()),
  }))
  app.component('UModal', defineComponent({
    props: ['open', 'title'],
    setup: (props, { slots }) => () => props.open
      ? h('div', { role: 'dialog' }, [props.title, slots.body?.(), slots.footer?.()])
      : null,
  }))
  app.mount(host)
  apps.push(app)
  await flush()
  return host
}

async function flush() {
  for (let i = 0; i < 3; i++) {
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()
  }
}

function button(root: Element, text: string) {
  return [...root.querySelectorAll('button')].find(element => element.textContent?.trim() === text)
}

beforeEach(() => {
  fixture.fetch.mockReset()
  fixture.navigateTo.mockReset()
  fixture.signOut.mockReset()
  fixture.toasts = []
  const add = (toast: { title?: string }) => fixture.toasts.push(toast)
  Object.assign(globalThis, { useToast: () => ({ add }) })
})

afterEach(() => {
  for (const app of apps.splice(0))
    app.unmount()
  document.body.innerHTML = ''
})

async function confirmDelete(host: HTMLElement) {
  button(host, 'Delete account')!.click()
  await flush()
  const dialog = host.querySelector('[role="dialog"]')!
  button(dialog, 'Delete my account')!.click()
  await flush()
}

describe('account page delete', () => {
  // UX replay N5: the dialog said only "We delete all data linked to your
  // account", and N1: the page promised a Google revoke that never happens.
  it('lists what the delete reaches, and sends the reader to Google to remove access', async () => {
    const host = await mount()
    button(host, 'Delete account')!.click()
    await flush()

    const dialog = host.querySelector('[role="dialog"]')!
    expect(dialog.textContent).toContain('Your API keys stop working.')
    expect(dialog.textContent).toContain('deletes the record it keeps for your account')
    expect(dialog.querySelector('a')?.getAttribute('href')).toBe('https://myaccount.google.com/connections')
    expect(host.textContent).not.toContain('We revoke')
  })

  // UX replay N4: the sign-out toast replaced the confirmation, so nothing said
  // the account was deleted.
  it('lands on the page that confirms the delete, without the sign-out toast', async () => {
    fixture.fetch.mockResolvedValue({ success: true })
    const host = await mount()

    await confirmDelete(host)

    expect(fixture.fetch).toHaveBeenCalledWith('/api/user/me', expect.objectContaining({ method: 'DELETE' }))
    expect(fixture.navigateTo).toHaveBeenCalledWith('/?account_deleted=1', { external: true, replace: true })
    expect(fixture.signOut).not.toHaveBeenCalled()
  })

  it('stays on the page and says the delete failed when the request fails', async () => {
    fixture.fetch.mockRejectedValue(new Error('500'))
    const host = await mount()

    await confirmDelete(host)

    expect(fixture.navigateTo).not.toHaveBeenCalled()
    expect(fixture.toasts.map(toast => toast.title)).toEqual(['Failed to delete the account'])
  })
})
