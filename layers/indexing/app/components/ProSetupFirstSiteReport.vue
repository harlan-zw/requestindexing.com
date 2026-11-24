<script setup lang="ts">
import type { SiteFleetRow } from '~~/layers/core/app/types'
import { fetchSites } from '~~/layers/core/app/composables/fetch'
import { FIRST_REPORT_COPY as copy, defaultReportSite } from '#layers/indexing/shared/first-report'
import { SITE_SYNC_LABELS } from '#layers/pro-saas/shared/site-sync'
import ProFirstSiteReport from './ProFirstSiteReport.vue'

const { data } = await fetchSites()
const sites = computed(() => data.value?.sites ?? [])
// The reader's choice holds while that Site is listed. Otherwise the report
// opens on the Site most likely to have saved verdicts.
const chosenSiteId = ref<string>()
const selectedSite = computed(() => sites.value.find(site => site.siteId === chosenSiteId.value) ?? defaultReportSite(sites.value))
const selectedSiteId = computed({
  get: () => selectedSite.value?.siteId,
  set: (siteId) => {
    chosenSiteId.value = siteId
  },
})
const siteHost = (site: Pick<SiteFleetRow, 'domain' | 'property'>) => site.domain || site.property.replace(/^sc-domain:/, '')
const siteOptions = computed(() => sites.value.map(site => ({ value: site.siteId, label: siteHost(site) })))
</script>

<template>
  <!-- One panel, as nuxtseo.com shows its first Next Action and this app shows
       Agent setup. The header names the Site, and holds the Site choice when
       the Team has several. In dark mode the default border is the elevated
       surface's colour, so the panel takes the accented border. -->
  <div
    v-if="selectedSite"
    class="overflow-hidden rounded-(--ui-radius) border border-default bg-elevated shadow-(--elevation-raised) dark:border-accented"
  >
    <div class="flex min-h-12 items-center gap-2.5 border-b border-default px-4 py-1.5 dark:border-accented">
      <UiFavicon :domain="siteHost(selectedSite)" :size="16" decorative class="shrink-0 rounded-sm" />
      <div v-if="sites.length > 1" class="min-w-0 flex-1">
        <USelect
          v-model="selectedSiteId"
          :items="siteOptions"
          :aria-label="copy.site"
          variant="ghost"
          class="-ml-2.5 min-h-11 max-w-full text-sm/5 font-medium text-highlighted"
        />
      </div>
      <span v-else class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">{{ siteHost(selectedSite) }}</span>
      <span class="shrink-0 text-sm text-muted">{{ SITE_SYNC_LABELS[selectedSite.syncStatus] }}</span>
    </div>
    <ProFirstSiteReport :key="selectedSite.siteId" :site-id="selectedSite.siteId" />
  </div>
</template>
