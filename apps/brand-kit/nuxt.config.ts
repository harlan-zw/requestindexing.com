export default defineNuxtConfig({
  extends: [
    '../../layers/core',
    '@nuxtseo/design-system',
  ],
  routeRules: {
    '/kit/**': { robots: false, prerender: false },
  },
})
