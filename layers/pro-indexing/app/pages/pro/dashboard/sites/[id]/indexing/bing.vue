<script lang="ts" setup>
// Bing indexing: the connection state for this Site, the CNAME verification
// step, the sitemap Bing lists, Bing's own crawl activity, and its per-URL
// crawl details. Reachable only while `NUXT_PUBLIC_FEATURES_BING` is on
// (`pro-feature-flag.global.ts`).
//
// Ported from nuxtseo.com `indexing/bing.vue`. Every read and action is a
// gscdump partner v1 operation through the browser proxy, including
// `partner.sites.indexing.bing.evidence.list` for the crawl details. Linking
// and the Microsoft round trip live on Integrations, where one grant serves
// every Site, so this page links there rather than repeat them.
import type { BingConnectionV1 } from '@gscdump/contracts/v1/http'
import type { BingCrawlDetailView } from '#layers/pro-gsc/app/utils/bing-view'
import { siteLabel } from '#layers/design-system/app/composables/formatting'
import { useProGscdumpBingConnection, useProGscdumpBingData, useProGscdumpBingEvidence } from '#layers/pro-gsc/app/composables/useProGscdump'
import ProBingCrawlStats from '#layers/pro-gsc/app/internal/components/bing/ProBingCrawlStats.vue'
import ProBingSitemap from '#layers/pro-gsc/app/internal/components/bing/ProBingSitemap.vue'
import ProBingVerification from '#layers/pro-gsc/app/internal/components/bing/ProBingVerification.vue'
import {
  BING_CRAWL_DETAILS_PAGE_SIZE,
  bingConnectionSetupState,
  bingCrawlDetailsPageCount,
  bingRequestErrorState,
  parseBingCrawlDetailsPage,
  toBingConnectionView,
  toBingCrawlDetailViews,
} from '#layers/pro-gsc/app/utils/bing-view'
import { BING_REPORTING_WINDOW_DAYS, bingReportingWindow } from '#layers/pro-gsc/shared/bing-reporting-window'
import { INTEGRATIONS_ROUTE } from '#layers/pro-shell/app/utils/integrations-pending'

definePageMeta({
  proTab: { feature: 'indexing', label: 'Bing', icon: 'i-lucide-search-check', order: 50 },
  title: 'Bing indexing',
  icon: 'i-lucide-search-check',
})

const route = useRoute()
const { gscdumpSiteId, site } = useSite('Bing indexing')

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
const integrationsPath = `${INTEGRATIONS_ROUTE}#bing`

const window = useState('pro-gsc:bing-window', () => bingReportingWindow(new Date()))
const crawlQuery = useProGscdumpBingData(gscdumpSiteId, {
  dataset: 'crawl',
  window,
  limit: BING_REPORTING_WINDOW_DAYS,
  enabled: canRead,
})
const crawl = computed(() => crawlQuery.data.value?.dataset === 'crawl' ? crawlQuery.data.value : null)

// Per-URL crawl details, one page at a time. The page number lives in the
// query so a reload or a shared link keeps it.
const currentPage = computed(() => parseBingCrawlDetailsPage(route.query.bingPage))
const evidenceOffset = computed(() => (currentPage.value - 1) * BING_CRAWL_DETAILS_PAGE_SIZE)
const evidenceQuery = useProGscdumpBingEvidence(gscdumpSiteId, {
  limit: BING_CRAWL_DETAILS_PAGE_SIZE,
  offset: evidenceOffset,
  enabled: canRead,
})
const rows = computed(() => toBingCrawlDetailViews(evidenceQuery.data.value?.indexingEvidence ?? []))
const evidencePagination = computed(() => evidenceQuery.data.value?.pagination)
const evidenceTotal = computed(() => evidencePagination.value?.total ?? 0)
const pageCount = computed(() => bingCrawlDetailsPageCount(evidenceTotal.value))
const rangeStart = computed(() => rows.value.length ? (evidencePagination.value?.offset ?? evidenceOffset.value) + 1 : 0)
const rangeEnd = computed(() => Math.min(evidenceTotal.value, rangeStart.value + rows.value.length - 1))
const evidenceErrorState = computed(() => bingRequestErrorState(evidenceQuery.error.value))

function updatePage(nextPage: number, replace = false) {
  const query = { ...route.query }
  if (nextPage > 1)
    query.bingPage = String(nextPage)
  else
    delete query.bingPage
  void navigateTo({ path: route.path, query }, replace ? { replace: true } : undefined)
}

const paginationPage = computed({
  get: () => currentPage.value,
  set: (nextPage: number) => updatePage(nextPage),
})

// A page past the end, from an old link or a shrunk list, moves to the last
// page. Only a real page counts: the query also settles with no data while the
// connection read is in flight, and that must not reset `bingPage`.
watch([evidencePagination, pageCount], ([pagination, count]) => {
  if (pagination && currentPage.value > count)
    updatePage(count, true)
})

