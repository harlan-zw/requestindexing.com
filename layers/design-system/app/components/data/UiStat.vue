<script setup lang="ts">
import type { UiIcon as UiIconName } from '../../shared/ui-icons'
import type { SlotTextOptions } from '../../utils/slot-text'
import { useElementHover } from '@vueuse/core'
import { computed, onMounted, ref, useSlots } from 'vue'
import { ClientOnly, NuxtLink, UiIcon, UiSkeleton, UiSlotText, UiSparkline, UiTooltip } from '#components'
import { semanticColors } from '../../composables/semanticColors'

const {
  to,
  icon,
  title,
  tooltip,
  tooltipDescription,
  value,
  suffix,
  valueClass,
  format,
  trend,
  trendSuffix,
  trendLabel,
  invertTrend,
  trendColored,
  sparkline,
  size = 'md',
  loading,
  status,
  card,
  animatedValue = true,
  readableLabels = false,
} = defineProps<UiStatProps>()

// Stat card primitive. Ported from nuxtseo/core with two swaps:
//  - UiNavIcon → UiIcon (design-system registry)
//  - UiHelpLabel (→ UiPopover + useMarkdown) → UiTooltip (the design-system
//    tooltip primitive — keeps tooltip usage consistent across components)
// Behavior + slots kept identical so consumers port cleanly.

// NuxtLink auto-registers globally; resolve by name so we don't depend on
// the `#components` virtual (which doesn't narrow nicely in a layer).

type Datum = Record<string, number | string>

export interface UiStatProps {
  // link
  to?: string

  // label
  icon?: UiIconName
  title?: string
  tooltip?: string
  tooltipDescription?: string

  // value
  value?: string | number | null
  suffix?: string
  valueClass?: string
  format?: (n: number) => string

  // trend
  trend?: number | null
  trendSuffix?: string
  trendLabel?: string
  invertTrend?: boolean
  /**
   * Trend color budget (DESIGN.md Composition): colored success/error trends
   * belong to the hero zone only. Default renders neutral; `UiStats
   * variant="cards"` (the hero pattern) opts its stats in automatically.
   */
  trendColored?: boolean

  // sparkline
  sparkline?: Datum[]

  // sizing
  size?: 'sm' | 'md' | 'lg'
  /** Keep report-visible labels and deltas at the 14px readable tier. */
  readableLabels?: boolean

  // state
  loading?: boolean

  /**
   * Rolls compact metric values when they change. Defaults on for numeric-ish
   * values; pass false for dense/realtime surfaces or object options to tune.
   */
  animatedValue?: boolean | SlotTextOptions

  // threshold alerting
  status?: 'crisis' | 'warning' | 'good'

  // render the value area inside a card, keeping the header outside
  card?: boolean
}

const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})
const isLoading = computed(() => hydrated.value && loading)
const slots = useSlots()

// Hover state for the background viz: the card owns the gesture, the chart
// (default sparkline or #chart slot) reacts to it. Subtle, opt-in via the
// chart component itself.
const cardEl = ref<HTMLElement | null>(null)
const cardHovered = useElementHover(cardEl)

const rootTag = computed(() => to ? NuxtLink : 'div')

const sizeConfig = computed(() => {
  const map = {
    // `chartH` is the band the chart may draw in; `bgH` minus it is headroom
    // under the value so no peak crosses the numerals.
    sm: { value: 'text-xl', sparkW: 96, sparkH: 32, ribbonH: 30, bgH: 46, chartH: 26 },
    md: { value: 'text-2xl', sparkW: 120, sparkH: 32, ribbonH: 38, bgH: 56, chartH: 30 },
    lg: { value: 'text-3xl', sparkW: 160, sparkH: 36, ribbonH: 46, bgH: 64, chartH: 34 },
  }
  return map[size]
})

const displayValue = computed(() => {
  if (value == null)
    return null
  if (format && typeof value === 'number')
    return format(value)
  return String(value)
})

