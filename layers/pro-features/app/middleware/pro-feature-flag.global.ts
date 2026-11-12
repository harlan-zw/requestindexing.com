// Closes every route the manifest declares behind a runtime flag.
//
// A flagged row has no sidebar entry while its flag is off (`useProSiteNav`),
// but a hidden row is not a closed route: the path still resolves, and a
// bookmark or a guessed URL reaches the page. This answers 404 there, so "not
// shipped" means the same thing to the sidebar and to the address bar.
//
// The match comes from the manifest, not from page meta, so a new flagged
// surface is closed the moment it is declared. Follows nuxtseo.com's
// `bing-indexing-preview` middleware, which throws the same 404.

import { readProFeatureFlags, requiredProFeatureFlag } from '../../shared/manifest'

export default defineNuxtRouteMiddleware((to) => {
  const flag = requiredProFeatureFlag(to.path)
  if (!flag)
    return

  const flags = readProFeatureFlags(useRuntimeConfig().public)
  if (!flags[flag])
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
})
