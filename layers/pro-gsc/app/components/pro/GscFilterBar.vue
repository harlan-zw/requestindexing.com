<script setup lang="ts">
import { computed } from 'vue'
import { ClientOnly, UiButton, UiIcon, UiMetricLabel, USelectMenu } from '#components'
// Inline, page-area facet bar for GSC tables. Presentational only: country and
// device are bound via v-model, country options are supplied by the caller.
// `ProGscTableShell` wires this to `useProGscFilters` (URL-synced Pro state);
// the showcase in apps/brand-kit drives it with local refs. Keeping it free of
// Pro composables is what lets both consume it.

interface CountryItem {
  label: string
  value: string
  /** Leading icon (e.g. a `i-circle-flags:<alpha2>` flag). Rendered in the list and, when selected, in the trigger. */
  icon?: string
}
interface DeviceShare { DESKTOP: number, MOBILE: number, TABLET: number }

const { dimension, countryItems = [], deviceDistribution = null } = defineProps<{
  /** The faceted table's own dimension — its matching facet is hidden to avoid a degenerate filter. */
  dimension?: string
  /** Country options. Values must be non-empty (Reka Combobox reserves '' for the cleared state). */
  countryItems?: CountryItem[]
  /** Clicks per device for the current view — drives the distribution bars. Null hides them. */
  deviceDistribution?: DeviceShare | null
}>()

const country = defineModel<string>('country', { default: '' })
const device = defineModel<string>('device', { default: '' })

const DEVICE_OPTIONS = [
  { value: 'DESKTOP', label: 'Desktop', icon: 'monitor' },
  { value: 'MOBILE', label: 'Mobile', icon: 'smartphone' },
  { value: 'TABLET', label: 'Tablet', icon: 'i-lucide-tablet' },
]

const showCountry = computed(() => dimension !== 'country')
const showDevice = computed(() => dimension !== 'device')
// Show the selected country's flag in the trigger; fall back to the globe.
const selectedCountryIcon = computed(() => countryItems.find(i => i.value === country.value)?.icon ?? 'globe')

const deviceTotal = computed(() => {
  const d = deviceDistribution
  return d ? d.DESKTOP + d.MOBILE + d.TABLET : 0
})
function devicePct(value: string): number {
  if (!deviceDistribution || deviceTotal.value <= 0)
    return 0
  const c = deviceDistribution[value as keyof DeviceShare] ?? 0
  return Math.round((c / deviceTotal.value) * 100)
}
</script>

<template>
  <div class="space-y-2.5">
    <!-- Country: its own row -->
    <div v-if="showCountry" class="flex items-center gap-0.5">
      <!-- ClientOnly: USelectMenu's SSR root shape differs from its client root,
           tripping a hydration mismatch. The facet control carries no SEO value. -->
      <ClientOnly>
        <USelectMenu
          v-model="country"
          :items="countryItems"
          value-key="value"
          size="xs"
          color="neutral"
          variant="subtle"
          :icon="selectedCountryIcon"
          placeholder="All countries"
          :search-input="{ placeholder: 'Search countries...' }"
          aria-label="Filter by country"
          class="w-full"
        />
        <template #fallback>
          <div class="w-full h-6 rounded-md border border-default bg-elevated/50" />
        </template>
      </ClientOnly>
      <UiButton
        v-if="country"
        size="xs"
        purpose="quiet"
        icon="close"
        aria-label="Clear country filter"
        @click="country = ''"
      />
    </div>

    <!-- Device: its own row, as a distribution list. Each row's background
         fills to that device's share of clicks (the relative split), and
         clicking toggles the device facet. -->
    <div v-if="showDevice">
      <div class="flex items-center justify-between px-0.5 pb-1">
        <UiMetricLabel aria-hidden="true">
          Device
        </UiMetricLabel>
        <button
          v-if="device"
          type="button"
          class="cursor-pointer text-mini text-primary hover:underline outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
          @click="device = ''"
        >
          All
        </button>
      </div>
      <div class="space-y-1" role="group" aria-label="Filter by device">
        <button
          v-for="d in DEVICE_OPTIONS"
          :key="d.value"
          type="button"
          :aria-pressed="device === d.value"
          :title="`Filter by ${d.label.toLowerCase()}`"
          class="relative w-full overflow-hidden flex items-center gap-2 px-2 py-1.5 rounded-md border text-mini font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
          :class="device === d.value
            ? 'border-accented text-default'
            : 'border-transparent text-muted hover:text-default'"
          @click="device = device === d.value ? '' : d.value"
        >
          <!-- Relative-share fill (the 'background % thing'). -->
          <div
            v-if="devicePct(d.value) > 0"
            class="absolute inset-y-0 left-0 rounded-md transition-[width] duration-300"
            :class="device === d.value ? 'bg-primary/15' : 'bg-elevated'"
            :style="{ width: `${devicePct(d.value)}%` }"
            aria-hidden="true"
          />
          <UiIcon :name="d.icon" class="relative size-3.5 shrink-0" aria-hidden="true" />
          <span class="relative flex-1 text-left">{{ d.label }}</span>
          <span v-if="deviceDistribution" class="relative text-dimmed tabular-nums">{{ devicePct(d.value) }}%</span>
        </button>
      </div>
    </div>
  </div>
</template>
