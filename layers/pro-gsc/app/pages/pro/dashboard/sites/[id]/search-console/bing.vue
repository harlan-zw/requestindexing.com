<script setup lang="ts">
import { readSiteRouteId, SITES_ROUTE } from '#layers/pro-saas/shared/site-lookup'

definePageMeta({
  middleware: (to) => {
    const id = readSiteRouteId(to.params)
    return navigateTo({
      path: id ? `${SITES_ROUTE}/${encodeURIComponent(id)}/webmaster-tools` : SITES_ROUTE,
      query: to.query,
      hash: to.hash,
    }, { redirectCode: 301 })
  },
})
</script>

<template>
  <div />
</template>
