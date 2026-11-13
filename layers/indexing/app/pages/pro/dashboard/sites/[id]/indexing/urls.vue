<script lang="ts" setup>
import type { IndexingUrlsParams } from '@gscdump/contracts'
import type { IndexCohortFilter } from '@gscdump/sdk/indexing'
import type { IndexingRead, IndexingSite, IndexingSource } from '@nuxtseo/pro-indexing/shared/source'
import type { MaybeRefOrGetter } from 'vue'
import type { GscdumpIndexingUrlsResponse } from '#layers/pro-gsc/shared/gscdump-api'
import { indexCohortFilterValue } from '@gscdump/sdk/indexing'
import { provideIndexingSource } from '@nuxtseo/pro-indexing/app/composables/useIndexingSource'
import { IndexingUrlsTable } from '#components'
import { useRequestIndexingSource } from '#layers/indexing/app/composables/useRequestIndexingSource'
import { useIndexingUrlsFirstPageSeed } from '#layers/indexing/app/internal/composables/useIndexingUrlsFirstPageSeed'
import {
  INDEXING_URLS_PAGE_SIZE,
  isFirstPageIndexingUrlsRouteQuery,
  parseIndexingUrlsRouteQuery,
} from '#layers/indexing/app/utils/indexing-urls-first-page'
import ProGscTableShell from '#layers/pro-gsc/app/components/pro/ProGscTableShell.vue'

definePageMeta({
  proTab: { feature: 'indexing', label: 'URLs', icon: 'i-lucide-link-2', order: 30 },
  title: 'URLs',
  icon: 'i-lucide-link-2',
})

const { siteId, siteName, gscdumpSiteId, site } = useSite('Indexing URLs')
const route = useRoute()
const proFetch = useProFetch()
const { isAdmin } = useCaller()
const teamPolicy = useTeamPolicy(() => site.value?.teamId)
// `inspect.create` is a write; the proxy refuses it for a view-only role.
const canWrite = computed(() => isAdmin.value || teamPolicy.can('write-data'))

const routeState = computed(() => parseIndexingUrlsRouteQuery(route.query))

const indexingSite = computed<IndexingSite | null>(() => siteId.value
  ? { id: siteId.value, ref: siteId.value, label: siteName.value, url: site.value?.url ?? null, dataId: gscdumpSiteId.value ?? null }
  : null)

/** The rows of one exact Index cohort, paged and searched on this app's cohort route. */
function cohortUrls(cohort: IndexCohortFilter, target: MaybeRefOrGetter<IndexingSite | null | undefined>, params: MaybeRefOrGetter<IndexingUrlsParams>): IndexingRead<GscdumpIndexingUrlsResponse> {
  return useAsyncData<GscdumpIndexingUrlsResponse | null>(
    computed(() => `indexing-cohort-urls:${toValue(target)?.id ?? ''}:${indexCohortFilterValue(cohort)}:${JSON.stringify(toValue(params))}`),
    async () => {
      const current = toValue(target)
      if (!current?.dataId)
        return null
      const { limit, offset, search } = toValue(params)
      return proFetch<GscdumpIndexingUrlsResponse>(`/api/pro/sites/${current.id}/indexing/cohorts/urls`, {
        query: { cohort: indexCohortFilterValue(cohort), limit, offset, search },
      })
    },
    { server: false, watch: [() => JSON.stringify(toValue(params))] },
  )
}

// This page's IndexingSource. Its reads decide when the table mounts, and the
// table remounts on each change below (its `key`):
// - A view-only role has no `inspect`, so no row offers "Re-check with Google".
// - A `?cohort=` link reads the exact Index cohort. `IndexingUrlsTable` knows
//   only `issue`, `status`, `facet` and `search` (layer gap), so the read
//   carries the cohort instead.
const appSource = useRequestIndexingSource()
const source: IndexingSource = {
  ...appSource,
  get inspect() {
    return canWrite.value ? appSource.inspect : undefined
  },
  urls: (target, params) => {
    const cohort = routeState.value.cohort
    return cohort ? cohortUrls(cohort, target, params) : appSource.urls(target, params)
  },
}
provideIndexingSource(source)

// The clean first page renders on the server with its rows. Filtered deep
// links and client navigations fetch in the browser.
const seedFirstPage = useIndexingUrlsFirstPageSeed()
if (import.meta.server && gscdumpSiteId.value && isFirstPageIndexingUrlsRouteQuery(route.query))
  await seedFirstPage(gscdumpSiteId.value, INDEXING_URLS_PAGE_SIZE)
</script>

<template>
  <ProPageStates>
    <IndexingUrlsTable
      :key="`urls-${routeState.issue}-${routeState.facet}-${routeState.cohort?.dimension}-${routeState.cohort?.key}-${canWrite}`"
      :site="indexingSite"
      :shell="ProGscTableShell"
      :page-size="INDEXING_URLS_PAGE_SIZE"
      :initial-issue="routeState.issue"
      :initial-search="routeState.search"
      :initial-facet="routeState.facet"
      :initial-status="routeState.status === 'pending' ? undefined : routeState.status"
      :initial-page="routeState.page"
    />
  </ProPageStates>
</template>
