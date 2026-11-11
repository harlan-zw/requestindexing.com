import { join, resolve } from 'node:path'

const currentDir = import.meta.dirname

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
  // either family. The layer registers its Hubot Sans and Fira Code only with
  // `designSystem.fonts`, which stays off.
  fonts: {
    families: [
      { name: 'DM Sans', weights: [400, 500, 600, 700], global: true },
      { name: 'Poppins', weights: [600, 700], global: true },
    ],
  },

  designSystem: {
    // A prose link to Request Indexing itself gets no external-link arrow.
    internalLinkHosts: ['requestindexing.com', 'www.requestindexing.com'],
  },

  hooks: {
    'nitro:config': function (config) {
      config.typescript = config.typescript || {}
      config.typescript.tsConfig = config.typescript.tsConfig || {}
      config.typescript.tsConfig.include = config.typescript.tsConfig.include || []
      config.typescript.tsConfig.include.push(resolve(__dirname, './server/hooks.d.ts'))
    },
  },
})