function rowLabel(row: BingCrawlDetailView): string {
  const path = URL.parse(row.url)?.pathname ?? row.url
  return path === '/' ? '/' : path.replace(/\/$/, '')
}

function observed(row: BingCrawlDetailView) {
  return row._tag === 'observed' ? row : null
}

const showOriginStatus = computed(() => rows.value.some(row => observed(row)?.originHttpStatus != null))

// Search Console links the Site to gscdump, and Bing reads through the same
// link. Say so rather than render an empty page while it is still pending.
const linked = computed(() => !!gscdumpSiteId.value)
const name = computed(() => (site.value ? siteLabel(site.value) : '') || 'this Site')

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
      >
        <UiButton :to="integrationsPath" purpose="cta">
          Open Integrations
        </UiButton>
      </UiEmptyState>

      <div v-else-if="canRead && gscdumpSiteId" class="flex flex-col gap-6">
        <ProBingSitemap :site-id="gscdumpSiteId" :team-id="site?.teamId" :site-name="name" />

        <ProPageStates
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

        <section>
          <UiSectionHeader
            title="Bing crawl details"
            :badge="evidencePagination?.total"
            tooltip="Bing reports when it discovered and last crawled each URL. It does not report whether a URL is indexed."
          />
          <UiWidgetState
            class="mt-3"
            :status="evidenceQuery.status.value"
            :error="evidenceQuery.error.value"
            :empty="evidenceQuery.status.value === 'success' && rows.length === 0"
            :skeleton-lines="8"
            empty-icon="search"
            empty-title="No Bing crawl details yet"
            empty-message="Collection runs once a day. Rows appear after Bing returns the first observation."
            @retry="evidenceQuery.refresh"
          >
            <template #error>
              <UiAlert
                status="error"
                :title="evidenceErrorState.title"
                :description="evidenceErrorState.description"
              >
                <template #action>
                  <UiButton purpose="secondary" size="xs" @click="() => evidenceQuery.refresh()">
                    Retry
                  </UiButton>
                </template>
              </UiAlert>
            </template>

            <UiDataTableSection
              v-model:page="paginationPage"
              :rows="rows"
              :total="evidenceTotal"
              :columns="[]"
              :page-size="BING_CRAWL_DETAILS_PAGE_SIZE"
              :searchable="false"
              item-label="crawl details"
              label="Bing crawl details"
            >
              <template #body>
                <UiTableShell bordered row-hover size="xs" label="Bing crawl details">
                  <template #head>
                    <UiTableTh>URL</UiTableTh>
                    <UiTableTh visible-from="md">
                      Discovered
                    </UiTableTh>
                    <UiTableTh>Last crawl</UiTableTh>
                    <UiTableTh v-if="showOriginStatus" numeric visible-from="lg">
                      Origin HTTP
                    </UiTableTh>
                    <UiTableTh>Freshness</UiTableTh>
                    <UiTableTh visible-from="lg">
                      Last observed
                    </UiTableTh>
                  </template>
                  <tr v-for="row in rows" :key="row.url">
                    <UiTableTd row-header class="max-w-0 w-full">
                      <a
                        :href="row.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="block truncate text-default hover:text-highlighted transition-colors"
                        :title="row.url"
                      >
                        {{ rowLabel(row) }}
                      </a>
                      <span v-if="row.detail" class="mt-0.5 block truncate text-muted">
                        {{ row.detail }}
                      </span>
                    </UiTableTd>
                    <UiTableTd visible-from="md" class="whitespace-nowrap text-muted">
                      <UiRelativeTime :date="observed(row)?.discoveryTime" fallback="Unknown" />
                    </UiTableTd>
                    <UiTableTd class="whitespace-nowrap text-muted">
                      <UiRelativeTime :date="observed(row)?.lastCrawlTime" fallback="Unknown" />
                    </UiTableTd>
                    <UiTableTd v-if="showOriginStatus" numeric visible-from="lg" class="text-muted">
                      {{ observed(row)?.originHttpStatus ?? 'Unknown' }}
                    </UiTableTd>
                    <UiTableTd>
                      <UiStatusBadge v-bind="row.badge" />
                    </UiTableTd>
                    <UiTableTd visible-from="lg" class="whitespace-nowrap text-muted">
                      <UiRelativeTime :date="row.observedAt" />
                    </UiTableTd>
                  </tr>
                </UiTableShell>
              </template>

              <template #pagination-leading>
                <span class="tabular-nums">
                  {{ rangeStart }} to {{ rangeEnd }} of {{ evidenceTotal }}
                </span>
              </template>
            </UiDataTableSection>
          </UiWidgetState>
        </section>
      </div>
    </ProPageStates>
  </div>
</template>
