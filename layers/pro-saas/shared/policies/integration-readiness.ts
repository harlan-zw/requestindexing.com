// Integration readiness — the third of the three authorization concepts
// named in ADR-0025. Not a security boundary: a render directive that tells
// the dashboard whether to show a feature's body or a locked CTA pointing to
// the integration's setup flow.
//
// Isomorphic. No server mirror, no runtime registry, no virtual module.
// A new GSC scope (or a new integration entirely) is one new union member
// plus one new case in `checkIntegration`.

import { INTEGRATIONS_ROUTE } from '#layers/pro-shell/app/utils/integrations-pending'

// Account holds the Indexing API grant; Integrations holds Search Console.
const ACCOUNT_ROUTE = '/pro/dashboard/account'

export type IntegrationReadiness
  = | 'gsc-connected' // webmasters.readonly — sufficient for read paths
    | 'gsc-indexing-connected' // indexing API scope — required for "request indexing" actions
    | 'gsc-sitemaps-writable' // sitemap submission scope — required for sitemap mutations

export interface IntegrationGap {
  reason: string
  cta: { label: string, to: string }
}

/**
 * Per-integration runtime context. Each gate reads only the fields it needs.
 * Adding a new gate that requires a new field = extend this interface +
 * extend the `checkIntegration` switch. Consumers populate from whatever
 * source owns the data (session cache, Caller, lazy fetch).
 */
export interface IntegrationContext {
  gscConnected: boolean
  /** Has the user authorised the Indexing API scope on top of GSC? */
  gscIndexingScope?: boolean
  /** Has the user authorised sitemap-write access on top of GSC? */
  gscSitemapsScope?: boolean
}

export function checkIntegration(name: IntegrationReadiness, ctx: IntegrationContext): IntegrationGap | null {
  switch (name) {
    case 'gsc-connected':
      if (ctx.gscConnected)
        return null
      return {
        reason: 'Connect Google Search Console to view this feature.',
        cta: { label: 'Connect GSC', to: INTEGRATIONS_ROUTE },
      }
    case 'gsc-indexing-connected':
      if (ctx.gscConnected && ctx.gscIndexingScope)
        return null
      return {
        reason: ctx.gscConnected
          ? 'Grant Indexing API permission to request indexing.'
          : 'Connect Google Search Console with Indexing API permission.',
        cta: { label: 'Grant indexing permission', to: ctx.gscConnected ? ACCOUNT_ROUTE : INTEGRATIONS_ROUTE },
      }
    case 'gsc-sitemaps-writable':
      if (ctx.gscConnected && ctx.gscSitemapsScope)
        return null
      return {
        reason: ctx.gscConnected
          ? 'Grant sitemap write permission to submit sitemaps.'
          : 'Connect Google Search Console with sitemap write permission.',
        cta: { label: 'Grant sitemap permission', to: INTEGRATIONS_ROUTE },
      }
  }
}
