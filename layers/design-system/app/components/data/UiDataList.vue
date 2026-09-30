<script setup lang="ts" generic="T extends object">
import type { UiIcon as UiIconName } from '../../shared/ui-icons'
import { computed, onMounted, ref } from 'vue'
import { NuxtLink, UiHelpLabel, UiIcon, UiNavIcon, UiSkeleton } from '#components'
import { getIconColor } from '../../utils/icon-color'

type UiDataListRouteTarget = string | Record<string, unknown>
interface UiDataListKeyFields {
  id?: string | number
  key?: string | number
  path?: string
  url?: string
}

const {
  title,
  icon,
  iconColor,
  tooltip,
  metricLabel,
  items,
  loading,
  loadingCount = 5,
  viewMoreTo,
  viewMoreLabel = 'View all',
  emptyIcon,
  emptyText = 'No data available',
  barValue,
  barTotal,
  barColor = 'bg-pro',
  itemTo,
  subtle = false,
} = defineProps<{
  title?: string
  icon?: UiIconName
  iconColor?: string
  /** Render the title as a quieter sub-tier (smaller + muted) for nested lists. */
  subtle?: boolean
  tooltip?: string
  metricLabel?: string
  items?: T[]
  loading?: boolean
  loadingCount?: number
  viewMoreTo?: UiDataListRouteTarget
  viewMoreLabel?: string
  emptyIcon?: UiIconName
  emptyText?: string
  /** Accessor fn to get bar value from item. When set, renders a % fill bar behind each row. */
  barValue?: (item: T) => number
  /**
   * Denominator for the bar fill. Omit it (the default) and the bars are
   * max-relative: the largest row fills 100% and every other row is drawn in
   * proportion to it, so the list reads as magnitude. Pass an explicit value to
   * mean something else — `100` for rows that already hold percentages, or the
   * sum of a wider set when the bar must read as share-of-total.
   */
  barTotal?: number
  /** Bar color class (default: 'bg-pro') */
  barColor?: string
  /** Accessor fn for row link target. When set, each row becomes a NuxtLink with a trailing chevron. */
  itemTo?: (item: T) => UiDataListRouteTarget | undefined | null
}>()

defineSlots<{
  'default'?: (props: { item: T, index: number }) => unknown
  /**
   * The list's identity mark, in place of `icon`. A list that reads through
   * one Source passes its `UiSourceLogos` here, so the header names where the
   * rows came from instead of decorating the title.
   */
  'mark'?: () => unknown
  'header-trailing'?: () => unknown
  'empty'?: () => unknown
  'footer'?: () => unknown
}>()

// Treat SSR as loading to avoid hydration mismatch when data arrives client-side
const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})
const isLoading = computed(() => loading || (!hydrated.value && !items?.length))

// Default denominator is the LARGEST row, not the sum: dividing by the sum
// squashes even a dominant row into a third of the track (4.8K of 14K = 34%)
// and renders the tail as slivers, so the bars carry no magnitude. Max-relative
// puts the top row at 100% and scales the rest against it. An explicit
// `barTotal` still wins — that's the share-of-total / already-a-percentage case.
const computedBarTotal = computed(() => {
  if (barTotal != null)
    return barTotal
  if (!barValue || !items?.length)
    return 0
  return items.reduce((max, item) => Math.max(max, barValue!(item)), 0)
})

function barPct(item: T): number {
  if (!barValue)
    return 0
  const total = computedBarTotal.value
  return total > 0 ? (barValue(item) / total) * 100 : 0
}

const hasSemanticColor = computed(() => !!iconColor)
const iconClasses = computed(() => hasSemanticColor.value ? getIconColor(iconColor!) : null)
const titleClass = computed(() => subtle ? 'text-xs font-medium text-muted' : 'text-sm font-medium')

function itemKey(item: T, index: number): string | number {
  const row = item as UiDataListKeyFields
  return row.id ?? row.key ?? row.path ?? row.url ?? index
}
</script>

