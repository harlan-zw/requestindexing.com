import { ref } from 'vue'

// `#imports` is a Nuxt build alias. A vitest run has no Nuxt, so vitest.config
// resolves it here instead: the few Nuxt runtime helpers a unit under test
// reaches, in a shape a test can drive.

/** The theme a test renders in. `useColorMode()` reads it, as Nuxt's does. */
export const colorMode = ref<'light' | 'dark'>('light')

export function useColorMode() {
  return colorMode
}
