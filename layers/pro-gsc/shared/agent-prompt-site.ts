import type { SiteHoldReason } from '@gscdump/contracts'
import type { AgentPromptSite } from './developer-setup'

/** The fields of a Sites list row that decide whether the prompt can read it. */
export interface AgentPromptCandidate {
  domain: string | null
  property: string
  gscdumpSiteId: string | null
  /** `refused`: gscdump refused to link the Site. */
  syncStatus: 'idle' | 'pending' | 'syncing' | 'synced' | 'error' | 'refused'
  hold: SiteHoldReason | null
}

/**
 * The first Site the agent setup prompt can read, or null when there is none.
 *
 * The prompt ends on a read of one Site's indexing record. A Site without a
 * gscdump link has no record, and gscdump imports nothing for a held Site.
 * With no such Site the prompt can only come back empty, so the Developers
 * page names the next step instead of offering the prompt (UX replay A7).
 * nuxtseo.com's prompt has no such gate: its accounts always have a Site.
 */
export function agentPromptSite(sites: readonly AgentPromptCandidate[]): AgentPromptSite | null {
  const site = sites.find(candidate => !!candidate.gscdumpSiteId && candidate.syncStatus !== 'refused' && !candidate.hold)
  return site?.gscdumpSiteId ? { gscdumpSiteId: site.gscdumpSiteId, host: site.domain ?? site.property } : null
}

export type AgentPromptGate
  /** Search Console is not connected, so gscdump holds nothing to read. */
  = | { _tag: 'SearchConsoleRequired' }
  /** Connected, with no Site the prompt can read. */
    | { _tag: 'SiteRequired' }
    | { _tag: 'Ready', site: AgentPromptSite }

/**
 * Whether the Developers page offers the agent setup prompt.
 *
 * `gscConnected` is the session's Search Console connection, the one value
 * Integrations, the sidebar, and the feature locks read. The page adds no
 * definition of its own.
 */
export function agentPromptGate(input: { gscConnected: boolean, sites: readonly AgentPromptCandidate[] }): AgentPromptGate {
  if (!input.gscConnected)
    return { _tag: 'SearchConsoleRequired' }
  const site = agentPromptSite(input.sites)
  return site ? { _tag: 'Ready', site } : { _tag: 'SiteRequired' }
}
