<script lang="ts" setup>
import type { IndexingSite, IndexingSource } from '@nuxtseo/pro-indexing/shared/source'
import { provideIndexingSource } from '@nuxtseo/pro-indexing/app/composables/useIndexingSource'
import { parseIndexingUrlsQuery } from '@nuxtseo/pro-indexing/shared/urls-query'
import { IndexingUrlsTable } from '#components'
import { useRequestIndexingSource } from '#layers/indexing/app/composables/useRequestIndexingSource'
import SubmissionWindowHold from '#layers/indexing/app/internal/components/submissions/SubmissionWindowHold.vue'
import { useIndexingUrlsFirstPageSeed } from '#layers/indexing/app/internal/composables/useIndexingUrlsFirstPageSeed'
import {
  INDEXING_URLS_PAGE_SIZE,
  isFirstPageIndexingUrlsRouteQuery,
} from '#layers/indexing/app/utils/indexing-urls-first-page'
import ProGscTableShell from '#layers/pro-gsc/app/components/pro/ProGscTableShell.vue'

definePageMeta({
  proTab: { feature: 'indexing', label: 'URLs', icon: 'i-lucide-link-2', order: 30 },
  title: 'URLs',
  icon: 'i-lucide-link-2',
})

const { siteId, siteName, gscdumpSiteId, site } = useSite('Indexing URLs')
const route = useRoute()
const { isAdmin } = useCaller()
const teamPolicy = useTeamPolicy(() => site.value?.teamId)
// `inspect.create` is a write; the proxy refuses it for a view-only role.
const canWrite = computed(() => isAdmin.value || teamPolicy.can('write-data'))

// The table reads its filters from the route query and follows every change.
// It still remounts on a new issue, facet or cohort, so each opens on its
// first row, and on a role change, because it reads `inspect` once.
const tableQuery = computed(() => parseIndexingUrlsQuery(route.query))

const indexingSite = computed<IndexingSite | null>(() => siteId.value
  ? { id: siteId.value, ref: siteId.value, label: siteName.value, url: site.value?.url ?? null, dataId: gscdumpSiteId.value ?? null }
  : null)

// Each opened row's Submission timeline reads the Site's receipt window. The
// table keeps one row open at a time, so from the first opened row the page
// holds the window; otherwise each row reads every receipt list again.
const holdSubmissionWindow = ref(false)

// This page's IndexingSource: a view-only role has no `inspect`, so no row
// offers "Re-check with Google".
const appSource = useRequestIndexingSource()
const { submissionOutcomes } = appSource
const source: IndexingSource = {
  ...appSource,
  get inspect() {
    return canWrite.value ? appSource.inspect : undefined
  },
  submissionOutcomes: submissionOutcomes && ((site, params) => {
    holdSubmissionWindow.value = true
    return submissionOutcomes(site, params)
  }),
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
    <SubmissionWindowHold v-if="holdSubmissionWindow" :site="indexingSite" />
    <IndexingUrlsTable
      :key="`urls-${tableQuery.issue}-${tableQuery.facet}-${tableQuery.cohort}-${canWrite}`"
      :site="indexingSite"
      :shell="ProGscTableShell"
      :page-size="INDEXING_URLS_PAGE_SIZE"
    />
  </ProPageStates>
</template>
