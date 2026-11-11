import { expect, it } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import { siteLabel } from '~~/layers/core/app/utils/site-format'
import { dashboardSiteHref } from '../layers/core/app/utils/dashboard-site-link'

// The component reaches `siteLabel` and `dashboardSiteHref` as Nuxt
// auto-imports, so install them before the SFC module is evaluated.
Object.assign(globalThis as Record<string, unknown>, { siteLabel, dashboardSiteHref })

const { default: HeaderSitesMenu } = await import('../layers/core/app/components/HeaderSitesMenu.vue')

// The site menu is where a reader picks a site, so it is the one place the
// dashboard's route shape is visible. It pointed at `/dashboard/site/:id`,
// which no longer exists.
//
// `sites` mirrors the `GET /api/sites/list` row shape (`SiteFleetRow`): the
// public id comes back as `siteId`, not `publicId` (the raw `sites` table
// column name) -- a mismatch that once left every card linking to
// `/sites/undefined/...`.
function mount(sites: Array<{ siteId: string, domain?: string | null }>) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const app = createApp(HeaderSitesMenu as Parameters<typeof createApp>[0], { sites })
  // `HeaderMenuItem` is a Nuxt auto-import in the real app. Render the link it
  // would render, so the assertion is about the href and the label.
  app.component('HeaderMenuItem', defineComponent({
    props: { label: String, to: String },
    setup: props => () => h('a', { href: props.to }, props.label),
  }))
  app.mount(host)
  return host
}

it('links a site to its search console page by public id', () => {
  const host = mount([{ siteId: 's_kv1109', domain: 'requestindexing.com' }])
  const link = host.querySelector('a')!
  expect(link.getAttribute('href')).toBe('/pro/dashboard/sites/s_kv1109/search-console')
  expect(link.textContent).toBe('requestindexing.com')
})

it('percent-encodes a public id rather than splitting the path', () => {
  const host = mount([{ siteId: 's_a/b', domain: 'example.com' }])
  expect(host.querySelector('a')!.getAttribute('href')).toBe('/pro/dashboard/sites/s_a%2Fb/search-console')
})
