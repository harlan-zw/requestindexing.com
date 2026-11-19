<script setup lang="ts">
import type { BingDataV1 } from '@gscdump/contracts/v1/http'
import type { BingEntityKind } from '@nuxtseo/pro-search/shared/bing-performance'
import type { BingReportingWindow } from '#layers/pro-gsc/shared/bing-reporting-window'
import BingSearchPerformance from '@nuxtseo/pro-search/components/BingSearchPerformance.vue'
import { BING_PERFORMANCE_PAGE_SIZE } from '@nuxtseo/pro-search/shared/bing-performance'
import { ref } from 'vue'
import { useProGscdumpBingData } from '#layers/pro-gsc/app/composables/useProGscdump'

const { data, siteId, window } = defineProps<{
  data: Extract<BingDataV1, { dataset: 'traffic' }>
  siteId: string
  window: BingReportingWindow
}>()

const entityKind = ref<BingEntityKind>('pages')
const page = ref(1)
const entities = useProGscdumpBingData(() => siteId, {
  dataset: entityKind,
  window: () => window,
  limit: BING_PERFORMANCE_PAGE_SIZE,
  offset: () => (page.value - 1) * BING_PERFORMANCE_PAGE_SIZE,
})
</script>

<template>
  <BingSearchPerformance
    v-model:entity-kind="entityKind"
    v-model:page="page"
    :data="data"
    :start-date="window.startDate"
    :end-date="window.endDate"
    :entities="entities.data.value ?? null"
    :pending="entities.status.value === 'pending'"
    :error="!!entities.error.value"
    @retry="entities.refresh"
  />
</template>
