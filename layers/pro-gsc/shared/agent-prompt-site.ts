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
