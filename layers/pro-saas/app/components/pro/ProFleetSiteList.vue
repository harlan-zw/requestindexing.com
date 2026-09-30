<script setup lang="ts">
// The flat per-Site list under every fleet concern page. Ported from
// nuxtseo.com's `ProSiteGroup.vue` in its `bare` mode, which is how upstream
// renders an account with no Site groups. This app has no groups, so the group
// header, the move-to-group menu and drag reordering are gone. So is the health
// dot: it reads upstream's crawl health, which gscdump does not serve.
//
// The page owns the data. This component owns the layout: the card grid (the
// default) or table rows (`?grid=0`), the pinned "All sites" row, and which
// rows are expanded.
import type { SiteSyncStatus } from '#layers/pro-saas/shared/site-sync'
import { useLocalStorage, useMediaQuery, useMounted } from '@vueuse/core'
import { computed } from 'vue'
import { NuxtLink, ProSiteIdentity, UiIcon, UiSyncDot } from '#components'
import { isSiteSyncing, SITE_SYNC_LABELS } from '#layers/pro-saas/shared/site-sync'

export interface FleetSiteListRow {
  /** The Site's route id (its `s_` public id). */
  id: string
  name: string
  /** Hostname for the favicon. */
  domain: string
  /** Where the Site's name and its Open link go. */
  href: string
  syncStatus: SiteSyncStatus
  /** The Site is linked to a Search Console property through gscdump. */
  connected: boolean
}

const {
  sites,
  view,
  gridCols,
  sortComparator = null,
  gridLayout,
  gridExpanded,
  rowExpandable,
  connectTo,
} = defineProps<{
  sites: FleetSiteListRow[]
  /** `graph-per-site` gives each row a chart; `table` gives it a breakdown. */
  view: 'table' | 'graph-per-site'
  /** CSS grid template shared by the header, the All sites row and each row. */
  gridCols?: string
  /** A metric sort. Without one, rows keep the order they arrive in. */
  sortComparator?: ((a: FleetSiteListRow, b: FleetSiteListRow) => number) | null
  /** Render the two-column card grid instead of table rows. */
  gridLayout: boolean
  /** In the card grid, show each card's chart or breakdown. */
  gridExpanded: boolean
  /** Rows without a detail stay flat. Defaults to connected Sites. */
  rowExpandable?: (site: FleetSiteListRow) => boolean
  /** Where a row that is not linked to Search Console sends the reader. */
  connectTo: string
}>()

defineSlots<{
  'columns': (props: { site: FleetSiteListRow, isSyncing: boolean, syncLabel: string, layout: 'grid' | 'rows' }) => unknown
  'table-header': () => unknown
  'aggregate-row': () => unknown
  'aggregate-row-mobile': () => unknown
  'aggregate-detail': () => unknown
  'row-detail': (props: { site: FleetSiteListRow }) => unknown
  'mobile': (props: { site: FleetSiteListRow }) => unknown
}>()

const renderSites = computed(() => sortComparator ? sites.toSorted(sortComparator) : sites)

// Upstream swaps the table rows for stacked cards on a narrow screen. The
// query only answers after mount, so the server and the first client render
// both draw the desktop rows and hydration agrees.
const mounted = useMounted()
const narrowQuery = useMediaQuery('(max-width: 767px)')
const narrow = computed(() => mounted.value && narrowQuery.value)

function syncLabel(site: FleetSiteListRow): string {
  return SITE_SYNC_LABELS[site.syncStatus]
}

// Rows are open by default, so this tracks the ones the reader collapsed.
// Persisted so a collapsed Site stays collapsed across visits.
const collapsedSiteIds = useLocalStorage<string[]>('ri:fleet:collapsed-sites', [], { initOnMounted: true })
const aggregateExpanded = useLocalStorage('ri:fleet:all-sites-expanded', true, { initOnMounted: true })

const isTableLike = computed(() => view === 'table' || view === 'graph-per-site')

function canExpandRow(site: FleetSiteListRow): boolean {
  const expandable = rowExpandable ? rowExpandable(site) : site.connected
  return isTableLike.value && expandable
}
function isRowExpanded(siteId: string): boolean {
  return !collapsedSiteIds.value.includes(siteId)
}
function toggleRowExpand(siteId: string) {
  collapsedSiteIds.value = isRowExpanded(siteId)
    ? [...collapsedSiteIds.value, siteId]
    : collapsedSiteIds.value.filter(id => id !== siteId)
}
function rowExpandLabel(siteId: string): string {
  const open = isRowExpanded(siteId)
  if (view === 'graph-per-site')
    return open ? 'Hide chart' : 'Show chart'
  return open ? 'Hide breakdown' : 'Show breakdown'
}

const identityBind = computed(() => view === 'graph-per-site'
  ? { size: 32, titleSize: 'lg' as const, hideSubtitle: true, faviconClass: 'rounded-md bg-default p-1' }
  : { size: 32, hideSubtitle: true, faviconClass: 'rounded-md bg-default p-1' })

