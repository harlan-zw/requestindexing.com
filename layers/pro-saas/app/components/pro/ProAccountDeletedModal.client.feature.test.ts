import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, onMounted } from 'vue'

const fixture = vi.hoisted(() => ({
  query: {} as Record<string, string>,
  navigateTo: vi.fn(),
}))

Object.assign(globalThis, {
  onMounted,
  useRoute: () => ({ path: '/', query: fixture.query, hash: '' }),
  navigateTo: fixture.navigateTo,
})

const { default: ProAccountDeletedModal } = await import('./ProAccountDeletedModal.vue')

const apps: ReturnType<typeof createApp>[] = []

async function mount(query: Record<string, string>) {
  fixture.query = query
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp({ render: () => h(ProAccountDeletedModal) })
  app.component('UModal', defineComponent({
    props: ['open', 'title'],
    setup: (props, { slots }) => () => props.open
      ? h('div', { role: 'dialog' }, [props.title, slots.body?.(), slots.footer?.()])
      : null,
  }))
  app.component('ULink', defineComponent({
    props: ['to'],
    setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()),
  }))
  app.component('UButton', defineComponent({
    setup: (_props, { slots }) => () => h('button', slots.default?.()),
  }))
  app.mount(host)
  apps.push(app)
  await nextTick()
  return host
}

afterEach(() => {
  fixture.navigateTo.mockReset()
  for (const app of apps.splice(0))
    app.unmount()
  document.body.innerHTML = ''
})

describe('proAccountDeletedModal', () => {
  // UX replay N4: after a delete, nothing said the account was deleted.
  it('confirms the delete, links to Google to remove access, and drops the flag from the URL', async () => {
    const host = await mount({ account_deleted: '1', utm_source: 'mail' })

    const dialog = host.querySelector('[role="dialog"]')
    expect(dialog?.textContent).toContain('Your account is deleted')
    expect(dialog?.querySelector('a')?.getAttribute('href')).toBe('https://myaccount.google.com/connections')
    expect(fixture.navigateTo).toHaveBeenCalledWith({ path: '/', query: { utm_source: 'mail' }, hash: '' }, { replace: true })
  })

  it('stays closed on a normal visit', async () => {
    const host = await mount({})

    expect(host.querySelector('[role="dialog"]')).toBeNull()
    expect(fixture.navigateTo).not.toHaveBeenCalled()
  })
})
