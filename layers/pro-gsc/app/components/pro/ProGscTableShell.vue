<script setup lang="ts" generic="T extends object">
import type { UiTableColumn, UiTableRowId, UiTableSize } from '~~/layers/design-system/app/shared/table'
import { refDebounced } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { countryData } from '~~/layers/design-system/app/utils/countries'
import { UiAlert, UiButton, UiFilterMenu, UiIcon, UiInput, UiSkeleton, UiTable, UPagination } from '#components'
import { useProHumanFriendlyNumber } from '#imports'
import { useGscSavedFilters } from '../../composables/useGscSavedFilters'
import { useProGscFilters } from '../../composables/useProGscFilters'
import GscFilterBar from './GscFilterBar.vue'
import ProGscdumpError from './ProGscdumpError.vue'

interface FilterDef {
  key: string
  label: string
  icon: string
  special?: boolean
  tooltip: string
}

const {
  filters = [],
  searchPlaceholder = 'Search...',
  emptyIcon = 'search',
  emptyTitle = 'No results found',
  emptyDefaultDescription = 'Data will appear once Google Search Console syncs',
  itemLabel = 'items',
  searchable = true,
  pagination = true,
  pageSize = 12,
  facets = false,
  loadMore = false,
  hasMore = false,
  isLoadingMore = false,
  loadedCount = 0,
  hasExternalFilter = false,
  showSavedFilters = true,
  rowClickable = false,
  tableSize = 'md',
  sortable = false,
  hasCachedData,
  // Vue casts an absent boolean prop to `false`, which reads as "the previous
  // period has no data". A table with no comparison (the indexing URLs) never
  // passes it, so absent must stay `undefined` and the notice stays hidden.
  hasPrevData = undefined,
  dimension,
  tableLabel,
  sort,
  q,
  filter,
  page,
  error,
  rows,
} = defineProps<{
  filters?: FilterDef[]
  searchPlaceholder?: string
  emptyIcon?: string
  emptyTitle?: string
  emptyDefaultDescription?: string
  itemLabel?: string
  searchable?: boolean
  pagination?: boolean
  pageSize?: number
  /** Render the country/device facet bar. */
  facets?: boolean
  /** Accumulating load-more mode (replaces the paged footer with a Load-more button). */
  loadMore?: boolean
  /** Whether more rows exist beyond what's loaded. */
  hasMore?: boolean
  /** Fetching the next page (spins the Load-more button). */
  isLoadingMore?: boolean
  /** Rows loaded so far (for the "Showing X of Y" line). */
  loadedCount?: number
  /** Another consumer-owned filter is active, such as an indexing issue. */
  hasExternalFilter?: boolean
  /** Saved filters add no value on task-specific tables. */
  showSavedFilters?: boolean
  /** Successful response presence, including a valid empty result. */
  hasCachedData?: boolean
  rowClickable?: boolean
  rowId?: UiTableRowId<T>
  initialExpandedRowId?: string
  tableSize?: UiTableSize
  /** Accessible name for the table element. Defaults to the item label. */
  tableLabel?: string
  sortable?: boolean
  sort?: { column: string, direction: 'asc' | 'desc' }
  /** The table's GSC dimension — its own facet is hidden in the bar. */
  dimension?: string
  // Table state
  q: string
  filter: string | undefined
  isLoading: boolean
  error: unknown
  rows: T[]
  total: number
  page: number
  columns: UiTableColumn<T>[]
  tableData: T[]
  hasPrevData?: boolean
  warnings?: string[]
}>()

const emit = defineEmits<{
  'update:q': [value: string]
  'update:page': [value: number]
  'toggleFilter': [key: string]
  'clearFilters': []
  'loadMore': []
  'retry': []
  'rowClick': [row: T]
  'sortColumn': [column: string]
}>()

// The table element always needs an accessible name. A caller that only says
// what its rows are ("countries") gets that as the name rather than nothing.
const accessibleTableLabel = computed(() => tableLabel || itemLabel || 'Data table')

const localQ = ref(q)
const debouncedQ = refDebounced(localQ, 300)

const localPage = computed({
  get: () => page,
  set: (v: number) => emit('update:page', v),
})
const tableSorting = computed(() => sort
  ? [{ id: sort.column, desc: sort.direction === 'desc' }]
  : [])
