// Shared types for the pro-shell registry.
// Imported by both the build-time module and runtime composables.

import type { Component, Ref } from 'vue'
import type { IntegrationReadiness } from '#layers/pro-saas/shared/policies/integration-readiness'

/**
 * Runtime-registered feature. Layers register these via the `pro:feature`
 * hook from `app/plugins/pro-feature.ts`. Direct refs only — no string
 * lookups, no importFrom indirection. See ADR-0015 (superseded section).
 */
export interface ProFeatureRegistration {
  /** Manifest id. Label, icon, group, order and route come from there. */
  id: string
  /**
   * External-account state the feature reads (e.g. GSC OAuth scope). Drives
   * the locked render only — not a server-side security check. Handlers under
   * a feature that declares `integration` should degrade to empty data rather
   * than 403 when the integration is missing. See ADR-0025.
   */
  integration?: IntegrationReadiness
  /**
   * Composable returning a reactive FeatureDataState for this feature on the
   * given site. Direct function reference — no string indirection.
   */
  stateResolver?: (siteId: Ref<string>) => Ref<FeatureDataState>
  /** Stability tier for the nav (alpha/beta/stable). Optional. */
  stability?: 'alpha' | 'beta' | 'stable' | null
  /** Copy shown when the feature is locked at the nav level. */
  lockedDescription?: string
  lockedUnlockLabel?: string
  lockedUnlockTo?: string
}

/**
 * Feature with its manifest entry and build-time tab metadata merged in. What
 * consumer composables see.
 */
export interface ProSiteFeature extends ProFeatureRegistration {
  label: string
  icon?: string
  route?: string
  tabs: ProSiteFeatureTab[]
}

export interface ProSiteFeatureTab {
  feature: string
  label: string
  icon?: string
  to: string
  order: number
}

export interface ProFeatureChromeBinding {
  forFeatures: string[]
  component: Component
}

export interface ProFeatureRegistry {
  add: (feature: ProFeatureRegistration) => void
  addChrome: (binding: ProFeatureChromeBinding) => void
}

export type FeatureDataState
  = | { status: 'unconnected', cta?: { label: string, to: string } }
    | { status: 'syncing', progress?: number, eta?: string }
    | { status: 'demo', sampleSiteId?: string }
    | { status: 'empty', reason?: string }
    | { status: 'partial', missing?: string[] }
    | { status: 'ready' }
    | { status: 'stale', lastSync?: string }
    | { status: 'error', error: unknown, retry?: () => void }
