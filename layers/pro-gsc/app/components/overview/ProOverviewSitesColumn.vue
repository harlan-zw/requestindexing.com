<script setup lang="ts">
import type { OverviewSiteEntry } from './overview-sites'
import { computed, ref } from 'vue'
import { NuxtLink, UiFavicon, UiIcon, UiSkeleton, UiSparkColumns, UiTooltip } from '#components'
import {
  overviewColumnPage,
  overviewSiteLabel,
  overviewSiteStatus,
  siteRoute,
  TONE_BAR,
  TONE_TEXT,
} from './overview-sites'

// The "Sites" column, ported from gscdump.com's `AppOverviewSitesColumn.vue`,
// itself a cut of nuxtseo.com's `ProOverviewSitesColumn.vue`: every Site as one
// quiet navigable row with a favicon, a name, its 90-day clicks run and a
// status dot, ranked by attention. A large roster pages through in that order
// rather than growing an unbounded column. The header links to Manage Sites.
//
// The status is the gscdump lifecycle, not upstream's triage verdict (see
// `overview-sites.ts`). Only a state the owner must act on spends colour, so
// a calm roster paints once.
const { entries, loading = false } = defineProps<{
  entries: OverviewSiteEntry[]
  /** The Search Console reads are in flight. Rows render; their runs wait. */
  loading?: boolean
}>()

const page = ref(0)
const pager = computed(() => overviewColumnPage(entries, page.value))
const rows = computed(() => pager.value.rows.map(entry => ({
  entry,
  label: overviewSiteLabel(entry.site),
  status: overviewSiteStatus(entry.site),
})))
</script>

<template>
  <nav aria-label="Sites" class="overflow-hidden rounded-xl border border-default bg-elevated/20">
    <div class="flex min-h-9 items-center gap-2 border-b border-default/60 px-2">
      <NuxtLink to="/pro/dashboard/sites" class="group/head inline-flex min-h-11 items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-primary sm:min-h-0">
        <span class="text-label transition-colors group-hover/head:text-default">Sites</span>
        <UiIcon name="chevron-right" class="size-3 shrink-0 text-dimmed transition-colors group-hover/head:text-default" aria-hidden="true" />
      </NuxtLink>
    </div>

    <ul class="divide-y divide-default/60">
      <li
        v-for="row in rows"
        :key="row.entry.site.siteId"
        class="relative flex min-h-11 min-w-0 items-center gap-2 px-2 transition-colors hover:bg-elevated/40 sm:min-h-9"
      >
        <NuxtLink
          :to="siteRoute(row.entry.site)"
          class="group flex min-w-0 flex-1 items-center gap-2 self-stretch py-1 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <UiFavicon :domain="row.label" :size="16" decorative class="shrink-0 rounded bg-default p-0.5" />
          <span class="block min-w-0 truncate text-sm font-medium text-default">{{ row.label }}</span>
          <span class="absolute inset-y-0 right-2 flex w-5 items-center justify-end">
            <UiIcon name="chevron-right" class="size-3 shrink-0 text-dimmed opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
          </span>
        </NuxtLink>

        <!-- The run is quiet unless the status is urgent. The tooltip names
             it, because nothing else on the row says "clicks". Below sm the
             name needs the width, so the run hides. -->
        <span class="hidden shrink-0 sm:block">
          <UiSkeleton v-if="loading && !row.entry.metrics" type="text" :base="72" :range="24" class="!h-3" aria-hidden="true" />
          <UiTooltip
            v-else-if="row.entry.metrics"
            title="Clicks, last 90 days"
            description="Daily Search Console clicks, oldest on the left."
            side="top"
            size="sm"
          >
            <UiSparkColumns
              :data="row.entry.metrics.clicksSpark"
              size="sm"
              :tone="row.status.urgent ? row.status.tone : 'neutral'"
              :aria-label="`${row.label}: clicks over the last 90 days`"
              class="block"
            />
          </UiTooltip>
        </span>

        <span class="ml-4 mr-5 flex shrink-0 items-center justify-end">
          <UiTooltip
            :title="row.status.label"
            :description="row.status.action ? `${row.status.summary} ${row.status.action}` : row.status.summary"
            side="top"
            align="end"
            size="sm"
            trigger-as="button"
          >
            <span class="flex min-h-11 min-w-0 items-center gap-1.5 sm:min-h-0">
              <span class="size-1.5 shrink-0 rounded-full" :class="TONE_BAR[row.status.tone]" aria-hidden="true" />
              <span class="truncate text-xs" :class="row.status.urgent ? TONE_TEXT[row.status.tone] : 'text-dimmed'">{{ row.status.label }}</span>
            </span>
          </UiTooltip>
        </span>
      </li>
    </ul>

    <div v-if="pager.pageCount > 1" class="flex min-h-9 items-center justify-between gap-2 border-t border-default/60 px-2">
      <span class="text-xs text-dimmed tabular-nums">Page {{ pager.page + 1 }} of {{ pager.pageCount }}</span>
      <span class="flex items-center gap-1">
        <button
          type="button"
          class="flex size-11 items-center justify-center rounded-md outline-none transition-colors hover:bg-elevated focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 sm:size-7"
          aria-label="Previous page of Sites"
          :disabled="pager.page === 0"
          @click="page = pager.page - 1"
        >
          <UiIcon name="chevron-left" class="size-3.5 text-dimmed" aria-hidden="true" />
        </button>
        <button
          type="button"
          class="flex size-11 items-center justify-center rounded-md outline-none transition-colors hover:bg-elevated focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-40 sm:size-7"
          aria-label="Next page of Sites"
          :disabled="pager.page >= pager.pageCount - 1"
          @click="page = pager.page + 1"
        >
          <UiIcon name="chevron-right" class="size-3.5 text-dimmed" aria-hidden="true" />
        </button>
      </span>
    </div>
  </nav>
</template>
