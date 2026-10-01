<script setup lang="ts">
import type { GscColumn } from '@gscdump/sdk/period-presets'
import type { GscDimension } from '../../../shared/gsc-dimension'
import { computed, ref } from 'vue'
import { countryData } from '~~/layers/design-system/app/utils/countries'
import { UiFilterMenu, UiIcon, UiInput, UiMetricToggle, UiTogglePill } from '#components'
import { useGscSavedFilters } from '../../composables/useGscSavedFilters'
import { GSC_COLUMN_OPTIONS, GSC_COLUMN_TOOLTIPS, GSC_ENTITY_COUNT_OPTIONS, useProGscFilters } from '../../composables/useProGscFilters'
import DateRangePicker from './ProDateRangePicker.vue'
import SearchTypePicker from './SearchTypePicker.vue'

interface FilterDimension { label: string, value: string, icon: string }
type DeviceClicks = { DESKTOP: number, MOBILE: number, TABLET: number } | null

// Canonical GSC control bar — date range, comparison, search type, optional
// breakdown view/dimension, metric toggles and the Country/Device facet menu.
// Reads the shared (URL/cookie-synced) `useProGscFilters()` state directly so
// every consumer (portfolio overview + per-site search-console) drives the same
// slice. Visibility props let each surface show only the controls that apply to
// it; `view`/`dimension` are v-models so the parent owns the URL-synced refs
// (avoids duplicate sync watchers).
const {
  showCompare = true,
  showStable = true,
  showMetrics = false,
  showCounts = false,
  showFilter = true,
  showBrand = false,
  showQuestions = false,
  showView = false,
  showDimension = false,
  filterDimensions = [
    { label: 'Country', value: 'country', icon: 'globe' },
    { label: 'Device', value: 'device', icon: 'monitor' },
  ],
  deviceClicks = null,
  switching = false,
} = defineProps<{
  showCompare?: boolean
  showStable?: boolean
  showMetrics?: boolean
  /** Offer the Queries/Pages entity counts in the metric segment. Only the SC
   * Overview renders those counts — the Query/Page breakdowns already LEAD with
   * the same number, so a toggle there would control nothing. */
  showCounts?: boolean
  /** Show the Country/Device facet rows. Only meaningful where the backing view
   * carries those columns (the portfolio trend); per-site breakdown tables can't
   * cross-filter, so leave off there. */
  showFilter?: boolean
  /** Show the Brand row (All/Branded/Non-branded) — a query-text regex facet.
   * Only meaningful on query-bearing breakdowns (the Queries tab). */
  showBrand?: boolean
  /** Show the Questions row (All/Questions/Non-questions) — question-intent
   * regex facet on the canonical query. Query-bearing breakdowns only. */
  showQuestions?: boolean
  showView?: boolean
  showDimension?: boolean
  filterDimensions?: FilterDimension[]
  deviceClicks?: DeviceClicks
  /** True while the caller's own search-type fan-out is refetching — threads an
   * immediate pending cue into the SearchTypePicker trigger so a slice switch
   * (e.g. web → image) isn't a dead click while the data panels catch up. */
  switching?: boolean
  /** Site the `annotations` slot controls, when a surface fills it. */
  siteId?: string
}>()

const view = defineModel<'graph' | 'table' | 'trend'>('view', { default: 'graph' })
const dimension = defineModel<GscDimension>('dimension', { default: 'dates' })

const {
  period,
  compareMode,
  stableData,
  searchType,
  country,
  device,
  brand,
  questions,
  supportsDimensions,
  supportsQueries,
  toggleColumn,
  isColumnActive,
  toggleEntityCount,
  isEntityCountActive,
  resetFacets,
} = useProGscFilters()

const BRAND_OPTIONS = [
  { value: 'branded', label: 'Branded' },
  { value: 'nonbranded', label: 'Non-branded' },
] as const

const QUESTION_OPTIONS = [
  { value: 'questions', label: 'Questions' },
  { value: 'nonquestions', label: 'Non-questions' },
] as const

function brandLabel(v: string) {
  return BRAND_OPTIONS.find(o => o.value === v)?.label ?? ''
}

function questionLabel(v: string) {
  return QUESTION_OPTIONS.find(o => o.value === v)?.label ?? ''
}

