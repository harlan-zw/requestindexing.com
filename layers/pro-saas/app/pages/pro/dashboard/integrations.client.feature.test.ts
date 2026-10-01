import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, ref, Suspense, useTemplateRef } from 'vue'

// What `/api/pro/gsc-properties` answers for the Search Console row.
const fixture = vi.hoisted(() => ({
  properties: [] as Record<string, unknown>[],
}))

vi.mock('~~/layers/core/app/composables/fetch', () => ({
  fetchSites: async () => ({ data: ref({ sites: [] }) }),
}))
vi.mock('#layers/pro-gsc/app/composables/useProGscdump', () => ({
  useProBingIntegration: () => ({ state: ref({ _tag: 'not-offered' }), grantTarget: ref(null) }),
}))
vi.mock('#layers/pro-gsc/app/internal/components/bing/ProBingIntegrationCard.vue', async () => {
  const { defineComponent } = await import('vue')
  return { default: defineComponent({ setup: () => () => null }) }
})

Object.assign(globalThis, {
  definePageMeta: () => {},
  useSeoMeta: () => {},
  useTemplateRef,
  useUserSession: () => ({ session: ref({ gscConnected: true, gscEmail: 'agent@example.com', gscdumpAccountStatus: 'active' }) }),
  useLazyFetch: () => ({
    data: ref({ connected: true, properties: fixture.properties }),
    error: ref(null),
    status: ref('success'),
    refresh: vi.fn(),
  }),
})

const { default: IntegrationsPage } = await import('./integrations.vue')

const apps: ReturnType<typeof createApp>[] = []

function link(tag = 'a') {
  return defineComponent({
    props: ['to', 'label'],
    setup: (props, { slots }) => () => h(tag, { href: props.to }, slots.default?.() ?? props.label),
  })
}

async function mount() {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp({ render: () => h(Suspense, null, { default: () => h(IntegrationsPage) }) })
  app.component('IntegrationRow', defineComponent({
    props: ['name', 'status'],
    setup: (props, { slots }) => () => h('section', [h('h3', props.name), h('p', props.status), slots.action?.(), slots.default?.()]),
  }))
  for (const name of ['UiSectionHeader', 'UiAlert', 'UIcon'])
    app.component(name, defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }))
  app.component('UiButton', link())
  app.component('UButton', link())
  app.component('ULink', link())
  app.mount(host)
  apps.push(app)
  for (let i = 0; i < 3; i++) {
    await new Promise(resolve => setTimeout(resolve, 0))
    await nextTick()
  }
  return host
}

function grantLinks(host: HTMLElement) {
  return [...host.querySelectorAll('a')].filter(a => a.getAttribute('href')?.startsWith('/auth/integrations/gsc/connect'))
}

beforeEach(() => {
  fixture.properties = []
})

afterEach(() => {
  for (const app of apps.splice(0))
    app.unmount()
  document.body.innerHTML = ''
})

describe('the Search Console row', () => {
  // The 2026-10-01 replay, N9: "Connect another Google account" and
  // "Reconnect" sat side by side and started the same Google round trip.
  it('offers one Google grant control when the account has no property, with the fixes Connect a Site offers', async () => {
    const host = await mount()

    expect(host.textContent).toContain('Connected. This Google account has no Search Console property.')
    expect(host.textContent).toContain('agent@example.com has no Search Console property')
    expect(grantLinks(host).map(a => a.textContent)).toEqual(['Connect another Google account'])
    expect(grantLinks(host)[0]!.getAttribute('href')).toBe('/auth/integrations/gsc/connect?returnTo=%2Fpro%2Fdashboard%2Fintegrations')
    expect([...host.querySelectorAll('a')].map(a => a.textContent?.trim())).toEqual(
      expect.arrayContaining(['Open Search Console', 'How to verify a site']),
    )
  })

  // nuxtseo.com's ready row: one way to the properties, one quiet Reconnect.
  it('keeps Manage Sites and Reconnect when the account has a property', async () => {
    fixture.properties = [{ siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner', syncStatus: 'synced' }]
    const host = await mount()

    expect(host.textContent).not.toContain('has no Search Console property')
    expect(grantLinks(host).map(a => a.textContent)).toEqual(['Reconnect'])
    expect([...host.querySelectorAll('a')].find(a => a.textContent === 'Manage Sites')?.getAttribute('href')).toBe('/pro/dashboard/sites')
  })
})
