<script setup lang="ts">
import type { RejectionClusterRow } from '#layers/pro-indexing/app/utils/indexing-rejection-clusters'
import { withQuery } from 'ufo'
import { computed } from 'vue'
import { NuxtLink, UiButton, UiSkeleton } from '#components'
import { clusterRejectedUrls } from '#layers/pro-indexing/app/utils/indexing-rejection-clusters'

// Refused URLs, grouped by route family.
//
// Ported from gscdump.com `AppIndexingRejectionClusters.vue`, which replaces
// nuxtseo.com's `ProSiteQualityRejectionClusters`. That one reads a cloud-only
// endpoint built from a crawl plus a traffic join. This app has neither, so it
// clusters the inspected rows it already has, in the browser.
//
// No prune tag, unlike nuxtseo. That tag means "carries no traffic, delete it
// wholesale", and this surface has no traffic per cluster. A wrong prune tag
// tells someone to delete pages that earn clicks.

const { rows, urlsRoute, refusedTotal, loading = false, failed = false } = defineProps<{
  rows: readonly RejectionClusterRow[]
  urlsRoute: string
  /** The refused count Search Console reports, so a capped read says it is partial. */
  refusedTotal: number
  loading?: boolean
  failed?: boolean
}>()

defineEmits<{ retry: [] }>()

const report = computed(() => clusterRejectedUrls(rows))
const maxCount = computed(() => report.value.clusters.reduce((max, cluster) => Math.max(max, cluster.count), 0) || 1)
const unclustered = computed(() => report.value.rejectedTotal - report.value.clusteredTotal)
// The read is capped, so on a large Site the clusters describe part of the
// refused set. A partial read must never pass for the whole count.
const partial = computed(() => report.value.rejectedTotal > 0 && report.value.rejectedTotal < refusedTotal)

function clusterTo(pathPattern: string): string {
  // The URLs page searches on a substring, so send the prefix without the wildcard.
  return withQuery(urlsRoute, { search: pathPattern.replace(/\/\*$/, '/'), status: 'not_indexed' })
}
</script>

<template>
  <div>
    <div class="mb-2.5 flex items-center justify-between gap-3">
      <span class="text-label text-muted">Refused URLs by route</span>
      <NuxtLink :to="urlsRoute" class="text-mini text-primary hover:underline">
        View URLs
      </NuxtLink>
    </div>

    <div v-if="loading" class="space-y-1.5">
      <UiSkeleton v-for="index in 3" :key="index" type="block" class="h-6 w-full rounded-md" />
    </div>

    <div v-else-if="failed" class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-muted">
        The refused URLs could not load, so they cannot be grouped by route.
      </p>
      <UiButton purpose="secondary" size="xs" class="min-h-11 sm:min-h-0" @click="$emit('retry')">
        Retry
      </UiButton>
    </div>

    <template v-else-if="report.clusters.length">
      <ul class="space-y-1">
        <li v-for="cluster in report.clusters" :key="cluster.pathPattern">
          <NuxtLink
            :to="clusterTo(cluster.pathPattern)"
            class="relative flex min-h-11 items-center gap-2.5 overflow-hidden rounded-md px-2 py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:min-h-0"
          >
            <span
              class="absolute inset-y-0 left-0 rounded-md bg-accented/50"
              :style="{ width: `${Math.max(4, (cluster.count / maxCount) * 100)}%` }"
              aria-hidden="true"
            />
            <span class="relative size-1.5 shrink-0 rounded-full bg-(--ui-border-accented)" />
            <span class="relative min-w-0 flex-1 truncate font-mono text-xs text-default">{{ cluster.pathPattern }}</span>
            <span class="relative shrink-0 text-mini text-muted numerals-display">{{ Math.round(cluster.share * 100) }}%</span>
            <span class="relative shrink-0 text-xs font-semibold numerals-display text-default">{{ cluster.count.toLocaleString() }}</span>
          </NuxtLink>
        </li>
      </ul>
      <p v-if="unclustered > 0" class="mt-2 text-mini text-dimmed">
        {{ unclustered.toLocaleString() }} more refused URLs sit in routes with one URL each.
      </p>
      <p v-if="partial" class="mt-1 text-mini text-dimmed">
        Grouped from {{ report.rejectedTotal.toLocaleString() }} of {{ refusedTotal.toLocaleString() }} refused URLs.
      </p>
    </template>

    <p v-else class="text-sm text-muted">
      No route carries more than one refused URL in this sample.
    </p>
  </div>
</template>
