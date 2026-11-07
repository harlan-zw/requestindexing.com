<script setup lang="ts">
import { fetchSites } from '~~/layers/core/app/composables/fetch'

const { data } = await fetchSites()
const singleSite = computed(() => data.value?.sites.length === 1 ? data.value.sites[0] : null)
</script>

<template>
  <ProFirstSiteReport v-if="singleSite" :site-id="singleSite.siteId" />
</template>
