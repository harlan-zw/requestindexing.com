import type { Component } from 'vue'
import type {
  ProFeatureChromeBinding,
  ProFeatureRegistration,
  ProFeatureRegistry,
  ProSiteFeature,
} from '../../shared/types'
import { markRaw } from 'vue'
import { tabsByFeature, topNavOrder } from '#pro-features/tabs'
import { findProSiteFeatureEntry } from '../../shared/manifest'

interface ResolvedRegistry {
  features: Record<string, ProSiteFeature>
  chromeByFeature: Record<string, Component>
  topNavOrder: string[]
}

/**
 * Runtime accessor for the pro-feature registry. Layers register features +
 * chrome via the `pro:feature` Nuxt Layer Hook from
 * `app/plugins/pro-feature.ts`. The registry is built lazily on first read
 * (cached in `useState`); contributor plugins only need to have registered
 * their listeners before the first consumer mounts, which holds by
 * construction since plugin setup runs before any component or middleware.
 *
 * Build-time `tabsByFeature` is merged here at read time — page meta is only
 * available at build time, so tabs come from the auto-generated
 * `#pro-features/tabs` virtual.
 *
 * Aligns with `useLayerRegistry` (pro-saas) and the same pattern used by
 * `useSiteSurfaceRegistry`, `useOverviewGroupRegistry`, and `useOnboardingFlow`.
 */
const resolverMap = new WeakMap<object, Map<string, ProSiteFeature['stateResolver']>>()

function getResolverStore(nuxtApp: object): Map<string, ProSiteFeature['stateResolver']> {
  let store = resolverMap.get(nuxtApp)
  if (!store) {
    store = new Map()
    resolverMap.set(nuxtApp, store)
  }
  return store
}

export function useProFeatureRegistry() {
  const nuxtApp = useNuxtApp()
  const resolvers = getResolverStore(nuxtApp)

  const state = useState<ResolvedRegistry>('pro:feature:registry', () => {
    const features: Record<string, ProSiteFeature> = {}
    const chromeByFeature: Record<string, Component> = {}

    const registry: ProFeatureRegistry = {
      add(feature: ProFeatureRegistration) {
        if (features[feature.id]) {
          console.warn(`[pro:feature] duplicate id "${feature.id}" — ignored`)
          return
        }
        const { stateResolver, ...rest } = feature
        if (stateResolver)
          resolvers.set(feature.id, stateResolver)
        // Identity is a manifest fact. A registration contributes presentation
        // only, so the sidebar and the page header cannot name the same
        // surface differently.
        const entry = findProSiteFeatureEntry(feature.id)
        features[feature.id] = {
          ...rest,
          label: entry?.label ?? feature.id,
          icon: entry?.icon,
          route: entry?.route,
          integration: rest.integration ?? entry?.integration,
          tabs: (tabsByFeature as Record<string, ProSiteFeature['tabs']>)[feature.id] ?? [],
        }
      },
      addChrome(binding: ProFeatureChromeBinding) {
        const raw = markRaw(binding.component as object) as Component
        for (const id of binding.forFeatures)
          chromeByFeature[id] = raw
      },
    }

    try {
      nuxtApp.callHook('pro:feature', registry)
    }
    catch (e) {
      console.warn('[pro:feature:registry] contributor threw during fan-out', e)
    }

    return { features, chromeByFeature, topNavOrder: topNavOrder as string[] }
  })

  return {
    features: state.value.features,
    chromeByFeature: state.value.chromeByFeature,
    topNavOrder: state.value.topNavOrder,
    getFeature(id: string): ProSiteFeature | undefined {
      const feature = state.value.features[id]
      if (!feature)
        return undefined
      const resolver = resolvers.get(id)
      return resolver ? { ...feature, stateResolver: resolver } : feature
    },
    getChrome(id: string): Component | undefined {
      return state.value.chromeByFeature[id]
    },
  }
}
