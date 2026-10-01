<script lang="ts" setup>
import type { GscdumpDataRow } from '#layers/pro-gsc/app/composables/useProGscdump'
import { computed } from 'vue'
import ProGscCountryOpportunity from '#layers/pro-gsc/app/components/pro/ProGscCountryOpportunity.vue'
import ProGscSurfaceBar from '#layers/pro-gsc/app/components/pro/ProGscSurfaceBar.vue'
import { useProGscdumpTableData } from '#layers/pro-gsc/app/composables/useProGscdump'
import { useProGscFilters } from '#layers/pro-gsc/app/composables/useProGscFilters'
import ProTableCountries from '#layers/pro-gsc/app/internal/components/pro/ProTableCountries.vue'

definePageMeta({
  proTab: { feature: 'search-console', label: 'Countries', icon: 'i-lucide-globe', order: 30 },
  title: 'Countries',
  icon: 'i-lucide-globe',
})

const { siteStatus, gscdumpSiteId, siteId } = useSite('Countries')
const { period } = useSitePeriod()

// Country opportunity scatter: reach against CTR, sized by clicks. Fed from
// the same control-bar-synced filters as the table below it, but over a wider
// top-100 window so the plot is not just the table's first page.
const { period: gscPeriod, stableData, compareMode } = useProGscFilters()
const { rows: countryRows, isLoading: countriesLoading, error: countriesError } = useProGscdumpTableData<GscdumpDataRow>({
  siteId: computed(() => gscdumpSiteId.value ?? undefined),
  dimension: 'country',
  period: gscPeriod,
  stableData,
  compareMode,
  pageSize: 100,
  defaultSort: { column: 'clicks', direction: 'desc' },
})
const scatterRows = computed(() => countryRows.value.map(r => ({
  country: r.country ?? '',
  clicks: r.clicks ?? 0,
  impressions: r.impressions ?? 0,
  ctr: r.ctr ?? 0,
  position: r.position ?? 0,
})))
</script>

<template>
  <UiAlert
    v-if="siteStatus === 'error'"
    status="error"
    title="Failed to load Site data."
  >
    <template #action>
      <UiButton size="xs" purpose="secondary" to="/pro/dashboard">
        Back to Sites
      </UiButton>
    </template>
  </UiAlert>

  <div v-else data-testid="search-console-countries-page" class="flex flex-col gap-5">
    <ProGscSurfaceBar surface="countries" :site-id="siteId" />

    <ProPageZone tier="primary" first>
      <ProSectionHeader
        title="Country opportunity"
        icon="i-lucide-globe"
        tooltip="Reach against click-through rate, sized by clicks. Lower-right countries get seen but rarely clicked."
      />
      <ProGscCountryOpportunity
        :rows="scatterRows"
        :loading="countriesLoading"
        :error="!!countriesError"
      />
    </ProPageZone>

    <ProPageZone tier="secondary">
      <ProSectionHeader
        title="Countries"
        icon="i-lucide-globe"
        tooltip="Where your search traffic comes from, based on the searcher's location."
      />
      <ProTableCountries
        :gscdump-site-id="gscdumpSiteId"
        :period="period"
        :page-size="25"
      />
    </ProPageZone>
  </div>
</template>