const animatedValueOptions = computed<SlotTextOptions | null>(() => {
  if (!displayValue.value || animatedValue === false || slots.default)
    return null

  const compactMetricValue = /^[+\-$€£¥]?\s*[\d,.]+(?:\s?[kmbt])?(?:\.\d+)?%?$/i.test(displayValue.value)
  if (typeof animatedValue === 'object')
    return animatedValue

  return compactMetricValue && displayValue.value.length <= 14
    ? { direction: 'up', duration: 320, stagger: 24 }
    : null
})

const trendDirection = computed(() => {
  if (trend == null || trend === 0)
    return 'neutral'
  return trend > 0 ? 'up' : 'down'
})

const isTrendPositive = computed(() => {
  if (trendDirection.value === 'neutral')
    return null
  return invertTrend
    ? trendDirection.value === 'down'
    : trendDirection.value === 'up'
})

const trendColorClass = computed(() => {
  if (!trendColored || isTrendPositive.value === null)
    return 'text-muted'
  return isTrendPositive.value ? 'text-success' : 'text-error'
})
const titleTypeClass = computed(() => readableLabels ? 'text-sm font-strong' : 'text-label')
const trendTypeClass = computed(() => readableLabels ? 'text-sm' : 'text-xs')
const statusTypeClass = computed(() => readableLabels ? 'text-sm' : 'text-mini')

// Sparkline stays neutral by default — trend valence is already encoded in
// the colored text delta. Avoid double-encoding (Tufte: one channel per signal).
// Plain const (not computed): it never varies, so a reactive node per instance
// across a KPI grid is pure overhead.
const sparklineColor = semanticColors.neutral.hex

const statusChip = computed(() => {
  if (!status)
    return null
  const map: Record<string, { label: string, dot: string, bg: string, text: string }> = {
    crisis: { label: 'Critical', dot: 'bg-error', bg: 'bg-error/10', text: 'text-error' },
    warning: { label: 'Needs work', dot: 'bg-warning', bg: 'bg-warning/10', text: 'text-warning' },
    good: { label: 'Healthy', dot: 'bg-success', bg: 'bg-success/10', text: 'text-success' },
  }
  return map[status] ?? null
})

const formattedTrend = computed(() => {
  if (trend == null)
    return ''
  const abs = Math.abs(trend)
  const sign = trend > 0 ? '+' : trend < 0 ? '-' : ''
  const formatted = format ? format(abs) : abs % 1 === 0 ? String(abs) : abs.toFixed(1)
  return `${sign}${formatted}${trendSuffix || ''}`
})
</script>

