// Site-nav section taxonomy. Every manifest entry declares a `group`; the
// sidebar renders one collapsible section per non-pinned group, in this order.
// A `footer: true` group renders unlabelled at the bottom of the sidebar. An
// entry whose group is not listed here is dropped from nav.
//
// nuxtseo.com splits the same surfaces across two tabbed features. Here they
// are flat menu rows (owner decision 10), so the taxonomy names the question
// the reader brings rather than the upstream feature.

import { SEARCH_CONSOLE, WEBMASTER_TOOLS } from '@nuxtseo/pro-search/shared/navigation'

export type ProNavGroupId = 'search' | 'indexing' | 'webmaster-tools' | 'footer'

export interface ProNavGroupDef {
  id: ProNavGroupId
  label: string
  /** Render the group's rows flat at the top of the sidebar, not in a section. */
  pinned?: boolean
  /** Render at the bottom of the sidebar, unlabelled, below every section. */
  footer?: boolean
}

export const proNavGroups: readonly ProNavGroupDef[] = [
  { id: 'search', label: SEARCH_CONSOLE.label },
  { id: 'indexing', label: 'Indexing' },
  { id: 'webmaster-tools', label: WEBMASTER_TOOLS.label, pinned: true },
  { id: 'footer', label: 'Settings', footer: true },
]
