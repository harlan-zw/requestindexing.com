import type { ProFeatureRegistry } from '../../shared/types'

/**
 * Declares the `pro:feature` Nuxt Layer Hook contract. The registry itself
 * is built lazily by `useProFeatureRegistry()` (in
 * `app/composables/useProFeatureRegistry.ts`) on first read. Layer plugins
 * register listeners in their own `app/plugins/pro-feature.ts`.
 *
 * Kept as a plugin file so the runtime hook augmentation is loaded with the
 * pro-features layer.
 */
export default defineNuxtPlugin({
  name: 'pro-features:feature-registry',
})

declare module '#app' {
  interface RuntimeNuxtHooks {
    'pro:feature': (registry: ProFeatureRegistry) => void | Promise<void>
  }
}
