import type { ProShellSite } from '@nuxtseo/pro-shell/shared/sites'
import { proShellSiteCommands } from '@nuxtseo/pro-shell/shared/commands'
import { describe, expect, it } from 'vitest'
import { PRO_SHELL_ROUTES } from '../pro-shell'
import { proSitePalettePages } from './pro-command-palette'

const site: ProShellSite = {
  id: 's_abc',
  ref: 's_abc',
  name: 'nuxt.com',
  url: 'https://nuxt.com/',
  groupId: null,
  listing: 'active',
  statusLabel: null,
  emphasis: 'full',
}

function commands(flags: Parameters<typeof proSitePalettePages>[0]) {
  return proShellSiteCommands({
    sites: [site],
    current: null,
    routes: PRO_SHELL_ROUTES,
    route: { path: '/pro/dashboard', fullPath: '/pro/dashboard' },
    pages: proSitePalettePages(flags),
    labels: { sitePage: '{site}: {page}' },
  })
}

describe('proSitePalettePages', () => {
  it('lists the overview, then each Site nav row in sidebar order, under the Site route', () => {
    const rows = commands({ bing: true }).map(command => [command.label, command.to])
    expect(rows).toEqual([
      ['nuxt.com', '/pro/dashboard/sites/s_abc'],
      ['nuxt.com: Overview', '/pro/dashboard/sites/s_abc'],
      ['nuxt.com: Google Search Console', '/pro/dashboard/sites/s_abc/search-console'],
      ['nuxt.com: Google Search Console: Queries', '/pro/dashboard/sites/s_abc/search-console/queries'],
      ['nuxt.com: Google Search Console: Pages', '/pro/dashboard/sites/s_abc/search-console/pages'],
      ['nuxt.com: Google Search Console: Countries', '/pro/dashboard/sites/s_abc/search-console/countries'],
      ['nuxt.com: Indexing', '/pro/dashboard/sites/s_abc/indexing'],
      ['nuxt.com: Indexing: Submissions', '/pro/dashboard/sites/s_abc/indexing/submissions'],
      ['nuxt.com: Indexing: Submit to Google', '/pro/dashboard/sites/s_abc/indexing/submit'],
      ['nuxt.com: Indexing: IndexNow', '/pro/dashboard/sites/s_abc/indexing/indexnow'],
      ['nuxt.com: Indexing: Recovery', '/pro/dashboard/sites/s_abc/indexing/recovery'],
      ['nuxt.com: Indexing: Sitemaps', '/pro/dashboard/sites/s_abc/indexing/sitemaps'],
      ['nuxt.com: Indexing: URLs', '/pro/dashboard/sites/s_abc/indexing/urls'],
      ['nuxt.com: Indexing: Watched URLs', '/pro/dashboard/sites/s_abc/indexing/watched'],
      ['nuxt.com: Bing Webmaster Tools', '/pro/dashboard/sites/s_abc/webmaster-tools'],
      ['nuxt.com: Bing Webmaster Tools: Crawl', '/pro/dashboard/sites/s_abc/webmaster-tools/crawl'],
      ['nuxt.com: Site settings', '/pro/dashboard/sites/s_abc/settings'],
    ])
  })

  it('leaves out a flagged row while its flag is off', () => {
    const labels = commands({}).map(command => command.label)
    expect(labels).not.toContain('nuxt.com: Bing Webmaster Tools')
    expect(labels).not.toContain('nuxt.com: Bing Webmaster Tools: Crawl')
    expect(labels).toContain('nuxt.com: Indexing: IndexNow')
  })
})
