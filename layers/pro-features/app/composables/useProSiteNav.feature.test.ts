/**
 * The Site sidebar a reader sees, resolved from the static nav manifest.
 *
 * Seams crossed: `shared/manifest.ts` (the declaration) → `shared/nav-groups.ts`
 * (the taxonomy) → `useProSiteNav` (the model the two sidebar components
 * render). The asserted outcome is the navigation itself — which rows exist,
 * where they point, which one lights up for a given path — never the manifest
 * object the composable read.
 */

import { describe, expect, it } from 'vitest'
import { useProSiteNav } from './useProSiteNav'

const SITE = 's_test'

/** Flags are passed explicitly, so no Nuxt instance is needed. */
function nav(options: Parameters<typeof useProSiteNav>[1] = {}) {
  return useProSiteNav(SITE, { flags: {}, ...options })
}

function labelsOf(section: { links: Array<{ label: string }> }) {
  return section.links.map(link => link.label)
}

describe('useProSiteNav', () => {
  it('groups the site rows under Google Search Console, Indexing and a settings rail', () => {
    const { sections, footerLinks } = nav()

    expect(sections.value.map(section => section.label)).toEqual(['Google Search Console', 'Indexing'])
    expect(labelsOf(sections.value[0]!)).toEqual(['Overview', 'Queries', 'Pages', 'Countries'])
    expect(labelsOf(sections.value[1]!)).toEqual(['Overview', 'Submissions', 'Recovery', 'Sitemaps', 'URLs', 'Watched URLs'])
    expect(footerLinks.value.map(link => link.label)).toEqual(['Site settings'])
  })

  it('routes every row at the site public id', () => {
    const { sections, footerLinks } = nav()
    const all = [...sections.value.flatMap(section => section.links), ...footerLinks.value]

    expect(all.every(link => link.to.startsWith(`/pro/dashboard/sites/${SITE}/`))).toBe(true)
    expect(sections.value[0]!.links.map(link => link.to)).toEqual([
      `/pro/dashboard/sites/${SITE}/search-console`,
      `/pro/dashboard/sites/${SITE}/search-console/queries`,
      `/pro/dashboard/sites/${SITE}/search-console/pages`,
      `/pro/dashboard/sites/${SITE}/search-console/countries`,
    ])
  })

  it('keeps a feature root unlit while one of its own children is open', () => {
    const [overview, queries] = nav().sections.value[0]!.links
    const queriesPath = `/pro/dashboard/sites/${SITE}/search-console/queries`

    expect(overview!.active!(queriesPath)).toBe(false)
    expect(queries!.active!(queriesPath)).toBe(true)
    expect(overview!.active!(`/pro/dashboard/sites/${SITE}/search-console`)).toBe(true)
  })

  it('keeps Submissions lit on its two channel pages, which have no row of their own', () => {
    const links = nav().sections.value[1]!.links
    const submissions = links.find(link => link.label === 'Submissions')!
    const sitemaps = links.find(link => link.label === 'Sitemaps')!

    expect(submissions.to).toBe(`/pro/dashboard/sites/${SITE}/indexing/submissions`)
    for (const path of ['submissions', 'submit', 'indexnow'])
      expect(submissions.active!(`/pro/dashboard/sites/${SITE}/indexing/${path}`)).toBe(true)
    expect(submissions.active!(`/pro/dashboard/sites/${SITE}/indexing/sitemaps`)).toBe(false)
    expect(sitemaps.active!(`/pro/dashboard/sites/${SITE}/indexing/indexnow`)).toBe(false)
  })

  it('still matches deeper paths under a leaf row', () => {
    const urls = nav().sections.value[1]!.links.find(link => link.label === 'URLs')!

    expect(urls.active!(`/pro/dashboard/sites/${SITE}/indexing/urls`)).toBe(true)
    expect(urls.active!(`/pro/dashboard/sites/${SITE}/indexing/urls/detail`)).toBe(true)
    expect(urls.active!(`/pro/dashboard/sites/${SITE}/indexing`)).toBe(false)
  })

  it('puts Bing Webmaster Tools in its own row when Bing is enabled', () => {
    expect(nav().pinnedLinks.value.map(link => link.label)).not.toContain('Bing Webmaster Tools')
    const flagged = nav({ flags: { bing: true } })
    const webmasterTools = flagged.pinnedLinks.value.find(link => link.label === 'Bing Webmaster Tools')
    const path = `/pro/dashboard/sites/${SITE}/webmaster-tools`

    expect(webmasterTools?.to).toBe(path)
    expect(webmasterTools?.icon).toBe('bing')
    expect(webmasterTools?.active?.(`${path}/crawl`)).toBe(true)
    expect(flagged.sections.value.flatMap(labelsOf)).not.toContain('Bing')
  })

  it('marks a row waiting when its integration is unmet, and leaves it clickable', () => {
    const { sections } = nav({
      pending: integration => integration === 'gsc-connected' ? { tooltip: 'Waiting for Google Search Console' } : null,
    })
    const [overview] = sections.value[0]!.links
    const submissions = sections.value[1]!.links.find(link => link.label === 'Submissions')!

    expect(overview!.pending).toBe(true)
    expect(overview!.pendingTooltip).toBe('Waiting for Google Search Console')
    expect(overview!.to).toBe(`/pro/dashboard/sites/${SITE}/search-console`)
    // Submitting a URL runs on the pooled Google client or on IndexNow, not on
    // the Search Console integration, so the row never waits on it.
    expect(submissions.pending).toBe(false)
  })

  it('synthesises an Overview pin unless the caller renders its own site header', () => {
    expect(nav().pinnedLinks.value.map(link => link.to)).toEqual([`/pro/dashboard/sites/${SITE}`])
    expect(nav({ overviewLink: false }).pinnedLinks.value).toEqual([])
  })

  it('resolves nothing before a site is in scope', () => {
    const { pinnedLinks, sections, footerLinks } = useProSiteNav('', { flags: {} })

    expect(pinnedLinks.value).toEqual([])
    expect(sections.value).toEqual([])
    expect(footerLinks.value).toEqual([])
  })
})
