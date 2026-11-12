// Pro Shell layer: owns the page-flow primitive (ProSiteFeaturePage),
// the feature/policy/state-resolver/adapter registry, and the route-level
// gating middleware that pro-* feature layers contribute to.
//
// Pro-* layers extend this layer and register features via the
// `pro-features:extend` Nuxt hook (see modules/pro-features.ts).

export default {
  // modules/pro-features.ts is auto-discovered by Nuxt from this layer's
  // modules/ directory.
  experimental: {
    // Eager scan so custom meta is on page.meta during pages:extend
    // (default 'after-resolve' fires too late for our hook).
    scanPageMeta: true,
    // Allowlist `proTab`, `pro` and `layout` for static extraction from
    // definePageMeta. Without this, those keys land in
    // `__nuxt_dynamic_meta_key` and are invisible at build time. The module
    // sets the same list, because a layer's `experimental` block does not
    // survive the merge with the root config.
    extraPageMetaExtractionKeys: ['proTab', 'pro', 'layout'],
  },
}
