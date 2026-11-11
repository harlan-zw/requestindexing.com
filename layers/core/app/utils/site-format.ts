import type { ComputedRef, MaybeRef, Ref } from 'vue'
import { differenceInHours, formatDistanceToNow } from 'date-fns'
import { withoutTrailingSlash } from 'ufo'
import { computed, isRef } from 'vue'

// Search Console property handling and indexing recency. `@nuxtseo/design-system`
// has no equivalent, so Request Indexing owns these.

/** Milliseconds as `240ms` under a second, `1.4s` above it. */
export function useHumanMs(ms: number): string {
  if (ms < 1000)
    return `${Number(ms).toFixed(0)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function useFriendlySiteUrl(url: string): string
export function useFriendlySiteUrl(url: Ref<string>): ComputedRef<string>
export function useFriendlySiteUrl(url: MaybeRef<string>) {
  const format = (s: string) => withoutTrailingSlash(
    s.replace('https://', '')
      .replace('sc-domain:', '')
      .replace('www.', ''),
  )
  if (isRef(url))
    return computed(() => format(url.value))
  return format(url)
}

/**
 * Display label for a site.
 *
 * `sites.domain` is nullable: rows imported from the old KV store carry only a
 * Search Console `property` (`https://unhead.unjs.io/`, `sc-domain:nuxtseo.com`).
 * Components used to read `site.domain` directly, which threw
 * "Cannot read properties of null (reading 'replace')" the moment such a site
 * reached the dashboard, and the `site.domain || ''` guards elsewhere rendered a
 * blank label instead. Route every label through here so neither is possible.
 */
export function siteLabel(site: { domain?: string | null, property?: string | null }): string {
  const source = site.domain || site.property || ''
  // `withoutTrailingSlash('')` returns `/`, so a site with neither field used to
  // produce a truthy `/` label. Callers read that as a real host: the favicon
  // proxy was asked for `?domain=/` instead of falling back to the globe icon.
  if (!source)
    return ''
  return useFriendlySiteUrl(source)
}

/**
 * Strips the Search Console `sc-domain:` prefix, leaving a bare hostname for
 * the favicon proxy. `sites.domain` is a nullable column, so a null hostname
 * reaches components; callers passed it to `domain.replace` and threw
 * "Cannot read properties of null (reading 'replace')". A missing domain
 * returns `''` so the component can fall back to a globe icon instead.
 */
export function cleanDomain(domain: string | null | undefined): string {
  if (!domain)
    return ''
  return domain.replace(/^sc-domain:/, '')
}

/**
 * Recency of an indexing event. Under an hour reads as a distance ("5 minutes
 * ago"); past that it counts whole hours, which is the grain Search Console
 * itself reports. `absAgo` forces the distance form.
 */
export function formatIndexingTimeAgo(date: string | number, absAgo?: boolean): string
export function formatIndexingTimeAgo(date: Ref<string | number>, absAgo?: boolean): ComputedRef<string>
export function formatIndexingTimeAgo(date: MaybeRef<string | number>, absAgo?: boolean) {
  const format = (_d: string | number) => {
    const d = new Date(_d)
    const hourDiff = differenceInHours(new Date(), d)
    if (hourDiff < 1 || absAgo)
      return formatDistanceToNow(d, { addSuffix: true })
    return `${hourDiff} hours ago`
  }
  if (isRef(date))
    return computed(() => format(date.value))
  return format(date)
}