const cachedEvidence = computed(() => hasCachedData ?? rows.length > 0)
const blockingError = computed(() => error && !cachedEvidence.value ? error : null)
const refreshError = computed(() => error && cachedEvidence.value ? error : null)
const hasActiveFilter = computed(() =>
  Boolean(q || (filter && filter !== 'default') || hasExternalFilter),
)
const paginationUi = {
  first: 'min-h-11 min-w-11 sm:min-h-8 sm:min-w-8',
  prev: 'min-h-11 min-w-11 sm:min-h-8 sm:min-w-8',
  item: 'min-h-11 min-w-11 sm:min-h-8 sm:min-w-8',
  next: 'min-h-11 min-w-11 sm:min-h-8 sm:min-w-8',
  last: 'min-h-11 min-w-11 sm:min-h-8 sm:min-w-8',
} as const

watch(() => q, (value) => {
  if (value !== localQ.value)
    localQ.value = value
})

watch(debouncedQ, (value) => {
  if (value === q)
    return
  emit('update:q', value)
  emit('update:page', 1)
})

function commitQ(value = localQ.value) {
  localQ.value = value
  if (value !== q)
    emit('update:q', value)
  emit('update:page', 1)
}

// Wire the presentational GscFilterBar to URL-synced Pro facet state.
// `countryData` is auto-imported from `design-system/app/utils/countries.ts`.
const { country, device } = useProGscFilters()
const countryItems = computed(() =>
  Object.entries(countryData)
    .map(([code, d]) => ({ label: d.name, value: code, icon: `i-circle-flags:${d.alpha2}` }))
    .sort((a, b) => a.label.localeCompare(b.label)),
)

// UiFilterMenu consolidates the preset chips, search and facets into one popover.
const { saved, add: addSavedFilter, remove: removeSavedFilter } = useGscSavedFilters()

const presetFilters = computed(() => filters.map(f => ({ id: f.key, label: f.label, icon: f.icon })))

function clearOwnedFilters() {
  commitQ('')
  if (filter && filter !== 'default')
    emit('toggleFilter', filter)
  country.value = ''
  device.value = ''
}

function clearAllFilters() {
  if (hasExternalFilter)
    emit('clearFilters')
  else
    clearOwnedFilters()
}

// Badge counts popover-only filters — search is shown inline so it signals itself.
// Country/Device only count when this shell actually renders the facet picker
// (`facets`); otherwise a value persisted in shared state but unmanageable here
// (e.g. a `device` left over from another tab) would inflate the badge to "(1)"
// with nothing in the popover to see or clear — and it isn't even applied to a
// single-dimension breakdown that doesn't pass those facets to its query.
const activeCount = computed(() =>
  (filter && filter !== 'default' ? 1 : 0)
  + (facets && country.value ? 1 : 0)
  + (facets && device.value ? 1 : 0))

function deviceLabel(v: string) {
  return v ? v[0] + v.slice(1).toLowerCase() : ''
}

function onApplyPreset(id: string) {
  emit('toggleFilter', id)
}

function onSave() {
  const parts: string[] = []
  if (localQ.value)
    parts.push(`"${localQ.value}"`)
  const presetLabel = filters.find(f => f.key === filter)?.label
  if (presetLabel)
    parts.push(presetLabel)
  if (country.value)
    parts.push(countryData[country.value]?.name ?? country.value)
  if (device.value)
    parts.push(deviceLabel(device.value))
  addSavedFilter({
    label: parts.length ? parts.join(' · ') : `Saved filter ${saved.value.length + 1}`,
    q: localQ.value ?? '',
    filter: filter ?? 'default',
    country: country.value,
    device: device.value,
  })
}

function onApplySaved(id: string) {
  const sf = saved.value.find(s => s.id === id)
  if (!sf)
    return
  emit('update:q', sf.q)
  const target = sf.filter || 'default'
  const current = filter || 'default'
  if (target !== current) {
    // toggleFilter(x) sets the filter to x when the current value differs.
    emit('toggleFilter', target === 'default' ? current : target)
  }
  country.value = sf.country
  device.value = sf.device
  emit('update:page', 1)
}
</script>

