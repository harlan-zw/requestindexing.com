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
  it('groups the site rows under Search Performance, Indexing and a settings rail', () => {
    const { sections, footerLinks } = nav()

    expect(sections.value.map(section => section.label)).toEqual(['Search Performance', 'Indexing'])
    expect(labelsOf(sections.value[0]!)).toEqual(['Overview', 'Queries', 'Pages', 'Countries'])
    expect(labelsOf(sections.value[1]!)).toEqual(['Overview', 'Recovery', 'Sitemaps', 'URLs', 'Submit', 'IndexNow'])
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

  it('routes IndexNow at the app Site id and activates its own navigation row', () => {
    const row = nav().sections.value[1]!.links.find(link => link.label === 'IndexNow')!
    expect(row.to).toBe(`/pro/dashboard/sites/${SITE}/indexing/indexnow`)
    expect(row.active!(`/pro/dashboard/sites/${SITE}/indexing/indexnow`)).toBe(true)
    expect(row.active!(`/pro/dashboard/sites/${SITE}/indexing/submit`)).toBe(false)
  })

  it('still matches deeper paths under a leaf row', () => {
    const urls = nav().sections.value[1]!.links.find(link => link.label === 'URLs')!

    expect(urls.active!(`/pro/dashboard/sites/${SITE}/indexing/urls`)).toBe(true)
    expect(urls.active!(`/pro/dashboard/sites/${SITE}/indexing/urls/detail`)).toBe(true)
    expect(urls.active!(`/pro/dashboard/sites/${SITE}/indexing`)).toBe(false)
  })

  it('withholds a flagged row until its flag is on', () => {
    expect(labelsOf(nav().sections.value[0]!)).not.toContain('Bing')

    const flagged = nav({ flags: { bing: true } })
    expect(labelsOf(flagged.sections.value[0]!)).toEqual(['Overview', 'Queries', 'Pages', 'Countries', 'Bing'])
    expect(labelsOf(flagged.sections.value[1]!)).toContain('Bing')
  })

  it('marks a row waiting when its integration is unmet, and leaves it clickable', () => {
    const { sections } = nav({
      pending: integration => integration === 'gsc-connected' ? { tooltip: 'Waiting for Google Search Console' } : null,
    })
    const [overview] = sections.value[0]!.links
    const submit = sections.value[1]!.links.find(link => link.label === 'Submit')!

    expect(overview!.pending).toBe(true)
    expect(overview!.pendingTooltip).toBe('Waiting for Google Search Console')
    expect(overview!.to).toBe(`/pro/dashboard/sites/${SITE}/search-console`)
    // Submitting a URL runs on the pooled Google client, not on the Search
    // Console integration, so it never waits on it.
    expect(submit.pending).toBe(false)
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
