import type { Plugin } from '#app'
import { readProFeatureFlags } from '#layers/pro-features/shared/manifest'
import { proSitePalettePages } from '../utils/pro-command-palette'

// Sets `proShell.sitePages`, the Site pages the command palette lists per
// Site. The list depends on the runtime feature flags, so app.config cannot
// hold it: a flagged row (Bing) stays out while its flag is off. The server
// clones app.config per request, so this never leaks between requests.
//
// Annotated: the plugin types read the hooks it augments.
const plugin: Plugin = defineNuxtPlugin({
  name: 'request-indexing:pro-shell-site-pages',
  setup() {
    updateAppConfig({ proShell: { sitePages: proSitePalettePages(readProFeatureFlags(useRuntimeConfig().public)) } })
  },
})
export default plugin
