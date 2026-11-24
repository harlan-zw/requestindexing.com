<script lang="ts" setup>
import { readSiteRouteId, SITES_ROUTE } from '#layers/pro-saas/shared/site-lookup'

// A site has no landing page of its own yet, so `/pro/dashboard/sites/:id`
// opens the first feature instead of 404ing. The nav manifest (phase 5) is
// what decides which feature that is; until then Search Console is it.
definePageMeta({
  middleware: [
    (to) => {
      const id = readSiteRouteId(to.params)
      return navigateTo(id ? `${SITES_ROUTE}/${encodeURIComponent(id)}/search-console` : SITES_ROUTE, { replace: true })
    },
  ],
})
</script>

<template>
  <div />
</template>
