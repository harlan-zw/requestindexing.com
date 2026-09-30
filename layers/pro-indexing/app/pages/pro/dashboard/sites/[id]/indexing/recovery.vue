<script lang="ts" setup>
import { withQuery } from 'ufo'
import { useProGscdumpIndexingDiagnostics, useProGscdumpIndexingUrls } from '#layers/pro-gsc/app/composables/useProGscdump'
import IndexingRejectionClusters from '#layers/pro-indexing/app/internal/components/indexing/IndexingRejectionClusters.vue'
import { REJECTION_ISSUE_TYPES } from '#layers/pro-indexing/app/utils/indexing-rejection-clusters'

/**
 * Indexing, Recovery. The page behind the quality-rejection verdict.
 *
 * It answers one question: which pages is Google refusing, and are they worth
 * keeping. The counts name the scale and the clusters name the shape. Each
 * count and each cluster deep-links the URLs it came from. The work itself is
 * the reader's, so this page diagnoses and never prescribes.
 *
 * nuxtseo.com builds its clusters on a cloud endpoint over its own crawl plus
 * a traffic join. gscdump.com computes them in the browser from the inspected
 * rows, with no crawl and no prune tag, and this page ports that version.
 */

definePageMeta({
  proTab: { feature: 'indexing', label: 'Recovery', icon: 'i-lucide-life-buoy', order: 10 },
  title: 'Recovery',
  icon: 'i-lucide-life-buoy',
})

const { siteId, gscdumpSiteId } = useSite('Indexing recovery')
const engineSiteId = computed(() => gscdumpSiteId.value ?? '')

const {
  data: diagnostics,
  status,
  error: diagnosticsError,
  refresh: refreshDiagnostics,
} = useProGscdumpIndexingDiagnostics(engineSiteId)

// The clusters read the refused rows only, so the page never pulls the whole
// inventory to group three buckets. gscdump fills `issueType` only from the
// `issue` filter, so each bucket is its own read: one read without it returns
// every row with `issueType: null`, and the clusters would drop all of them.
const rejectionReads = REJECTION_ISSUE_TYPES.map(issue =>
  useProGscdumpIndexingUrls(engineSiteId, { limit: 200, status: 'not_indexed', issue }),
)
const urlsData = computed(() => {
  const loaded = rejectionReads.filter(read => read.data.value)
  return loaded.length ? { urls: loaded.flatMap(read => read.data.value?.urls ?? []) } : null
})
const urlsError = computed(() => rejectionReads.find(read => read.error.value)?.error.value ?? null)
const urlsStatus = computed(() => rejectionReads.some(read => read.status.value === 'pending')
  ? 'pending'
  : rejectionReads.every(read => read.status.value === 'idle') ? 'idle' : 'success')
function refreshUrls() {
  return Promise.all(rejectionReads.map(read => read.refresh()))
}

const REJECTION_LABELS: Record<typeof REJECTION_ISSUE_TYPES[number], string> = {
  crawled_not_indexed: 'Crawled, then refused',
  discovered_not_indexed: 'Found, never fetched',
  soft_404: 'Served as empty',
}

/**
 * The rejection buckets, in the order they explain each other. Only buckets
 * Search Console actually reports are rendered.
 */
const buckets = computed(() => {
  const issues = diagnostics.value?.issues ?? []
  return REJECTION_ISSUE_TYPES
    .map((type) => {
      const issue = issues.find(candidate => candidate.type === type)
      return issue && issue.count > 0
        ? { type, label: REJECTION_LABELS[type], count: issue.count }
        : null
    })
    .filter(bucket => bucket !== null)
})

const totalRejected = computed(() => buckets.value.reduce((sum, bucket) => sum + bucket.count, 0))

// A site with no Search Console link answers the diagnostics query with
// nothing, and an empty bucket list then reads as "Google is refusing no
// pages". That is a clean bill for a site nobody has checked, so the connect
// state is its own branch.
const isConnected = computed(() => Boolean(gscdumpSiteId.value))
const hasEvidence = computed(() => Boolean(diagnostics.value))
const clustersLoading = computed(() =>
  !urlsData.value && !urlsError.value && (urlsStatus.value === 'idle' || urlsStatus.value === 'pending'),
)

const urlsRoute = computed(() => `/pro/dashboard/sites/${siteId.value}/indexing/urls`)
function bucketTo(issueType: string): string {
  return withQuery(urlsRoute.value, { issue: issueType })
}
</script>

<template>
  <ProPageStates>
    <ProPageZone tier="primary" first>
      <UiEmptyState
        v-if="!isConnected"
        icon="link"
        title="Connect Search Console to see refused pages"
        description="Recovery reads the crawled-not-indexed, discovered-not-indexed, and soft-404 buckets from Search Console."
      >
        <ConnectSearchConsoleButton />
      </UiEmptyState>

      <UiAlert
        v-else-if="diagnosticsError && !hasEvidence"
        status="error"
        title="The refusal counts could not load"
        description="Retry to read the Search Console diagnosis again."
      >
        <template #action>
          <UiButton purpose="secondary" size="xs" class="min-h-11 sm:min-h-0" @click="refreshDiagnostics()">
            Retry
          </UiButton>
        </template>
      </UiAlert>

      <UiAlert
        v-else-if="hasEvidence && status === 'success' && totalRejected === 0"
        status="success"
        title="Google is not refusing pages on this site"
        description="Search Console reports no pages in the crawled-not-indexed, discovered-not-indexed, or soft-404 buckets."
      />

      <div v-else-if="buckets.length" class="flex flex-col gap-4">
        <UiCard title="Pages Google is refusing" size="sm">
          <div class="grid gap-4 sm:grid-cols-3">
            <UiStat
              v-for="bucket in buckets"
              :key="bucket.type"
              :title="bucket.label"
              :value="bucket.count"
              :to="bucketTo(bucket.type)"
              card
              size="sm"
            />
          </div>
          <p class="mt-3 text-mini text-dimmed">
            Counts come from the latest Search Console sync. Google re-evaluates a
            refusal on its own schedule, so expect movement over weeks.
          </p>
        </UiCard>

        <UiCard size="sm">
          <IndexingRejectionClusters
            :rows="urlsData?.urls ?? []"
            :urls-route="urlsRoute"
            :refused-total="totalRejected"
            :loading="clustersLoading"
            :failed="Boolean(urlsError) && !urlsData"
            @retry="refreshUrls()"
          />
          <p class="mt-3 text-mini text-dimmed">
            Treat each route as one decision. If its pages are not worth keeping,
            remove them or set <code class="text-muted">noindex</code>. If the
            route earns traffic, improve the pages instead.
          </p>
        </UiCard>
      </div>

      <UiCard v-else size="sm">
        <UiSkeleton :lines="3" :base="220" :range="60" />
      </UiCard>
    </ProPageZone>
  </ProPageStates>
</template>
