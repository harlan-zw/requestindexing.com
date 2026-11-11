// Request Indexing's brand over `@nuxtseo/design-system` (DESIGN.md: Verdant
// Console). Nuxt merges every app.config with `defuFn`, so this file merges
// over the layer's `app/app.config.ts`. Arrays concatenate. A function receives
// the layer's value and returns the merged one.

interface ButtonCompoundVariant {
  color?: string
  variant?: string
  class?: string
}

export default defineAppConfig({
  ui: {
    colors: {
      primary: 'emerald',
      neutral: 'olive',
      // The layer reserves `pro` for Nuxt SEO's violet purchase moments. Request
      // Indexing has no purchase moment, so `pro` reads as the primary.
      pro: 'emerald',
    },
    button: {
      // The layer inverts the primary button to near-black and turns its
      // subtle, soft, outline and ghost variants monochrome, which keeps
      // Nuxt SEO's violet off its CTAs. Request Indexing's primary button is
      // emerald solid (DESIGN.md `button-primary`), so it drops those variants
      // and keeps Nuxt UI's own primary styling.
      compoundVariants: ((layer: ButtonCompoundVariant[]) => layer.filter(entry => entry.color !== 'primary' && entry.color !== 'pro')) as unknown as ButtonCompoundVariant[],
    },
  },

  designSystem: {
    // The warm green that replaces violet in the data-viz ramp.
    iconColors: {
      lime: { bg: 'bg-lime-500/10', text: 'text-lime-500' },
    },
  },

  // The layer's favicon plugin reads these. The layer ships Nuxt SEO's mark at
  // the same paths in its public/, and `apps/marketing/public` shadows every
  // one with Request Indexing's mark. `layers/core/app/app.vue` then replaces
  // the PNG icon link with the theme-aware SVG mark.
  favicon: {
    light: '/favicon-light.png',
    dark: '/favicon-dark.png',
    appleTouchLight: '/touch-icon.png',
    appleTouchDark: '/touch-icon-dark.png',
  },
})
