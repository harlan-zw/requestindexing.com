import type { NuxtApp, Plugin } from '#app'
import type { ProFeatureChromeBinding, ProFeatureRegistration } from '../../shared/types'

/**
 * Declare a layer's `pro:feature` contributions as a single plugin. Each
 * layer that owns Site Features (search-console, cwv, chat, etc.) exports
 * one of these from `app/plugins/pro-feature.ts`.
 *
 * Centralises the boilerplate so the hook name + listener wiring lives in
 * exactly one place; consumer plugins become declarative spec objects.
 */
export function proFeatureSetup(opts: {
  features: ProFeatureRegistration[]
  chrome?: ProFeatureChromeBinding[]
}): Plugin {
  return defineNuxtPlugin(((nuxtApp: NuxtApp) => {
    nuxtApp.hook('pro:feature', (registry) => {
      for (const f of opts.features)
        registry.add(f)
      for (const c of opts.chrome ?? [])
        registry.addChrome(c)
    })
  }) as unknown as Plugin)
}

// `siteSurfaceSetup` removed for now — the SiteSurface contract lives in
// the upstream `pro-saas` layer which we haven't copied. Re-add if a future
// layer brings the `pro:site-surface` hook contract back; billing is gone
// and will not be that layer.
