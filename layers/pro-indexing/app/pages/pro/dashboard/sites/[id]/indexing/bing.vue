<script lang="ts" setup>
// Bing indexing: the connection state for this Site, the CNAME verification
// step, and Bing's own crawl activity once it reports. Reachable only while
// `NUXT_PUBLIC_FEATURES_BING` is on (`pro-feature-flag.global.ts`).
//
// Ported from nuxtseo.com `indexing/bing.vue`. Two things upstream shows are
// absent here: the OAuth connect round trip and the per-URL crawl-details
// table. gscdump's partner v1 protocol has no connect operation yet, so the
// page says connecting is not available rather than offer a button that leads
// nowhere. The table would read `partner.sites.indexing.bing.evidence.list`,
// which the browser proxy does not allow yet.
import type { BingConnectionV1 } from '@gscdump/contracts/v1/http'
import { useProGscdumpBingConnection, useProGscdumpBingData } from '#layers/pro-gsc/app/composables/useProGscdump'
import ProBingCrawlStats from '#layers/pro-gsc/app/internal/components/bing/ProBingCrawlStats.vue'
import ProBingVerification from '#layers/pro-gsc/app/internal/components/bing/ProBingVerification.vue'
import { bingConnectionSetupState, bingRequestErrorState, toBingConnectionView } from '#layers/pro-gsc/app/utils/bing-view'
import { BING_REPORTING_WINDOW_DAYS, bingReportingWindow } from '#layers/pro-gsc/shared/bing-reporting-window'

definePageMeta({
  proTab: { feature: 'indexing', label: 'Bing', icon: 'i-lucide-search-check', order: 50 },
  title: 'Bing indexing',
  icon: 'i-lucide-search-check',
})

const { gscdumpSiteId } = useSite('Bing indexing')

const connectionQuery = useProGscdumpBingConnection(gscdumpSiteId)
// A successful verification answers with the new state, so render that instead
// of waiting for the next connection read to land.
const connectionOverride = ref<BingConnectionV1 | null>(null)
const connectionState = computed(() => connectionOverride.value ?? connectionQuery.data.value ?? null)
const connection = computed(() => connectionState.value ? toBingConnectionView(connectionState.value) : null)
const verificationConnection = computed(() => connection.value?._tag === 'verification-required'
  ? connection.value
  : null)
const canRead = computed(() => connection.value?._tag === 'ready')
const setupState = computed(() => connection.value ? bingConnectionSetupState(connection.value) : null)
const connectionError = computed(() => bingRequestErrorState(connectionQuery.error.value))

const window = useState('pro-gsc:bing-window', () => bingReportingWindow(new Date()))
const crawlQuery = useProGscdumpBingData(gscdumpSiteId, {
  dataset: 'crawl',
  window,
  limit: BING_REPORTING_WINDOW_DAYS,
  enabled: canRead,
})
const crawl = computed(() => crawlQuery.data.value?.dataset === 'crawl' ? crawlQuery.data.value : null)

// Search Console links the Site to gscdump, and Bing reads through the same
// link. Say so rather than render an empty page while it is still pending.
const linked = computed(() => !!gscdumpSiteId.value)

function handleVerificationChecked(next: BingConnectionV1) {
  connectionOverride.value = next
  if (next._tag === 'connected')
    void connectionQuery.refresh()
}
</script>

<template>
  <div data-testid="indexing-bing-page" class="flex flex-col gap-5">
    <UiEmptyState
      v-if="!linked"
      icon="search"
      title="Bing is waiting on Search Console"
      description="Search Console must finish linking this Site before Bing can report on it."
      heading-tag="h2"
      :animated="false"
    />

    <ProPageStates
      v-else
      :status="connectionQuery.status.value"
      :error="connectionQuery.error.value"
      @retry="connectionQuery.refresh"
    >
      <template #error>
        <UiAlert
          status="error"
          :title="connectionError.title"
          :description="connectionError.description"
        >
          <template #action>
            <UiButton purpose="secondary" size="xs" @click="() => connectionQuery.refresh()">
              Retry
            </UiButton>
          </template>
        </UiAlert>
      </template>

      <ProBingVerification
        v-if="verificationConnection && gscdumpSiteId"
        :site-id="gscdumpSiteId"
        :connection="connectionState as Extract<BingConnectionV1, { _tag: 'verification-required' }>"
        @checked="handleVerificationChecked"
      />

      <UiEmptyState
        v-else-if="setupState"
        :icon="setupState.icon"
        :title="setupState.title"
        :description="setupState.description"
        heading-tag="h2"
        :animated="false"
      />

      <ProPageStates
        v-else-if="canRead"
        :status="crawlQuery.status.value"
        :error="crawlQuery.error.value"
        :empty="crawlQuery.status.value === 'success' && !crawl?.rows.length"
        empty-icon="search"
        empty-title="No Bing crawl activity yet"
        empty-message="The first collection runs with the next daily sync."
        @retry="crawlQuery.refresh"
      >
        <ProBingCrawlStats v-if="crawl?.rows.length" :data="crawl" />
      </ProPageStates>
    </ProPageStates>
  </div>
</template>
