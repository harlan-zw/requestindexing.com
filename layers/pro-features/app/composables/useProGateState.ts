// Per-route gate state for pro-features. Written by `pro-gate.global.ts`
// middleware, read by `ProSiteFeaturePage.vue` to render either the feature
// body or a locked CTA. See ADR-0025 for the three authorization concepts.

export function useProGateState() {
  return useState<{ blocked: boolean, reason?: string, cta?: { label: string, to: string } }>(
    'pro-gate',
    () => ({ blocked: false }),
  )
}