// The facet rows shown in the menu follow what the toolbar above has selected:
// Country/Device when `showFilter` (and the slice supports them), plus the
// query-text facets (Brand, Questions) when the surface asks for them OR the
// user turned the Queries count on — the moment queries are on the row, slicing
// them by brand/intent is the next question. Both need a query-bearing slice.
const queriesInPlay = computed(() => isEntityCountActive('queries'))
const menuDimensions = computed<FilterDimension[]>(() => [
  ...(showFilter && supportsDimensions.value ? filterDimensions : []),
  ...((showBrand || queriesInPlay.value) && supportsQueries.value ? [{ label: 'Brand', value: 'brand', icon: 'i-lucide-tag' }] : []),
  ...((showQuestions || queriesInPlay.value) && supportsQueries.value ? [{ label: 'Questions', value: 'questions', icon: 'i-lucide-help-circle' }] : []),
])
const showFilterMenu = computed(() => menuDimensions.value.length > 0)

// Position/CTR are meaningless for the Discover/Google News slices (no query or
// ranking dimension), so only offer clicks/impressions there.
const metricOptions = computed(() =>
  (supportsQueries.value ? GSC_COLUMN_OPTIONS : GSC_COLUMN_OPTIONS.filter(c => c.key === 'clicks' || c.key === 'impressions'))
    .map(option => ({ ...option, tooltip: GSC_COLUMN_TOOLTIPS[option.key] })),
)

// Entity counts ride the SAME segment as the chart metrics: from the user's
// side "what do I want on this row" is one question, and these two answer the
// surface half of it (how many queries / pages, not how much traffic). They
// need a query-bearing slice — Discover and Google News report neither.
const entityCountOptions = computed(() =>
  showCounts && supportsQueries.value ? GSC_ENTITY_COUNT_OPTIONS : [],
)
const metricToggleOptions = computed(() => [...metricOptions.value, ...entityCountOptions.value])
const activeMetricToggles = computed(() => [
  ...metricOptions.value.filter(c => isColumnActive(c.key)).map(c => c.key as string),
  ...entityCountOptions.value.filter(c => isEntityCountActive(c.key)).map(c => c.key as string),
])

function onMetricToggle(key: string): void {
  const entity = entityCountOptions.value.find(o => o.key === key)
  if (entity)
    toggleEntityCount(entity.key)
  else
    toggleColumn(key as GscColumn)
}

// Search type gates the dimension picker (ADR target-state §3). Discover/Google
// News carry only clicks/impressions by Date and Page — no query, position,
// device or country breakdown — so Query/Country are dropped from the picker
// rather than offered and rendered empty. Dates + Page survive for every type.
// Labels + glyphs match the portfolio tab strip (`ProGscPortfolioTabs`) and the
// SC Overview's trailing entity counts one-for-one — `search` = queries,
// `file` = pages — so one shape and one word mean one slice everywhere.
const DIMENSION_OPTIONS: { value: GscDimension, label: string, icon: string }[] = [
  { value: 'dates', label: 'Dates', icon: 'calendar' },
  { value: 'query', label: 'Queries', icon: 'search' },
  { value: 'page', label: 'Pages', icon: 'file' },
  { value: 'country', label: 'Countries', icon: 'globe' },
]
const gatedDimensions = computed(() => DIMENSION_OPTIONS.filter((o) => {
  if (o.value === 'query')
    return supportsQueries.value
  if (o.value === 'country')
    return supportsDimensions.value
  return true
}))

// Auto-reseat: if the active dimension becomes illegal for the new search type
// (e.g. on Query, then switch to Discover), clamp to Dates so no empty panel can
// render. The page's own `sanitize` only guards unknown keys; Query/Country are
// known-but-illegal here, so this explicit reseat is required.
watch(gatedDimensions, (opts) => {
  if (!opts.some(o => o.value === dimension.value))
    dimension.value = 'dates'
}, { immediate: true })

