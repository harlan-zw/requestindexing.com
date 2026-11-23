<script setup lang="ts">
import { fetchSites } from '~~/layers/core/app/composables/fetch'
import { FIRST_REPORT_COPY as copy } from '#layers/indexing/shared/first-report'
import { SITE_SYNC_LABELS } from '#layers/pro-saas/shared/site-sync'
import ProFirstSiteReport from './ProFirstSiteReport.vue'

const { data } = await fetchSites()
const sites = computed(() => data.value?.sites ?? [])
const selectedSiteId = ref<string>()
const selectedSite = computed(() => sites.value.length === 1
  ? sites.value[0]
  : sites.value.find(site => site.siteId === selectedSiteId.value))
const selectedHost = computed(() => selectedSite.value?.domain || selectedSite.value?.property.replace(/^sc-domain:/, ''))
const siteOptions = computed(() => sites.value.map(site => ({
  value: site.siteId,
  label: site.domain || site.property.replace(/^sc-domain:/, ''),
})))
</script>

<template>
  <div v-if="sites.length" class="space-y-4">
    <UFormField v-if="sites.length > 1" :label="copy.site" :description="selectedSite ? undefined : copy.siteHelp">
      <USelect v-model="selectedSiteId" :items="siteOptions" :placeholder="copy.chooseSite" class="min-h-11 w-full" />
    </UFormField>
    <div v-if="selectedSite" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span v-if="sites.length === 1" class="break-all font-medium text-highlighted">{{ selectedHost }}</span>
      <span class="text-muted">{{ SITE_SYNC_LABELS[selectedSite.syncStatus] }}</span>
    </div>
    <ProFirstSiteReport v-if="selectedSite" :key="selectedSite.siteId" :site-id="selectedSite.siteId" />
  </div>
</template>
