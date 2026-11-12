// Nav manifest items for the `@nuxtseo/pro-shell` sidebar. This app's Site
// rows come from the pro-features registry already resolved, so they are
// `Path` targets. A flagged row carries a feature gate, and the nav source's
// `hasFeature` decides it.
import type { UiNavLink } from '@nuxtseo/design-system/app/shared/nav'
import type { ProShellNavItem, ProShellNavSection } from '@nuxtseo/pro-shell/shared/nav'
import { pathNavItems } from '@nuxtseo/pro-shell/shared/nav'
import { proSiteFeatureFlag } from '#layers/pro-features/shared/manifest'

type IdentifiedLink = UiNavLink & { readonly id?: string }

/** Path items, each gated on the flag its registry row names. */
export function gatedSiteNavItems(links: readonly IdentifiedLink[]): ProShellNavItem[] {
  return pathNavItems(links).map((item) => {
    const flag = proSiteFeatureFlag(item.id)
    return flag ? { ...item, gate: { feature: flag } } : item
  })
}

export function gatedSiteNavSections(sections: readonly { readonly id: string, readonly label: string, readonly links: readonly IdentifiedLink[] }[]): ProShellNavSection[] {
  return sections.map(section => ({ id: section.id, label: section.label, items: gatedSiteNavItems(section.links) }))
}
