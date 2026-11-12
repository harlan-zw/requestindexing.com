# pro-features

The page-flow primitive for `/pro/dashboard/sites/[id]/*`. Owns the shell
component, the feature/policy/state-resolver/adapter registry, and the
gating middleware that pro-* feature layers contribute to.

This layer was `layers/pro-shell`, an early fork of nuxtseo.com's feature
registry. It was renamed when the app adopted the published
`@nuxtseo/pro-shell` layer, which owns the dashboard frame. The two are
separate: this layer builds the Site nav rows, and the published shell draws
them.

## Which shell to use

Two shells compose; they solve different concerns.

- **`<ProSiteFeaturePage>`** (this layer): feature-root shell. Use for any
  page that's the root of a registered feature (`keywords.vue`, `cwv.vue`,
  `search-console.vue`, etc.). Reads the build-time `#pro-features/registry`
  for tabs, reads `useProGateState()` for the locked chrome, dispatches the
  feature's state resolver. Detail leaves opt out of tabs with
  `definePageMeta({ proHideTabs: true })`.
- **`<ProPage>`** (nuxt-seo-pro): page-owned body shell. Composes the
  per-page chrome that every page would otherwise rebuild: `ProPageSurfaces`
  (system + onboarding stack), `ProPageHeader` (title + actions + period +
  tabs), and `UiWidgetState` (loading/error/empty matrix). Pages declare
  `status` / `error` / `empty` / `title` and slot content; the shell owns
  the matrix. Sits inside `<ProSiteFeaturePage>` for feature pages, or
  inside `pro-site-dashboard` directly for site-scoped pages without a
  feature gate (e.g. settings). Use `hide-header` for sub-tabs sharing a
  parent header.
- **`<ProDashboardPage>`**: removed. `ProPage` absorbed its role; pages
  migrated via ripast plus a transitional `#header` slot on `ProPage`
  for the inline-`ProPageHeader` pattern. New pages should use the props
  API (`title` / `description` / `actions` / `tabs` / `period`).

## Why

Pro feature pages were re-threading header → tabs → toolbar → freshness →
gating → empty/demo → content → error inline. `ProDashboardPage`,
`ProModulePage`, and `ProAnalysisPresetPage` all attempted this and
contradicted each other. `pro-features` collapses the contract to one
component (`ProSiteFeaturePage`) plus a registry that pro-* layers fill in
at build time.

## Concepts

- **Feature**: a top-level area inside a site (`search-console`,
  `indexing`, `cwv`, `lighthouse`, `analysis`, `competitors`, `keywords`,
  `ai-prompt`, `chat`, `reports`). Each feature is owned by exactly one
  pro-* layer.
- **Policy**: a named gate evaluated on the client (in middleware) and on
  the server (in API handlers). Same key, two adapters.
- **State resolver**: a composable per feature that returns a
  `FeatureDataState` (`unconnected | syncing | demo | empty | partial |
  ready | stale | error`). The shell renders the right chrome from this.
- **Adapter**: the data-fetching dispatcher for a feature. Pages call
  `useProSiteResource({ feature, ... })` and the adapter handles engine
  selection (browser/cloud), caching, retry.

## Contributing a feature (from a pro-* layer)

1. In your layer's `nuxt.module.ts`, hook `pro-features:extend`:

   ```ts
   nuxt.hook('pro-features:extend', (api) => {
     api.addProSiteFeature({
       id: 'search-console',
       label: 'Search Console',
       icon: 'i-lucide-search',
       group: 'visibility',
       gating: 'gsc-connected',
       stateResolver: 'searchConsole',
       adapter: 'searchConsole',
     })
   })
   ```

2. Declare child-route tabs via page meta:

   ```ts
   definePageMeta({
     proTab: { feature: 'search-console', label: 'Queries', order: 10 },
   })
   ```

3. Register the runtime resolver/adapter/policy via a Vue plugin in your
   layer's `app/plugins/`.

4. Pages stop scaffolding chrome and become:

   ```vue
   <ProSiteFeaturePage feature="search-console" :site-id="siteId">
     <NuxtPage />
   </ProSiteFeaturePage>
   ```

## Migration order

1. Search Console (pilot, proves the pattern)
2. Indexing, CWV, Lighthouse
3. Analysis (introduces `ProAnalyticalBody`); sweep keywords/competitors
4. Slim `pro-site-dashboard.vue` (~250 lines target)
5. Delete `ProDashboardPage`, `ProAnalysisPresetPage`, `ProModulePage`
   (`ProDashboardPage` and `ProModulePage` done; both folded into
   `ProPage`. `ProAnalysisPresetPage` already gone in main.)