<template>
  <div class="flex flex-col" :aria-busy="isLoading">
    <!-- Header -->
    <div v-if="title || icon || $slots.mark || $slots['header-trailing']" class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-1 pb-2.5">
      <div v-if="title || icon || $slots.mark" class="flex items-center gap-2">
        <slot name="mark">
          <div v-if="icon && hasSemanticColor" class="p-1 rounded-md" :class="iconClasses!.bg">
            <UiIcon :name="icon" class="size-3.5" :class="iconClasses!.text" />
          </div>
          <UiNavIcon v-else-if="icon" :icon="icon" />
        </slot>
        <!-- UiHelpLabel renders its text through UiTooltip, whose root is a
             reka TooltipProvider with no DOM node — a fallthrough `class` would
             be dropped. Wrap it in a real span so the title size/tone lands. -->
        <span v-if="title && tooltip" :class="titleClass">
          <UiHelpLabel :text="title" :tooltip="tooltip" />
        </span>
        <span v-else-if="title" :class="titleClass">{{ title }}</span>
      </div>
      <div class="flex items-center justify-between gap-3">
        <slot name="header-trailing">
          <span v-if="metricLabel" class="text-sm text-muted">{{ metricLabel }}</span>
        </slot>
        <NuxtLink
          v-if="viewMoreTo"
          :to="viewMoreTo"
          class="inline-flex min-h-11 items-center gap-1 text-xs text-muted hover:text-default transition-colors group/link"
        >
          {{ viewMoreLabel }}
          <UiIcon name="next" class="size-3 transition-transform group-hover/link:translate-x-0.5" aria-hidden="true" />
        </NuxtLink>
      </div>
    </div>

    <div class="rounded-lg border border-default bg-elevated/50 flex flex-col flex-1 overflow-hidden">
      <!-- Loading -->
      <div v-if="isLoading" class="px-3 py-3 space-y-1">
        <UiSkeleton :lines="loadingCount" :base="180" :range="80" />
      </div>

      <!-- Empty -->
      <div v-else-if="!items?.length" class="px-4 py-6 text-center flex-1 flex flex-col items-center justify-center">
        <UiIcon v-if="emptyIcon" :name="emptyIcon" class="size-6 text-muted/40 mb-2" aria-hidden="true" />
        <p class="text-sm text-dimmed">
          <slot name="empty">
            {{ emptyText }}
          </slot>
        </p>
      </div>

      <!-- Items — condensed by default. `min-h-11` keeps the 44px touch target
           on coarse pointers; from `sm` up a row floors at 32px, so a 5-row
           list costs ~60px less height for the same signal. Rows with two-line
           or badge content still grow past the floor on their own. -->
      <div v-else class="flex-1 p-1 space-y-0.5">
        <component
          :is="itemTo && itemTo(item) ? NuxtLink : 'div'"
          v-for="(item, index) in items"
          :key="itemKey(item, index)"
          :to="itemTo ? itemTo(item) || undefined : undefined"
          class="relative flex min-h-11 sm:min-h-8 items-center gap-2 py-1 px-2.5 rounded-lg group hover:bg-accented transition-colors"
        >
          <div
            v-if="barValue"
            class="absolute inset-y-0 left-0 rounded-lg opacity-[0.05] dark:opacity-[0.07] pointer-events-none"
            :class="barColor"
            :style="{ width: `${barPct(item)}%` }"
          />
          <div class="relative flex-1 min-w-0 flex items-center justify-between gap-2">
            <slot :item="item" :index="index" />
          </div>
          <UiIcon
            v-if="itemTo && itemTo(item)"
            name="chevron-right"
            class="size-3.5 text-dimmed shrink-0"
            aria-hidden="true"
          />
        </component>
      </div>

      <!-- Footer -->
      <div v-if="$slots.footer && items?.length" class="px-4 pb-3 pt-2">
        <slot name="footer" />
      </div>
    </div>
  </div>
</template>