// "Show as" — the dimension-aware representation segment that replaces the old
// global Graph/Table toggle (ADR target-state §1). The word "Graph" meant three
// different things (time series / ranked list / scatter); each dimension now
// names what its two representations actually are. The underlying binary stays
// `view` (`graph` = the dimension's primary viz, `table` = its dense second
// representation), so the (dimension, view) → component map in overview.vue is
// the single source of truth for what each slot renders.
interface ShowAsOption { value: 'graph' | 'table' | 'trend', label: string, icon: string }
// Fixed 2-tuple for every dimension except Country, which added a third rep
// (Trend — the top-5-countries stacked chart, manual-review-2026-08) alongside
// its existing Map/Ranked pair.
const SHOW_AS_BY_DIMENSION: Record<GscDimension, ShowAsOption[]> = {
  // Dates' second rep is the per-site table: the same portfolio totals decomposed
  // by site, sortable, with a pinned "All sites" row. "By site" names what it is
  // (the old "Scoreboard" named a vibe the unsortable table didn't earn).
  dates: [{ value: 'graph', label: 'Trend', icon: 'chart' }, { value: 'table', label: 'By Site', icon: 'table' }],
  // Query/Page: Ranked entities, or Trend = that dimension's count ranked over time.
  query: [{ value: 'graph', label: 'Ranked', icon: 'i-lucide-list-ordered' }, { value: 'table', label: 'Trend', icon: 'chart' }],
  page: [{ value: 'graph', label: 'Ranked', icon: 'i-lucide-list-ordered' }, { value: 'table', label: 'Trend', icon: 'chart' }],
  // Country: the scatter Map is primary, Ranked is the dense list, and Trend is
  // the new top-5-countries stacked chart over time.
  country: [
    { value: 'graph', label: 'Map', icon: 'i-lucide-scatter-chart' },
    { value: 'table', label: 'Ranked', icon: 'i-lucide-list-ordered' },
    { value: 'trend', label: 'Trend', icon: 'chart' },
  ],
}
const showAsOptions = computed(() => SHOW_AS_BY_DIMENSION[dimension.value])

const { saved, add: addSavedFilter, remove: removeSavedFilter } = useGscSavedFilters()

const countryItems = computed(() =>
  Object.entries(countryData)
    .map(([code, d]) => ({ label: d.name, value: code, icon: `i-circle-flags:${d.alpha2}` }))
    .sort((a, b) => a.label.localeCompare(b.label)),
)

function deviceLabel(v: string) {
  return v ? v[0] + v.slice(1).toLowerCase() : ''
}

const DEVICE_OPTIONS = [
  { value: 'DESKTOP', label: 'Desktop', icon: 'monitor' },
  { value: 'MOBILE', label: 'Mobile', icon: 'smartphone' },
  { value: 'TABLET', label: 'Tablet', icon: 'i-lucide-tablet' },
]

// Filter dimension rows + their current applied value (shown trailing the row).
const dimensionValues = computed<Record<string, string>>(() => ({
  ...(country.value ? { country: countryData[country.value]?.name ?? country.value } : {}),
  ...(device.value ? { device: deviceLabel(device.value) } : {}),
  ...(brand.value ? { brand: brandLabel(brand.value) } : {}),
  ...(questions.value ? { questions: questionLabel(questions.value) } : {}),
}))

// Count only facets that are actually rendered for the current props (the
// `menuDimensions` rows) and carry an applied value (`dimensionValues`). A facet
// persisted in shared state but hidden on this tab (e.g. a stale country on the
// per-site Queries breakdown) must not inflate the "Filter (N active)" badge.
const facetCount = computed(() =>
  menuDimensions.value.filter(d => !!dimensionValues.value[d.value]).length,
)

// Country picker search (within the dimension sub-view).
const countrySearch = ref('')
const filteredCountries = computed(() => {
  const q = countrySearch.value.trim().toLowerCase()
  return q ? countryItems.value.filter(c => c.label.toLowerCase().includes(q)) : countryItems.value
})
const deviceTotal = computed(() => {
  const d = deviceClicks
  return d ? d.DESKTOP + d.MOBILE + d.TABLET : 0
})
function devicePct(value: string): number {
  const d = deviceClicks
  if (!d || deviceTotal.value <= 0)
    return 0
  return Math.round(((d[value as keyof typeof d] ?? 0) / deviceTotal.value) * 100)
}

