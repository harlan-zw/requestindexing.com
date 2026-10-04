<script lang="ts" setup>
import TableIndexingUrls from '#layers/pro-indexing/app/internal/components/TableIndexingUrls.vue'
import { useIndexingUrlsFirstPageSeed } from '#layers/pro-indexing/app/internal/composables/useIndexingUrlsFirstPageSeed'
import {
  INDEXING_URLS_PAGE_SIZE,
  isFirstPageIndexingUrlsRouteQuery,
  parseIndexingUrlsRouteQuery,
} from '#layers/pro-indexing/app/utils/indexing-urls-first-page'

definePageMeta({
  proTab: { feature: 'indexing', label: 'URLs', icon: 'i-lucide-link-2', order: 30 },
  title: 'URLs',
  icon: 'i-lucide-link-2',
})

const { siteId, gscdumpSiteId, site } = useSite('Indexing URLs')
const route = useRoute()
const { isAdmin } = useCaller()
const teamPolicy = useTeamPolicy(() => site.value?.teamId)
// `inspect.create` is a write; the proxy refuses it for a view-only role.
const canWrite = computed(() => isAdmin.value || teamPolicy.can('write-data'))

const routeState = computed(() => parseIndexingUrlsRouteQuery(route.query))

// The clean first page renders on the server with its rows. Filtered deep
// links and client navigations fetch in the browser.
const seedFirstPage = useIndexingUrlsFirstPageSeed()
if (import.meta.server && gscdumpSiteId.value && isFirstPageIndexingUrlsRouteQuery(route.query))
  await seedFirstPage(gscdumpSiteId.value, INDEXING_URLS_PAGE_SIZE)
</script>

<template>
  <ProPageStates>
    <TableIndexingUrls
      :key="`urls-${routeState.issue}-${routeState.facet}-${routeState.cohort?.dimension}-${routeState.cohort?.key}`"
      :gscdump-site-id="gscdumpSiteId"
      :site-id="siteId"
      :initial-cohort="routeState.cohort"
      :page-size="INDEXING_URLS_PAGE_SIZE"
      :initial-issue="routeState.issue"
      :initial-search="routeState.search"
      :initial-facet="routeState.facet"
      :initial-status="routeState.status"
      :initial-page="routeState.page"
      :can-write="canWrite"
    />
  </ProPageStates>
</template>
