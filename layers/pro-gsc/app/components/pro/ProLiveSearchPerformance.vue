<script setup lang="ts">
import type { AnalyticsRowsV1Request } from '@gscdump/contracts/v1/http'
import type { LiveSearchPerformanceInput } from '@gscdump/sdk/hosted-query'
import { liveSearchPerformanceRequest } from '@gscdump/sdk/hosted-query'
import { formatNumber } from '@nuxtseo/design-system/app/composables/formatting'
import { countryData } from '@nuxtseo/design-system/app/utils/countries'
import { computed, ref, watch } from 'vue'
import { UFormField, UiButton, UiSelect, UiTableShell, UiTableTd, UiTableTh, USelectMenu } from '#components'

const { gscPropertyUrl, range, loadRows } = defineProps<{
  gscPropertyUrl: string | null
  range: LiveSearchPerformanceInput['range']
  loadRows: (body: AnalyticsRowsV1Request) => Promise<Record<string, unknown>[]>
}>()

const searchTypes: { label: string, value: LiveSearchPerformanceInput['searchType'] }[] = [
  { label: 'Web', value: 'web' },
  { label: 'Web Multimodal', value: 'webMultimodal' },
]
const brandOptions: { label: string, value: LiveSearchPerformanceInput['brand'] }[] = [
  { label: 'All queries', value: 'all' },
  { label: 'Branded and non-branded queries', value: 'split' },
  { label: 'Branded queries', value: 'BRANDED' },
  { label: 'Non-branded queries', value: 'NON_BRANDED' },
]
const countryItems = Object.entries(countryData)
  .map(([value, country]) => ({ value, label: country.name }))
  .sort((a, b) => a.label.localeCompare(b.label))
const deviceItems: { label: string, value: LiveSearchPerformanceInput['devices'][number] }[] = [
  { label: 'Desktop', value: 'DESKTOP' },
  { label: 'Mobile', value: 'MOBILE' },
  { label: 'Tablet', value: 'TABLET' },
]

const searchType = ref<LiveSearchPerformanceInput['searchType']>('web')
const brand = ref<LiveSearchPerformanceInput['brand']>('all')
const usesBrandClassification = computed(() => searchType.value === 'web' && brand.value !== 'all')
const countries = ref<string[]>([])
const devices = ref<LiveSearchPerformanceInput['devices'][number][]>([])
const rows = ref<Record<string, unknown>[]>([])
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
let activeRun = 0

const reportRows = computed(() => {
  const totals = new Map<string, { clicks: number, impressions: number }>()
  for (const row of rows.value) {
    const label = row.brandedClassification === 'BRANDED'
      ? 'Branded queries'
      : row.brandedClassification === 'NON_BRANDED'
        ? 'Non-branded queries'
        : 'All queries'
    const total = totals.get(label) ?? { clicks: 0, impressions: 0 }
    total.clicks += Number(row.clicks)
    total.impressions += Number(row.impressions)
    totals.set(label, total)
  }
  return [...totals].map(([label, total]) => ({ label, ...total }))
})

watch([searchType, brand, countries, devices, () => range.start, () => range.end], () => {
  activeRun++
  status.value = 'idle'
  rows.value = []
}, { flush: 'sync' })

async function runReport() {
  const run = ++activeRun
  status.value = 'loading'
  try {
    const selection = searchType.value === 'webMultimodal'
      ? { searchType: 'webMultimodal', brand: 'all' } as const
      : { searchType: 'web', brand: brand.value } as const
    const response = await loadRows(liveSearchPerformanceRequest({
      ...selection,
      range,
      countries: countries.value,
      devices: devices.value,
    }))
    if (run === activeRun) {
      rows.value = response
      status.value = 'ready'
    }
  }
  catch {
    if (run === activeRun)
      status.value = 'error'
  }
}
</script>

<template>
  <details class="rounded-lg border border-default bg-default">
    <summary class="cursor-pointer px-4 py-3 text-sm font-semibold">
      Live Search Console report
    </summary>
    <div class="flex flex-col gap-4 px-4 pb-4">
      <dl v-if="gscPropertyUrl" class="flex flex-wrap gap-x-2 text-sm">
        <dt class="text-muted">
          Search Console property
        </dt>
        <dd class="break-all">
          {{ gscPropertyUrl }}
        </dd>
      </dl>
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <UFormField label="Search type">
          <UiSelect v-model="searchType" :items="searchTypes" class="w-full" />
        </UFormField>
        <UFormField v-if="searchType === 'web'" label="Queries">
          <UiSelect v-model="brand" :items="brandOptions" class="w-full" />
        </UFormField>
        <UFormField label="Countries">
          <USelectMenu v-model="countries" :items="countryItems" value-key="value" multiple placeholder="All countries" class="w-full" />
        </UFormField>
        <UFormField label="Devices">
          <USelectMenu v-model="devices" :items="deviceItems" value-key="value" multiple placeholder="All devices" class="w-full" />
        </UFormField>
      </div>
      <p v-if="usesBrandClassification" class="text-sm text-muted">
        Google classifies queries from 21 February 2026 for eligible top-level properties.
      </p>
      <UiButton type="button" label="Run report" :loading="status === 'loading'" class="self-start" @click="runReport" />
      <p v-if="status === 'error'" role="alert" class="text-sm text-error">
        Search Console could not load this report. Try again.
      </p>
      <p v-else-if="status === 'ready' && !reportRows.length" role="status" class="text-sm text-muted">
        <span class="block">Google returned no rows for these filters and dates.</span>
        <span v-if="usesBrandClassification" class="mt-1 block">
          Google only classifies queries for top-level properties with enough queries and impressions.
          Select All queries to check Web traffic for these filters and dates.
        </span>
      </p>
      <UiTableShell v-else-if="status === 'ready'" size="sm" label="Live Search Console results">
        <template #head>
          <UiTableTh>Queries</UiTableTh>
          <UiTableTh numeric>
            Clicks
          </UiTableTh>
          <UiTableTh numeric>
            Impressions
          </UiTableTh>
        </template>
        <tr v-for="row in reportRows" :key="row.label">
          <UiTableTd row-header size="sm">
            {{ row.label }}
          </UiTableTd>
          <UiTableTd numeric size="sm">
            {{ formatNumber(row.clicks) }}
          </UiTableTd>
          <UiTableTd numeric size="sm">
            {{ formatNumber(row.impressions) }}
          </UiTableTd>
        </tr>
      </UiTableShell>
    </div>
  </details>
</template>
