<script lang="ts" setup>
import { computed } from 'vue'
import ProCardGsc from '#layers/pro-gsc/app/components/pro/ProCardGsc.vue'
import ProGscReadError from '#layers/pro-gsc/app/components/pro/ProGscReadError.vue'
import ProGscSurfaceBar from '#layers/pro-gsc/app/components/pro/ProGscSurfaceBar.vue'
import { useProGscdumpDates } from '#layers/pro-gsc/app/composables/useProGscdump'
import { useProGscFilters } from '#layers/pro-gsc/app/composables/useProGscFilters'
import ProTableKeywords from '#layers/pro-gsc/app/internal/components/pro/ProTableKeywords.vue'
import { pageDetailHeader } from '#layers/pro-gsc/app/utils/detail-header'
import { decodeRouteParam } from '#layers/pro-gsc/shared/route-params'

// Page detail, ported from nuxtseo.com's `pages/[...page].vue`: the page's own
// daily trend, then the keywords that rank for it.

// The page path and a crumb back to Pages live in the shared page header.
definePageMeta({ proHeader: pageDetailHeader })

const { siteId, site, siteStatus, isReady, isNotConnected, gscdumpSiteId } = useSite()

const route = useRoute()
const pageUrl = computed(() => decodeRouteParam(route.params.page))

const pagePath = computed(() => {
  if (!pageUrl.value?.startsWith('http'))
    return pageUrl.value
  return new URL(pageUrl.value).pathname
})

const pageFullUrl = computed(() => {
  if (pageUrl.value?.startsWith('http'))
    return pageUrl.value
  const base = site.value?.url || ''
  const origin = base.startsWith('http') ? base : `https://${base}`
  return `${origin.replace(/\/$/, '')}${pageUrl.value}`
})

useSeoMeta({ title: () => pagePath.value || 'Page' })

const { period, columns, stableData, compareMode, zoomTo, resetZoom } = useProGscFilters()

function onZoom(range: { start: string, end: string } | null) {
  if (range)
    zoomTo(range)
  else
    resetZoom()
}

const { data: pageDates, error: pageDatesError } = useProGscdumpDates(
  computed(() => gscdumpSiteId.value ?? ''),
  period,
  {
    stableData,
    compareMode,
    filter: computed(() => ({ column: 'page' as const, value: pageUrl.value ?? '' })),
  },
)

const pagesHref = computed(() => `/pro/dashboard/sites/${siteId.value}/search-console/pages`)
</script>

<template>
  <UiAlert
    v-if="siteStatus === 'error'"
    status="error"
    title="Failed to load site data."
  >
    <template #action>
      <UiButton size="xs" purpose="secondary" :to="pagesHref">
        Back to Pages
      </UiButton>
    </template>
  </UiAlert>

  <div v-else data-testid="search-console-page-detail" class="flex flex-col gap-5">
    <div class="flex items-center justify-end">
      <UiButton
        :href="pageFullUrl"
        target="_blank"
        rel="noopener"
        purpose="secondary"
        icon="external"
        size="sm"
      >
        Visit Page
      </UiButton>
    </div>

    <ProGscSurfaceBar surface="detail" :site-id="siteId" />

    <ProPageZone tier="primary" first>
      <!-- A failed read used to fall between the skeleton and the card and
           render nothing at all. Say what happened instead. -->
      <ProGscReadError :error="pageDatesError" />

      <!-- An unconnected site never resolves this read, so it would sit on the
           skeleton forever. Say what is missing instead. -->
      <UiEmptyState
        v-if="!pageDates && isNotConnected"
        compact
        icon="google"
        title="Connect Search Console"
        description="This page's trend fills in once Google Search Console is connected for this site."
      />
      <UiCard v-else-if="!pageDates && (siteStatus === 'pending' || !isReady)" variant="default" aria-busy="true">
        <div class="grid grid-cols-2 sm:flex sm:items-center gap-4 mb-6">
          <div v-for="i in 4" :key="i" class="flex-1 space-y-2">
            <UiSkeleton class="h-3" :index="i" :base="60" :range="20" />
            <UiSkeleton class="h-6" :index="i + 4" :base="80" :range="30" />
          </div>
        </div>
        <UiSkeleton class="h-[180px] rounded-lg" :base="400" :range="50" />
      </UiCard>
      <ProCardGsc
        v-else-if="pageDates"
        :key="`${siteId}-${pageUrl}`"
        :date-range="period"
        :dates="pageDates.dates"
        :prev-dates="null"
        :period="pageDates.period"
        :prev-period="pageDates.prevPeriod"
        :columns="columns"
        @zoom="onZoom"
      />
    </ProPageZone>

    <ProPageZone tier="secondary">
      <ProSectionHeader title="Keywords ranking for this page" />
      <ProTableKeywords
        :site-id="siteId"
        :site-url="site?.url"
        :gscdump-site-id="gscdumpSiteId"
        :page-size="50"
        :period="period"
        :page-filter="pageUrl ?? undefined"
        :exclude-columns="['page']"
      />
    </ProPageZone>
  </div>
</template>
