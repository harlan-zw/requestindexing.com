<script lang="ts" setup>
import { navigateTo, useRoute } from 'nuxt/app'
import { computed, watch } from 'vue'
import { UiIcon } from '#components'
import { useSite } from '#layers/pro-saas/app/composables/useSite'
import { readSiteRouteId } from '#layers/pro-saas/shared/site-lookup'
import { getSearchTypeLabel, useProGscFilters } from '../../composables/useProGscFilters'
import ProGscControlBar from './ProGscControlBar.vue'

// The Search Console control strip, one per surface.
//
// nuxtseo.com puts this in a `search-console.vue` parent route that also draws
// a tab strip. Here every Search Console surface is its own sidebar row
// (owner decision 10), so there is no parent route to hang the bar on. This
// component carries the three things that route shell owned besides the tabs:
// the per-surface control visibility, the thin-slice note, and the bounce off
// a breakdown the active search type cannot answer.
//
// The dimension dropdown stays off. The sidebar is the breakdown selector.

const { surface } = defineProps<{
  surface: 'overview' | 'queries' | 'pages' | 'countries' | 'detail'
  siteId: string
}>()

const { searchType, supportsQueries, supportsDimensions, googleSlice, siteSearchConsole } = useProGscFilters()
const { gscData } = useSite()
const route = useRoute()

// Brand and Questions are query-text facets, so they only apply where a row is
// a query: the Queries table, and the Overview, which leads with query lists.
// Country and Device facets stay off everywhere per-site: a breakdown table is
// a single-dimension aggregate, so there is no page x country data to
// cross-filter. An entity detail page is already pinned to one term or one
// page, so a query-text facet there would only ever hide the whole page.
const barProps = computed(() => surface === 'queries' || surface === 'overview'
  ? { showMetrics: true, showBrand: true, showQuestions: true, showFilter: false }
  : { showMetrics: true, showFilter: false })

// Discover and Google News report clicks and impressions by date and page
// only. The control bar already drops the inapplicable columns; without this
// note the missing figures read as a bug rather than a data limit.
const gateNote = computed(() => supportsQueries.value
  ? null
  : `${getSearchTypeLabel(searchType.value)} reports clicks and impressions by date and page only.`)

// If the reader picks a search type this breakdown cannot answer, send them to
// the Overview, which always has date and page data, rather than stranding
// them on an empty table. `flush: 'post'` runs after the search-type URL write
// settles, so the path change is not clobbered by the query write.
watch([supportsQueries, supportsDimensions], () => {
  const stranded = (surface === 'queries' && !supportsQueries.value)
    || (surface === 'countries' && !supportsDimensions.value)
  const id = readSiteRouteId(route.params)
  if (stranded && id)
    navigateTo(`/pro/dashboard/sites/${id}/search-console`)
}, { immediate: true, flush: 'post' })
</script>

<template>
  <div class="flex flex-col gap-2">
    <ProGscControlBar v-bind="barProps" :site-id="siteId" class="w-full min-w-0" />
    <p v-if="siteSearchConsole && gscData?.gscPropertyUrl" class="text-xs text-muted">
      Search Console property <span class="break-all text-default">{{ gscData.gscPropertyUrl }}</span>
    </p>
    <p v-if="googleSlice?.googleBrand" class="text-xs text-muted">
      Google only classifies queries for top-level properties with enough queries and impressions.
      Select All queries to check Web traffic for these filters and dates.
    </p>
    <p v-if="gateNote" class="flex items-center gap-1.5 text-xs text-muted">
      <UiIcon name="info" class="size-3 text-dimmed shrink-0" aria-hidden="true" />
      {{ gateNote }}
    </p>
  </div>
</template>