// graph-per-site renders each Site as a faint card, so its header reads as a
// band over its chart. The table keeps flat rows split by hairlines.
const listClass = computed(() => view === 'graph-per-site' ? 'space-y-2.5' : 'divide-y divide-default')
const rowDetailClass = computed(() => view === 'graph-per-site' ? 'col-span-full pt-1' : 'col-span-full pt-1 pb-2')
const rowClass = computed(() => {
  const base = 'group/row grid items-center gap-3 py-3 px-3 transition-colors duration-150'
  if (view === 'graph-per-site')
    return [base, 'rounded-lg', 'bg-elevated/20 hover:bg-elevated/40']
  return [base, 'border-l-2', 'border-l-transparent hover:bg-muted/50']
})
const gridStyle = computed(() => gridCols ? { gridTemplateColumns: gridCols } : undefined)
</script>

<template>
  <div>
    <!-- Table header, desktop only. The card grid has none. -->
    <div
      v-if="!gridLayout && !narrow"
      class="hidden md:grid gap-3 px-3 py-2.5 border-b border-default text-label"
      :style="gridStyle"
    >
      <div />
      <span>Site</span>
      <slot name="table-header" />
      <div />
    </div>

    <!-- Pinned All sites row. Only with more than one Site: a single Site
         would repeat its own row. Its cells line up under the metric columns. -->
    <div
      v-if="isTableLike && sites.length > 1 && $slots['aggregate-row'] && !gridLayout"
      class="hidden md:grid items-center gap-3 px-3 border-b border-default bg-elevated/30"
      :class="view === 'graph-per-site' ? 'py-2' : 'py-3'"
      :style="gridStyle"
    >
      <div class="flex items-center justify-center gap-3">
        <button
          v-if="view === 'graph-per-site' && $slots['aggregate-detail']"
          type="button"
          :aria-expanded="aggregateExpanded"
          :aria-label="aggregateExpanded ? 'Hide all-sites chart' : 'Show all-sites chart'"
          class="text-dimmed hover:text-default transition-colors flex items-center shrink-0 cursor-pointer"
          @click.stop="aggregateExpanded = !aggregateExpanded"
        >
          <UiIcon name="chevron-right" class="size-4 transition-transform" :class="{ 'rotate-90': aggregateExpanded }" />
        </button>
        <UiIcon v-else name="layers" class="size-4 text-dimmed" aria-hidden="true" />
      </div>
      <div class="flex items-baseline gap-2 min-w-0">
        <span class="text-sm font-semibold text-default truncate">All sites</span>
        <span class="text-xs text-dimmed tabular-nums shrink-0">{{ sites.length }}</span>
      </div>
      <slot name="aggregate-row" />
      <div />
    </div>

    <!-- Narrow All sites row: a compact inline summary, matching the stacked
         per-Site cards below it. -->
    <div
      v-if="isTableLike && sites.length > 1 && $slots['aggregate-row-mobile'] && !gridLayout"
      class="md:hidden flex items-center justify-between gap-3 px-3 py-2.5 border-b border-default bg-elevated/30"
    >
      <div class="flex items-baseline gap-2 min-w-0">
        <button
          v-if="view === 'graph-per-site' && $slots['aggregate-detail']"
          type="button"
          :aria-expanded="aggregateExpanded"
          :aria-label="aggregateExpanded ? 'Hide all-sites chart' : 'Show all-sites chart'"
          class="text-dimmed hover:text-default transition-colors flex items-center shrink-0 cursor-pointer self-center min-h-11 min-w-11 justify-center -m-3"
          @click.stop="aggregateExpanded = !aggregateExpanded"
        >
          <UiIcon name="chevron-right" class="size-4 transition-transform" :class="{ 'rotate-90': aggregateExpanded }" />
        </button>
        <UiIcon v-else name="layers" class="size-4 text-dimmed shrink-0" aria-hidden="true" />
        <span class="text-sm font-semibold text-default truncate">All sites</span>
        <span class="text-xs text-dimmed tabular-nums shrink-0">{{ sites.length }}</span>
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <slot name="aggregate-row-mobile" />
      </div>
    </div>

    <!-- The summed chart under the All sites row (graph-per-site). -->
    <div
      v-if="view === 'graph-per-site' && sites.length > 1 && $slots['aggregate-detail'] && aggregateExpanded && !gridLayout"
      class="px-4 pt-1 pb-2 border-b border-default bg-elevated/20"
    >
      <slot name="aggregate-detail" />
    </div>

    <!-- Card grid, the default layout. Each card heads with the Site, then its
         stats as direct labels, then its chart or breakdown. The All sites
         summary is left out here, as upstream does. One Site gets one
         full-width card rather than half a grid next to an empty slot. -->
    <div v-if="gridLayout" class="grid grid-cols-1 gap-5 items-start" :class="renderSites.length === 1 ? '' : 'sm:grid-cols-2'">
      <div v-for="site in renderSites" :key="site.id" class="group/card space-y-2 min-w-0">
        <div class="border border-default rounded-xl px-3 py-1.5 bg-elevated/20 hover:bg-elevated/40 transition-colors flex items-center gap-3 min-h-11">
          <ProSiteIdentity
            :url="site.domain"
            :name="site.name"
            :to="site.href"
            :size="28"
            hide-subtitle
            favicon-class="rounded-md bg-default p-1"
            class="min-w-0 flex-1"
          />
        </div>
        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-x-5 gap-y-1 px-1">
            <slot
              name="columns"
              :site="site"
              :is-syncing="isSiteSyncing(site.syncStatus)"
              :sync-label="syncLabel(site)"
              layout="grid"
            />
          </div>
          <div v-if="gridExpanded && canExpandRow(site)" class="min-w-0">
            <slot name="row-detail" :site="site" />
          </div>
        </div>
      </div>
    </div>

    <!-- Narrow screens: stacked cards. -->
    <div v-else-if="narrow" class="divide-y divide-default">
      <div
        v-for="site in renderSites"
        :key="site.id"
        class="p-3 transition-colors duration-150 border-l-2 border-l-transparent hover:bg-muted/50"
      >
        <div class="flex items-center gap-3">
          <button
            v-if="canExpandRow(site)"
            type="button"
            :aria-expanded="isRowExpanded(site.id)"
            :aria-label="rowExpandLabel(site.id)"
            class="text-dimmed hover:text-default transition-colors flex items-center justify-center shrink-0 cursor-pointer min-h-11 min-w-11 -m-3"
            @click.stop="toggleRowExpand(site.id)"
          >
            <UiIcon name="chevron-right" class="size-4 transition-transform" :class="{ 'rotate-90': isRowExpanded(site.id) }" />
          </button>
          <div class="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <ProSiteIdentity :url="site.domain" :name="site.name" :to="site.href" v-bind="identityBind" class="min-w-0 flex-1" />
          </div>
          <UiSyncDot v-if="isSiteSyncing(site.syncStatus) || site.syncStatus === 'error'" :status="site.syncStatus" size="2" />
        </div>
        <div class="flex items-center justify-between mt-3">
          <div class="flex items-center gap-4">
            <UiSyncDot v-if="isSiteSyncing(site.syncStatus)" :status="site.syncStatus" :label="syncLabel(site)" />
            <NuxtLink v-else-if="site.syncStatus === 'error'" :to="site.href" class="flex items-center gap-1 hover:underline">
              <UiSyncDot status="error" :label="syncLabel(site)" />
            </NuxtLink>
            <NuxtLink
              v-else-if="!site.connected"
              :to="connectTo"
              class="text-xs text-primary hover:underline flex items-center gap-1 min-h-11"
            >
              <UiIcon name="plug" class="size-3" aria-hidden="true" />
              Connect Search Console
            </NuxtLink>
            <slot v-else name="mobile" :site="site" />
          </div>
          <NuxtLink :to="site.href" :aria-label="`Open ${site.name}`" class="text-xs text-primary hover:underline inline-flex items-center min-h-11" @click.stop>
            Open
          </NuxtLink>
        </div>
        <div v-if="canExpandRow(site) && isRowExpanded(site.id)" class="mt-3">
          <slot name="row-detail" :site="site" />
        </div>
      </div>
    </div>

    <!-- Desktop table rows. -->
    <div v-else :class="listClass">
      <div
        v-for="site in renderSites"
        :key="site.id"
        :class="rowClass"
        :style="gridStyle"
      >
        <div class="flex items-center justify-center gap-3">
          <button
            v-if="canExpandRow(site)"
            type="button"
            :aria-expanded="isRowExpanded(site.id)"
            :aria-label="rowExpandLabel(site.id)"
            class="text-dimmed hover:text-default transition-colors flex items-center shrink-0 cursor-pointer"
            @click.stop="toggleRowExpand(site.id)"
          >
            <UiIcon name="chevron-right" class="size-4 transition-transform" :class="{ 'rotate-90': isRowExpanded(site.id) }" />
          </button>
        </div>
        <div class="flex items-center gap-2 min-w-0 overflow-hidden">
          <ProSiteIdentity :url="site.domain" :name="site.name" :to="site.href" v-bind="identityBind" class="min-w-0 flex-1" />
        </div>
        <slot
          name="columns"
          :site="site"
          :is-syncing="isSiteSyncing(site.syncStatus)"
          :sync-label="syncLabel(site)"
          layout="rows"
        />
        <div class="flex items-center justify-end gap-2">
          <NuxtLink :to="site.href" :aria-label="`Open ${site.name}`" class="text-xs text-primary hover:underline" @click.stop>
            Open
          </NuxtLink>
        </div>
        <div v-if="canExpandRow(site) && isRowExpanded(site.id)" :class="rowDetailClass">
          <slot name="row-detail" :site="site" />
        </div>
      </div>
    </div>
  </div>
</template>
