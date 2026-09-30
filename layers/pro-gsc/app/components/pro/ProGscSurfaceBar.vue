<script lang="ts" setup>
import { navigateTo, useRoute } from 'nuxt/app'
import { computed, watch } from 'vue'
import { UiIcon } from '#components'
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

const { searchType, supportsQueries, supportsDimensions } = useProGscFilters()
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
  if (stranded)
    navigateTo(`/pro/dashboard/sites/${route.params.id}/search-console`)
}, { immediate: true, flush: 'post' })
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center gap-2 sm:gap-3 flex-wrap" role="toolbar" aria-label="Search Console filters">
      <ProGscControlBar v-bind="barProps" :site-id="siteId" class="w-full min-w-0" />
    </div>
    <p v-if="gateNote" class="flex items-center gap-1.5 text-xs text-muted">
      <UiIcon name="info" class="size-3 text-dimmed shrink-0" aria-hidden="true" />
      {{ gateNote }}
    </p>
  </div>
</template>
