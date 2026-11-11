import { join, resolve } from 'node:path'
import { useNuxt } from 'nuxt/kit'

const currentDir = import.meta.dirname

const LAYER_ONLY_FONTS = new Set(['Hubot Sans', 'Fira Code'])

export default defineNuxtConfig({
  // Request Indexing's brand over `@nuxtseo/design-system`. The layer's
  // `css/global.css` loads first; this file overrides its tokens.
  css: [join(currentDir, './app/assets/css/brand.css')],

  // nuxt-og-image compiles OG images against this Tailwind entry instead of
  // the layer's, so they render in the site's fonts. See og-theme.css.
  alias: {
    '#tailwindcss': join(currentDir, './app/assets/css/og-theme.css'),
  },

  // DM Sans carries body copy, Poppins the display scale (DESIGN.md). Both
  // come from the provider: this repository ships no self-hosted faces for
  // either family. The layer's Hubot Sans and Fira Code stay declared.
  fonts: {
    families: [
      { name: 'DM Sans', weights: [400, 500, 600, 700], global: true },
      { name: 'Poppins', weights: [600, 700], global: true },
    ],
  },

  hooks: {
    // The layer declares Hubot Sans and Fira Code as global families, so
    // @nuxt/fonts preloads both on every page. No token here points at either
    // family, so drop them before @nuxt/fonts reads its options.
    'modules:before': function () {
      const nuxt = useNuxt()
      const families = nuxt.options.fonts?.families
      if (families)
        nuxt.options.fonts.families = families.filter(family => !LAYER_ONLY_FONTS.has(family.name))
    },
    'nitro:config': function (config) {
      config.typescript = config.typescript || {}
      config.typescript.tsConfig = config.typescript.tsConfig || {}
      config.typescript.tsConfig.include = config.typescript.tsConfig.include || []
      config.typescript.tsConfig.include.push(resolve(__dirname, './server/hooks.d.ts'))
    },
  },
})