<template>
  <div
    data-testid="gsc-table-shell"
    class="space-y-4"
    :aria-busy="isLoading || isLoadingMore || undefined"
  >
    <!-- Header: always-visible search + consolidated Filter popover -->
    <!-- Wraps on a phone, so toolbar chips (an active issue filter) move below
         the search instead of pushing the Filter button off screen. -->
    <div v-if="searchable || filters.length || facets" class="flex flex-wrap items-center justify-between gap-2">
      <div v-if="searchable" class="min-w-48 flex-1 sm:flex-none sm:w-64">
        <UiInput
          v-model="localQ"
          :placeholder="searchPlaceholder"
          :aria-label="searchPlaceholder"
          icon="search"
          autocomplete="off"
          size="sm"
          :ui="{ base: 'min-h-11 sm:min-h-10' }"
          data-inp-target="gsc-table-search"
          @keydown.enter="commitQ()"
        >
          <template #trailing>
            <UiButton
              v-if="localQ !== ''"
              purpose="quiet"
              icon="close"
              size="xs"
              class="min-h-11 min-w-11 sm:min-h-0 sm:min-w-0"
              aria-label="Clear search"
              @click="commitQ('')"
            />
          </template>
        </UiInput>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-1">
        <slot name="toolbar" />
        <UiFilterMenu
          :searchable="false"
          :preset-filters="presetFilters"
          :active-preset="filter"
          :saved-filters="saved"
          :active-count="activeCount"
          :show-saved="showSavedFilters"
          @apply-preset="onApplyPreset"
          @apply-saved="onApplySaved"
          @remove-saved="removeSavedFilter"
          @save="onSave"
          @clear="clearOwnedFilters"
        >
          <template v-if="facets" #facets>
            <GscFilterBar
              v-model:country="country"
              v-model:device="device"
              :country-items="countryItems"
              :dimension="dimension"
            />
          </template>
        </UiFilterMenu>
      </div>
    </div>

    <!-- Extra notices slot (e.g. enrichment due) -->
    <slot name="notices" />

    <UiAlert
      v-if="refreshError"
      status="warning"
      title="Latest refresh failed"
      description="Showing the last successful report."
    >
      <template #action>
        <UiButton purpose="secondary" size="xs" class="min-h-11 sm:min-h-0" @click="emit('retry')">
          Retry
        </UiButton>
      </template>
    </UiAlert>

    <!-- Data warnings from API (e.g. incomplete date range, auth issues) -->
    <div v-if="!isLoading && warnings?.length" class="flex items-start gap-2 px-3 py-2 rounded-lg bg-elevated border border-accented text-sm text-warning">
      <UiIcon name="warning" class="size-4 shrink-0 mt-0.5" />
      <div class="space-y-0.5">
        <p v-for="(w, i) in warnings" :key="i">
          {{ w }}
        </p>
      </div>
    </div>

    <!-- No comparison data notice -->
    <div v-if="!isLoading && hasPrevData === false" class="flex items-center gap-2 px-3 py-2 rounded-lg bg-elevated border border-default text-sm text-muted">
      <UiIcon name="note" class="size-4 shrink-0" />
      <span>Comparison unavailable. Both periods need complete recorded Search Console data.</span>
    </div>

    <!-- Loading skeleton (suppressed while paging in load-more — the table stays put) -->
    <div v-if="isLoading && !isLoadingMore" class="rounded-xl border border-default overflow-hidden">
      <slot name="skeleton">
        <div class="bg-[var(--ui-bg-elevated)]/50 px-5 py-3 border-b border-default">
          <div class="flex gap-8">
            <UiSkeleton class="h-3" :index="0" :base="64" :range="20" />
            <UiSkeleton class="h-3" :index="1" :base="48" :range="16" />
            <UiSkeleton class="h-3" :index="2" :base="56" :range="18" />
            <UiSkeleton class="h-3" :index="3" :base="40" :range="14" />
            <UiSkeleton class="h-3" :index="4" :base="48" :range="16" />
          </div>
        </div>
        <div class="divide-y divide-default">
          <div v-for="i in Math.min(pageSize, 10)" :key="i" class="px-5 py-4 flex items-center gap-6">
            <div class="flex-1 space-y-2">
              <UiSkeleton class="h-4" :index="i" :base="180" :range="80" />
            </div>
            <UiSkeleton class="h-4" :index="i + 10" :base="48" :range="16" />
            <UiSkeleton class="h-4" :index="i + 20" :base="56" :range="18" />
            <UiSkeleton class="h-4" :index="i + 30" :base="40" :range="14" />
            <UiSkeleton class="h-5" :index="i + 40" :base="32" :range="12" />
          </div>
        </div>
      </slot>
    </div>

    <!-- Error state -->
    <div v-else-if="blockingError" class="rounded-xl border border-dashed border-default bg-[var(--ui-bg-elevated)]/5">
      <ProGscdumpError :error="blockingError" @retry="$emit('retry')" />
    </div>

    <!-- Empty state -->
    <div v-else-if="!rows.length && !isLoading" data-testid="table-empty-state" class="rounded-xl border border-dashed border-default bg-[var(--ui-bg-elevated)]/5 py-16">
      <div class="text-center max-w-sm mx-auto">
        <div class="inline-flex items-center justify-center size-14 rounded-2xl bg-accented mb-4">
          <UiIcon :name="emptyIcon" class="size-7 text-dimmed" />
        </div>
        <h3 class="text-sm font-semibold text-default mb-1">
          {{ emptyTitle }}
        </h3>
        <p class="text-sm text-muted mb-4">
          <template v-if="q">
            No {{ itemLabel }} match "<span class="font-medium text-default">{{ q }}</span>"
          </template>
          <template v-else-if="(filter && filter !== 'default') || hasExternalFilter">
            No {{ itemLabel }} match the selected filter
          </template>
          <template v-else>
            {{ emptyDefaultDescription }}
          </template>
        </p>
        <UiButton
          v-if="hasActiveFilter"
          size="sm"
          purpose="secondary"
          class="min-h-11 sm:min-h-0"
          @click="clearAllFilters"
        >
          Clear filters
        </UiButton>
      </div>
    </div>

    <!-- Data Table -->
    <UiTable
      v-else
      :data="tableData"
      :columns="columns"
      :page-size="pageSize"
      bordered
      :row-clickable="rowClickable"
      :row-id="rowId"
      :initial-expanded-row-id="initialExpandedRowId"
      :size="tableSize"
      :label="accessibleTableLabel"
      :enable-sorting="sortable"
      :manual-sorting="sortable"
      :sorting="tableSorting"
      disable-pagination
      row-hover
      @row-click="emit('rowClick', $event)"
      @sort-column="emit('sortColumn', $event)"
    >
      <template v-if="$slots['expanded-component']" #expanded-component="{ row }">
        <slot name="expanded-component" :row="row" />
      </template>
      <template v-if="$slots.actions" #actions="{ row }">
        <slot name="actions" :row="row" />
      </template>
    </UiTable>
  </div>

  <!-- Load more (accumulating) -->
  <div v-if="loadMore && rows.length" class="flex flex-col items-center gap-3 pt-2">
    <p class="text-sm text-muted">
      Showing <span class="font-medium text-default">{{ useProHumanFriendlyNumber(loadedCount) }}</span>
      <template v-if="total > loadedCount">
        of <span class="font-medium text-default">{{ useProHumanFriendlyNumber(total) }}</span>
      </template>
      {{ itemLabel }}
    </p>
    <UiButton
      v-if="hasMore"
      purpose="secondary"
      size="sm"
      :loading="isLoadingMore"
      @click="emit('loadMore')"
    >
      Load more
    </UiButton>
  </div>

  <!-- Pagination (non-load-more consumers). Wraps on a phone: seven 44px
       targets and the total do not fit one 358px row. -->
  <div v-else-if="pagination !== false && total > pageSize" class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-2">
    <p class="text-sm text-muted">
      <span class="font-medium text-default">{{ useProHumanFriendlyNumber(total) }}</span> {{ itemLabel }} total
    </p>
    <UPagination
      v-model:page="localPage"
      size="sm"
      :items-per-page="pageSize"
      :total="total"
      :sibling-count="1"
      :ui="paginationUi"
    />
  </div>
</template>