<template>
  <UiTooltip
    :text="tooltipDescription || tooltip"
    :disabled="!to || !tooltip"
    trigger-as="child"
  >
    <component
      :is="rootTag"
      :to="to || undefined"
      data-ui="UiStat"
      class="relative flex flex-col"
      :class="[
        card ? 'gap-2' : 'gap-1',
        to ? 'cursor-pointer' : '',
      ]"
    >
      <!-- Header: icon + label + trend + status chip.
         `leading-none` collapses .text-label's 1.5 line-box to the cap band so
         items-center aligns the leading icon to the text, not to empty leading. -->
      <!-- `min-h-5` pins the header to the tooltip button's height, so a
           title rendered as a plain span (link mode, or no tooltip) does not
           make its card sit 8px higher than its siblings. -->
      <div
        class="flex min-h-5 items-center gap-1.5 leading-none"
        :class="to && !card ? 'transition-opacity hover:opacity-80' : ''"
      >
        <slot name="icon">
          <UiIcon v-if="icon" :name="icon" class="size-3 text-dimmed shrink-0" />
        </slot>
        <slot name="title">
          <!-- `mx-0.5` cancels the trigger button's `-m-0.5` bleed, so this
               title starts on the same edge as the link-mode title and the value. -->
          <UiTooltip v-if="tooltip && title && !to" :text="tooltipDescription || tooltip" trigger-as="button">
            <span class="mx-0.5 inline-flex items-center gap-1" :class="titleTypeClass">
              {{ title }}
              <UiIcon name="help" class="size-3 opacity-50 shrink-0" aria-hidden="true" />
            </span>
          </UiTooltip>
          <!-- Link mode: the tooltip wraps the whole card (above), so the
               title keeps the same help glyph and the same height as its
               siblings; a card that loses the icon sits higher in the row. -->
          <span v-else-if="title" class="inline-flex items-center gap-1" :class="titleTypeClass">
            {{ title }}
            <UiIcon v-if="tooltip && to" name="help" class="size-3 opacity-50 shrink-0" aria-hidden="true" />
          </span>
        </slot>
        <slot v-if="!card" name="trend">
          <span v-if="trend != null && trend !== 0" class="numerals-display" :class="[trendTypeClass, trendColorClass]">
            {{ formattedTrend }}
          </span>
          <span v-else-if="trend === null || trend === 0" class="numerals-display text-dimmed" :class="trendTypeClass" aria-label="No comparison data">—</span>
          <span v-if="trendLabel" class="text-dimmed" :class="trendTypeClass">{{ trendLabel }}</span>
        </slot>
        <span
          v-if="statusChip"
          class="inline-flex items-center gap-1 px-1.5 py-px rounded-md font-medium leading-tight"
          :class="[statusTypeClass, statusChip.bg, statusChip.text]"
        >
          <span class="size-1 rounded-full" :class="statusChip.dot" />
          {{ statusChip.label }}
        </span>
      </div>

      <div
        ref="cardEl"
        class="group/card relative flex flex-col gap-1 overflow-hidden"
        :class="[
          card ? 'ui-stat-card rounded-xl border border-default bg-[var(--ui-bg-elevated)]/5 p-4 min-h-[5.5rem]' : '',
          to && card ? 'ui-stat-card--linked' : '',
          to && !card ? 'transition-opacity hover:opacity-80' : '',
        ]"
      >
        <!-- Hover affordance: chevron signals the card is clickable -->
        <UiIcon
          v-if="to && card"
          name="chevron-right"
          class="pointer-events-none absolute top-2.5 right-2.5 size-3.5 text-dimmed opacity-0 -translate-x-1 transition-[opacity,transform] duration-150 group-hover/card:opacity-100 group-hover/card:translate-x-0"
          aria-hidden="true"
        />

        <!-- Loading skeleton -->
        <template v-if="isLoading">
          <UiSkeleton :base="80" :index="0" />
        </template>

        <!-- Content -->
        <template v-else>
          <!-- Card mode: viz fills the lower portion of the card as a background
             layer (sparkline by default, or a #chart slot e.g. UiCwvSparkline).
             A left→right bg→transparent fade keeps the value/trend legible where
             they overlap the chart, so the card keeps its compact height. -->
          <div
            v-if="card && (sparkline?.length || $slots.chart)"
            class="pointer-events-none absolute inset-x-0 bottom-0 z-0"
            :style="{ height: `${sizeConfig.bgH}px` }"
          >
            <!-- The chart draws in the LOWER band of the layer only. A series
               pinned at its maximum (a fresh site whose whole backlog opened
               this week) used to run its line straight through the value's
               numerals; text-shadow cannot rescue a stroke crossing the glyphs.
               Headroom above the band keeps every peak under the value's
               baseline while the area fill still bleeds to the card edge. -->
            <div class="absolute inset-x-0 bottom-0" :style="{ height: `${sizeConfig.chartH}px` }">
              <!-- Client-only: the chart (sparkline or a motion-driven #chart slot)
                 is decorative and motion components hydrate awkwardly, so skip SSR. -->
              <ClientOnly>
                <slot name="chart" :hovered="cardHovered">
                  <UiSparkline
                    :data="sparkline ?? []"
                    :color="sparklineColor"
                    :inverted="invertTrend"
                    area
                    interactive
                    :hovered="cardHovered"
                    :max-points="48"
                    width="100%"
                    height="100%"
                    preserve-aspect-ratio="none"
                    class="block size-full opacity-90"
                  />
                </slot>
              </ClientOnly>
            </div>
            <!-- Legibility wash: a light left→right dark gradient just takes the
               edge off the chart under the value. The heavy lifting is the
               value's text-shadow, so the chart itself stays bright. -->
            <div class="absolute inset-0 bg-gradient-to-r from-[var(--ui-bg)]/70 via-[var(--ui-bg)]/10 via-[50%] to-transparent" />
          </div>

          <!-- Value + trend row. In card mode it floats above the background viz
             (text-shadow keeps it legible); outside card mode the sparkline
             stays inline on the right. -->
          <div class="relative z-10 flex items-end justify-between gap-3" :class="card && (sparkline?.length || $slots.chart) ? 'ui-stat-legible' : ''">
            <slot>
              <div v-if="value != null" class="flex items-baseline gap-2 min-w-0">
                <span class="numerals-display tracking-tight" :class="[sizeConfig.value, valueClass || 'text-default']">
                  <UiSlotText
                    v-if="animatedValueOptions && displayValue"
                    :text="displayValue"
                    :options="animatedValueOptions"
                  />
                  <template v-else>
                    {{ displayValue }}
                  </template>
                </span>
                <span v-if="suffix" class="text-sm text-muted">{{ suffix }}</span>
                <slot v-if="card" name="trend">
                  <span
                    v-if="trend != null && trend !== 0"
                    class="numerals-display"
                    :class="[trendTypeClass, trendColorClass]"
                  >
                    {{ formattedTrend }}
                  </span>
                  <span
                    v-else-if="trend === null || trend === 0"
                    class="numerals-display text-dimmed"
                    :class="trendTypeClass"
                    aria-label="No comparison data"
                  >—</span>
                  <span v-if="trendLabel" class="text-dimmed" :class="trendTypeClass">{{ trendLabel }}</span>
                </slot>
              </div>
              <span v-else class="font-semibold text-muted" :class="sizeConfig.value" role="img" aria-label="No data">&mdash;</span>
            </slot>
            <!-- Compact-strip viz: the same chart the card mode floats as a
               background renders here as a small fixed-size cell on the right
               (a #chart slot, e.g. the CWV composition), so status tiles keep
               their signal in compact mode. Falls back to the inline sparkline
               for metric tiles that supply a `sparkline` array. -->
            <div
              v-if="!card && ($slots.chart || sparkline?.length)"
              class="ui-stat-inline-chart -mb-0.5 min-w-0 flex-1 overflow-hidden"
              :style="{ maxWidth: `${sizeConfig.sparkW}px` }"
            >
              <ClientOnly>
                <div
                  v-if="$slots.chart"
                  class="w-full"
                  :style="{ height: `${sizeConfig.sparkH}px` }"
                >
                  <slot name="chart" :hovered="cardHovered" />
                </div>
                <UiSparkline
                  v-else
                  :data="sparkline ?? []"
                  :size="size"
                  :color="sparklineColor"
                  :inverted="invertTrend"
                  :area="false"
                  width="100%"
                  class="block max-w-full"
                />
              </ClientOnly>
            </div>
          </div>

          <!-- Info slot for extra content -->
          <slot name="info" />
        </template>
      </div>
    </component>
  </UiTooltip>
</template>

<style scoped>
/* Value/trend floats over the background chart. A soft halo in the card-bg
   colour (so it adapts to light/dark) buys contrast without a heavy mask,
   letting the chart stay bright. */
.ui-stat-legible {
  text-shadow:
    0 0 2px var(--ui-bg),
    0 1px 10px var(--ui-bg);
}

.ui-stat-card {
  /* Recessed resting depth — carved edge, no lift. */
  box-shadow: var(--elevation-inset);
  letter-spacing: var(--tracking-data);
  -webkit-font-smoothing: antialiased;
  transition:
    box-shadow 200ms ease-out,
    border-color 200ms ease-out,
    transform 220ms var(--ease-spring);
}

/* Linked cards lift to the raised tier on hover + the accent-tinted hover
   halo, with a small spring rise — signals "clickable". */
.ui-stat-card--linked:hover {
  border-color: var(--ui-border-accented);
  box-shadow: var(--elevation-raised), var(--elevation-hover);
  transform: translateY(-2px);
}

@media (prefers-reduced-motion: reduce) {
  .ui-stat-card {
    transition: border-color 150ms ease-out;
  }
  .ui-stat-card--linked:hover {
    transform: none;
  }
}
</style>