function onSaveFilter() {
  const parts: string[] = []
  if (country.value)
    parts.push(countryData[country.value]?.name ?? country.value)
  if (device.value)
    parts.push(deviceLabel(device.value))
  addSavedFilter({
    label: parts.length ? parts.join(' · ') : `Saved filter ${saved.value.length + 1}`,
    q: '',
    filter: 'default',
    country: country.value,
    device: device.value,
  })
}

function onApplySavedFilter(id: string) {
  const sf = saved.value.find(s => s.id === id)
  if (!sf)
    return
  country.value = sf.country
  device.value = sf.device
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <DateRangePicker
      v-model:period="period"
      v-model:compare-mode="compareMode"
      v-model:stable-data="stableData"
      :show-compare="showCompare"
      :show-stable="showStable"
    />
    <SearchTypePicker v-model:search-type="searchType" :switching="switching" />

    <!-- Order follows the dependency chain: search type gates the Dimension
         options, and the Dimension drives the "Show as" representations — so the
         segment sits before the one it parameterises. -->
    <!-- Breakdown dimension — flat segmented control, gated by search type
         (Discover/Google News drop Query + Country). Promoted out of the old
         dropdown so Queries and Pages read as first-class slices in the toolbar
         row instead of hiding one click deep. -->
    <UiTogglePill
      v-if="showDimension"
      v-model="dimension"
      :options="gatedDimensions"
      label="Breakdown"
      class="max-w-full overflow-x-auto"
    />

    <!-- "Show as" — dimension-aware representation segment (replaces the old
         Graph/Table toggle). Labels relabel per dimension: Trend/Ranked/Map for
         the primary viz, Scoreboard for the dense table. -->
    <UiTogglePill
      v-if="showView"
      v-model="view"
      :options="showAsOptions"
      label="Show as"
    />

    <!-- Icon-only metric toggles (clicks/views/CTR/position) plus the two
         entity counts (queries/pages), seogets-style. Each carries a tooltip —
         a row of four-plus bare glyphs is otherwise a guessing game. -->
    <UiMetricToggle
      v-if="showMetrics"
      icon-only
      :options="metricToggleOptions"
      :model-value="activeMetricToggles"
      @toggle="onMetricToggle"
    />

    <!-- Chart annotations sit here, joined like the metric toggle beside them.
         The annotation model is not in this app yet, so the bar owns the slot
         and its chrome while a later surface fills it. -->
    <div
      v-if="$slots.annotations"
      class="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--ui-bg-elevated)]/60 border border-default"
      role="group"
      aria-label="Chart annotations"
    >
      <slot name="annotations" :site-id="siteId" />
    </div>

    <!-- Country/Device/Brand facets only apply to query-bearing slices (not Discover/Google News). -->
    <UiFilterMenu
      v-if="showFilterMenu"
      :searchable="false"
      :dimensions="menuDimensions"
      :dimension-values="dimensionValues"
      :saved-filters="saved"
      :active-count="facetCount"
      @apply-saved="onApplySavedFilter"
      @remove-saved="removeSavedFilter"
      @save="onSaveFilter"
      @clear="resetFacets"
    >
      <!-- Dimension value pickers (seogets two-level popover). -->
      <template #picker="{ dimension: dim, close }">
        <!-- Country: searchable flag list -->
        <div v-if="dim === 'country'" class="space-y-1.5">
          <UiInput
            v-model="countrySearch"
            placeholder="Search countries…"
            aria-label="Search countries"
            icon="search"
            size="xs"
            autocomplete="off"
            class="w-full"
          />
          <button
            v-if="country"
            type="button"
            class="cursor-pointer w-full flex items-center gap-2 px-1.5 py-1 rounded-md text-xs text-muted hover:text-default hover:bg-[var(--ui-bg-elevated)]/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
            @click="country = ''; close()"
          >
            <UiIcon name="globe" class="size-3.5 shrink-0 text-dimmed" aria-hidden="true" />
            <span class="flex-1 text-left">All countries</span>
          </button>
          <div class="max-h-56 overflow-y-auto -mx-0.5">
            <button
              v-for="c in filteredCountries"
              :key="c.value"
              type="button"
              :aria-pressed="country === c.value"
              class="cursor-pointer w-full flex items-center gap-2 px-1.5 py-1 rounded-md text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
              :class="country === c.value ? 'text-default bg-elevated' : 'text-muted hover:text-default hover:bg-[var(--ui-bg-elevated)]/50'"
              @click="country = c.value; close()"
            >
              <UiIcon :name="c.icon" class="size-4 shrink-0 rounded-sm" aria-hidden="true" />
              <span class="flex-1 text-left truncate">{{ c.label }}</span>
              <UiIcon v-if="country === c.value" name="check" class="size-3 text-primary shrink-0" aria-hidden="true" />
            </button>
          </div>
        </div>

        <!-- Device: options with their share of clicks -->
        <div v-else-if="dim === 'device'" class="space-y-1">
          <button
            v-if="device"
            type="button"
            class="cursor-pointer w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-mini text-muted hover:text-default hover:bg-[var(--ui-bg-elevated)]/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
            @click="device = ''; close()"
          >
            <UiIcon name="layers" class="size-3.5 shrink-0 text-dimmed" aria-hidden="true" />
            <span class="flex-1 text-left">All devices</span>
          </button>
          <button
            v-for="d in DEVICE_OPTIONS"
            :key="d.value"
            type="button"
            :aria-pressed="device === d.value"
            class="cursor-pointer w-full flex items-center gap-2 px-2 py-1.5 rounded-md border text-mini font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :class="device === d.value ? 'border-accented text-default' : 'border-transparent text-muted hover:text-default'"
            @click="device = device === d.value ? '' : d.value; close()"
          >
            <UiIcon :name="d.icon" class="size-3.5 shrink-0" aria-hidden="true" />
            <span class="flex-1 text-left">{{ d.label }}</span>
            <span v-if="deviceClicks" class="text-dimmed tabular-nums">{{ devicePct(d.value) }}%</span>
          </button>
        </div>

        <!-- Brand: classify queries by the site's brand terms (regex facet). -->
        <div v-else-if="dim === 'brand'" class="space-y-1">
          <button
            v-if="brand"
            type="button"
            class="cursor-pointer w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-mini text-muted hover:text-default hover:bg-[var(--ui-bg-elevated)]/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
            @click="brand = ''; close()"
          >
            <UiIcon name="i-lucide-tag" class="size-3.5 shrink-0 text-dimmed" aria-hidden="true" />
            <span class="flex-1 text-left">All queries</span>
          </button>
          <button
            v-for="b in BRAND_OPTIONS"
            :key="b.value"
            type="button"
            :aria-pressed="brand === b.value"
            class="cursor-pointer w-full flex items-center gap-2 px-2 py-1.5 rounded-md border text-mini font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :class="brand === b.value ? 'border-accented text-default' : 'border-transparent text-muted hover:text-default'"
            @click="brand = brand === b.value ? '' : b.value; close()"
          >
            <span class="flex-1 text-left">{{ b.label }}</span>
            <UiIcon v-if="brand === b.value" name="check" class="size-3 text-primary shrink-0" aria-hidden="true" />
          </button>
        </div>

        <!-- Questions: classify queries by question-intent (regex on canonical query). -->
        <div v-else-if="dim === 'questions'" class="space-y-1">
          <button
            v-if="questions"
            type="button"
            class="cursor-pointer w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-mini text-muted hover:text-default hover:bg-[var(--ui-bg-elevated)]/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
            @click="questions = ''; close()"
          >
            <UiIcon name="i-lucide-help-circle" class="size-3.5 shrink-0 text-dimmed" aria-hidden="true" />
            <span class="flex-1 text-left">All queries</span>
          </button>
          <button
            v-for="qOpt in QUESTION_OPTIONS"
            :key="qOpt.value"
            type="button"
            :aria-pressed="questions === qOpt.value"
            class="cursor-pointer w-full flex items-center gap-2 px-2 py-1.5 rounded-md border text-mini font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :class="questions === qOpt.value ? 'border-accented text-default' : 'border-transparent text-muted hover:text-default'"
            @click="questions = questions === qOpt.value ? '' : qOpt.value; close()"
          >
            <span class="flex-1 text-left">{{ qOpt.label }}</span>
            <UiIcon v-if="questions === qOpt.value" name="check" class="size-3 text-primary shrink-0" aria-hidden="true" />
          </button>
        </div>
      </template>
    </UiFilterMenu>
  </div>
</template>
