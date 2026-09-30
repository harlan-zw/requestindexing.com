<script lang="ts" setup>
import { useProGscdumpBingConnection, useProGscdumpBingData } from '#layers/pro-gsc/app/composables/useProGscdump'
// Bing Search Performance. Reachable only while `NUXT_PUBLIC_FEATURES_BING` is
// on: `pro-feature-flag.global.ts` answers 404 otherwise, and the sidebar row
// is absent for the same reason.
//
// Bing's reporting window is its own: it returns one row per provider date and
// caps a request at 366 of them, so this page does not read the shared Search
// Console period.
import ProBingSearchPerformance from '#layers/pro-gsc/app/internal/components/bing/ProBingSearchPerformance.vue'
import { bingConnectionSetupState, bingRequestErrorState, toBingConnectionView } from '#layers/pro-gsc/app/utils/bing-view'
import { BING_REPORTING_WINDOW_DAYS, bingReportingWindow } from '#layers/pro-gsc/shared/bing-reporting-window'
import { INTEGRATIONS_ROUTE } from '#layers/pro-shell/app/utils/integrations-pending'

definePageMeta({
  proTab: { feature: 'search-console', label: 'Bing', icon: 'i-lucide-search-check', order: 40 },
  title: 'Bing Search Performance',
  icon: 'i-lucide-search-check',
})

const { siteId, gscdumpSiteId } = useSite('Bing')

const connectionQuery = useProGscdumpBingConnection(gscdumpSiteId)
const connection = computed(() => connectionQuery.data.value
  ? toBingConnectionView(connectionQuery.data.value)
  : null)
const setupState = computed(() => connection.value ? bingConnectionSetupState(connection.value) : null)
const canRead = computed(() => connection.value?._tag === 'ready')
const connectionError = computed(() => bingRequestErrorState(connectionQuery.error.value))

// One window for the page lifetime, so the traffic chart and the breakdown
// table below it always describe the same dates.
const window = useState('pro-gsc:bing-window', () => bingReportingWindow(new Date()))

const trafficQuery = useProGscdumpBingData(gscdumpSiteId, {
  dataset: 'traffic',
  window,
  limit: BING_REPORTING_WINDOW_DAYS,
  enabled: canRead,
})
const traffic = computed(() => trafficQuery.data.value?.dataset === 'traffic' ? trafficQuery.data.value : null)

const indexingBingPath = computed(() => `/pro/dashboard/sites/${encodeURIComponent(siteId.value)}/indexing/bing`)
// The CNAME step lives on Bing indexing. Linking and reconnecting live on
// Integrations, where one Bing grant serves every Site.
const setupAction = computed(() => connection.value?._tag === 'verification-required'
  ? { to: indexingBingPath.value, label: 'Open Bing indexing' }
  : { to: `${INTEGRATIONS_ROUTE}#bing`, label: 'Open Integrations' })

// Search Console links the Site to gscdump, and Bing reads through the same
// link. Say so rather than render an empty page while it is still pending.
const linked = computed(() => !!gscdumpSiteId.value)
</script>

<template>
  <div data-testid="search-console-bing-page" class="flex flex-col gap-5">
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

      <UiEmptyState
        v-if="setupState"
        :icon="setupState.icon"
        :title="setupState.title"
        :description="setupState.description"
        heading-tag="h2"
        :animated="false"
      >
        <UiButton :to="setupAction.to" purpose="cta">
          {{ setupAction.label }}
        </UiButton>
      </UiEmptyState>

      <ProPageStates
        v-else-if="canRead"
        :status="trafficQuery.status.value"
        :error="trafficQuery.error.value"
        :empty="trafficQuery.status.value === 'success' && !traffic"
        empty-icon="search"
        empty-title="No Bing Search Performance yet"
        empty-message="The first collection runs with the next daily sync."
        @retry="trafficQuery.refresh"
      >
        <ProBingSearchPerformance
          v-if="traffic && gscdumpSiteId"
          :data="traffic"
          :site-id="gscdumpSiteId"
          :window="window"
        />
      </ProPageStates>
    </ProPageStates>
  </div>
</template>
