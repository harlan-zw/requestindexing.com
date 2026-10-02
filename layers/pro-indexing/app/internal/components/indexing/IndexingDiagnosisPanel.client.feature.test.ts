import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, defineComponent, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import IndexingDiagnosisPanel from './IndexingDiagnosisPanel.vue'

vi.mock('#components', () => ({
  UiCard: defineComponent({ setup: (_, { slots }) => () => h('div', slots.default?.()) }),
  UiButton: defineComponent({ props: ['to'], setup: (props, { slots }) => () => h('a', { href: props.to }, slots.default?.()) }),
  UiStatusBadge: defineComponent({ props: ['label'], setup: props => () => h('span', props.label) }),
  UiSkeleton: defineComponent({ setup: () => () => h('span') }),
  ConnectSearchConsoleButton: defineComponent({ setup: () => () => h('button', 'Connect Search Console') }),
}))

describe('indexingDiagnosisPanel first collection', () => {
  it('offers sitemap review while URL collection has no progress', async () => {
    const html = await renderToString(createSSRApp(IndexingDiagnosisPanel, {
      state: { _tag: 'ready', model: { _tag: 'waiting', state: 'pending', reason: 'URL Inspection data has not been collected yet.', progress: null } },
      actionTo: '/urls',
      sitemapTo: '/sitemaps',
      freshness: null,
    }))
    expect(html).toContain('href="/sitemaps"')
    expect(html).toContain('Review sitemap')
    expect(html).toContain('Waiting for indexing evidence')
  })

  it('offers sitemap review when the first collection fails', async () => {
    const html = await renderToString(createSSRApp(IndexingDiagnosisPanel, {
      state: { _tag: 'ready', model: { _tag: 'trust_failure', state: 'broken', reason: 'Sitemap URL collection failed. Review the sitemap errors.' } },
      actionTo: '/urls',
      sitemapTo: '/sitemaps',
      freshness: null,
    }))
    expect(html).toContain('href="/sitemaps"')
    expect(html).toContain('Sitemap URL collection failed.')
  })
})
