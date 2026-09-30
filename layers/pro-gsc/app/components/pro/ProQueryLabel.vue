<script setup lang="ts">
// Ported from nuxtseo.com `layers/pro/gsc/app/components/pro/ProQueryLabel.vue`.
import { computed, ref, watch } from 'vue'
import { vizTextColor } from '~~/layers/design-system/app/composables/dataVizColors'
import { formatNumber, formatReportingDay } from '~~/layers/design-system/app/composables/formatting'
import { NuxtLink, UiIcon, UiPopover, UiSkeleton, UiSparkline, UiTooltip } from '#components'
import { POSITION_DISPLAY_THRESHOLD, POSITION_FALL_MIN_IMPRESSIONS, POSITION_FALL_PLACES, positionFall } from '../../../shared/query-display'

interface QueryVariant {
  query: string
  clicks: number
  impressions: number
  position: number
}

const {
  keyword,
  queryCanonical,
  variantCount,
  variants,
  variantsLoading = false,
  position,
  previousPosition,
  impressions,
  positionSeries,
  positionSeriesDates,
  positionSeriesLoading = false,
  brand = false,
  to,
  size = 'sm',
} = defineProps<{
  /** Display name (top variant) */
  keyword: string
  /** Canonical form for linking */
  queryCanonical?: string | null
  /** Number of grouped variants */
  variantCount?: number | null
  /** Variant breakdown rows. The consumer may load them lazily when the popover opens. */
  variants?: QueryVariant[] | null
  /** True while the consumer is fetching the breakdown for this row. */
  variantsLoading?: boolean
  /** Average position, shown as a badge at or better than POSITION_DISPLAY_THRESHOLD. */
  position?: number | null
  /** Average position in the comparison period. With `impressions`, drives the falling badge. */
  previousPosition?: number | null
  /** Impressions this period. The falling badge's noise floor reads this. */
  impressions?: number | null
  /**
   * Daily position series for the badge tooltips, resolved lazily by the
   * consumer on `positionOpen`. Leaving it unset omits the chart.
   */
  positionSeries?: number[] | null
  /** Day axis (`YYYY-MM-DD`) aligned 1:1 with `positionSeries`. */
  positionSeriesDates?: string[] | null
  /** True while the consumer is fetching this row's series. */
  positionSeriesLoading?: boolean
  /** Whether this is a brand keyword */
  brand?: boolean
  /** Optional NuxtLink destination */
  to?: string
  /** Text size: 'xs' | 'sm' */
  size?: 'xs' | 'sm'
}>()

// `variantOpen`: the variant popover opened, so the consumer can load the
// breakdown for this canonical. `positionOpen`: a rank badge was hovered or
// focused, so the consumer can load this term's position series. A row that is
// never pointed at never costs a read.
const emit = defineEmits<{
  variantOpen: [canonical: string]
  positionOpen: [entity: string]
}>()

const showVariants = computed(() => (variantCount ?? 0) > 1)
// Any metric present, not only a position, counts as a renderable table.
const hasVariantData = computed(() => !!variants?.length && variants.some(v => v.position > 0 || v.clicks > 0 || v.impressions > 0))

const variantsOpen = ref(false)
watch(variantsOpen, (open) => {
  if (open)
    emit('variantOpen', queryCanonical || keyword)
})

// One rank-quality scale for the badge and the variants table, so the two can
// never disagree: under 10 strong, under 30 moderate, else weak.
type PositionBand = 'strong' | 'moderate' | 'weak'
function positionBand(value: number): PositionBand {
  if (value < 10)
    return 'strong'
  if (value < 30)
    return 'moderate'
  return 'weak'
}

const positionStyle = computed(() => {
  if (position == null || position > POSITION_DISPLAY_THRESHOLD)
    return ''
  return `position-badge position-badge--${positionBand(position)}`
})

// The rank badge is gated to the top positions, so a query sliding out of them
// loses its badge at the moment it matters. The falling badge covers that gap:
// it is not gated by rank, and it reads only fields a compared row already has.
const fall = computed(() => positionFall({ position, previousPosition, impressions }))

// One decimal below ten places, whole places above, where the fraction is noise.
const fallLabel = computed(() => {
  const places = fall.value?.places ?? 0
  return places < 10 ? places.toFixed(1) : String(Math.round(places))
})

// Chart box inside the tooltip. Fixed px because the tooltip body is `w-max`.
const SPARK_W = 226
const SPARK_H = 44

// Hovering a badge is the request. The emit is latched so re-entering the badge
// does not ask again.
const positionRequested = ref(false)
function requestPositionSeries(): void {
  if (positionRequested.value)
    return
  positionRequested.value = true
  emit('positionOpen', queryCanonical || keyword)
}

const hasPositionSeries = computed(() => (positionSeries?.length ?? 0) > 1)

// The sparkline's y-axis runs the way the numbers do, so a bigger position is
// higher. The tooltip states both ranks and the window so the reader does not
// have to infer the direction of the line.
const positionSeriesSummary = computed(() => {
  const series = positionSeries
  if (!series?.length)
    return null
  const dates = positionSeriesDates ?? []
  return {
    from: series[0]!.toFixed(1),
    to: series.at(-1)!.toFixed(1),
    range: dates.length
      ? `${formatReportingDay(dates[0])} to ${formatReportingDay(dates.at(-1))}`
      : '',
  }
})

// Only ranks that need action take a hue in the variants table. Literal class
// strings, because Tailwind only emits what it can read in the source.
const VARIANT_POSITION_CLASS: Record<PositionBand, string> = {
  strong: 'text-default',
  moderate: 'text-warning',
  weak: 'text-error',
}
function variantPositionClass(value: number): string {
  return VARIANT_POSITION_CLASS[positionBand(value)]
}
</script>

<template>
  <span class="flex items-center gap-1.5 min-w-0 w-full">
    <component
      :is="to ? NuxtLink : 'span'"
      :to="to"
      :title="keyword"
      class="truncate text-default"
      :class="[
        size === 'xs' ? 'text-xs' : 'text-sm font-medium',
        to && 'hover:text-primary transition-colors',
      ]"
    >
      {{ keyword }}
    </component>
    <!-- Variant count opens a popover with the grouped breakdown -->
    <UiPopover v-if="showVariants" v-model:open="variantsOpen" :content="{ side: 'bottom', align: 'start' }">
      <button
        type="button"
        class="variant-badge variant-badge--interactive cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :aria-label="`Show ${variantCount} grouped variants`"
        :title="`${variantCount} grouped variants`"
      >
        {{ variantCount }}v
      </button>
      <template #panel>
        <div class="p-3 space-y-2 w-[300px]">
          <div class="text-label text-muted">
            {{ variantCount }} grouped variants
          </div>
          <div class="max-h-[240px] overflow-y-auto">
            <div v-if="variantsLoading && !variants?.length" class="py-1">
              <UiSkeleton :lines="Math.min(variantCount ?? 3, 6)" :base="180" :range="80" />
            </div>
            <div v-else-if="hasVariantData" class="w-full text-mini tabular-nums">
              <div class="flex text-label sticky top-0 bg-elevated pb-1">
                <span class="flex-1 font-medium pr-3">Query</span>
                <span class="w-12 text-right font-medium px-2">Pos</span>
                <span class="w-14 text-right font-medium px-2">Clicks</span>
                <span class="w-14 text-right font-medium pl-2">Impr</span>
              </div>
              <div v-for="v in variants" :key="v.query" class="flex items-center border-t border-default/30 py-0.5">
                <span class="flex-1 pr-3 max-w-[180px] truncate">{{ v.query }}</span>
                <span class="w-12 px-2 text-right">
                  <span
                    v-if="v.position > 0"
                    class="font-medium"
                    :class="variantPositionClass(v.position)"
                  >
                    {{ v.position.toFixed(1) }}
                  </span>
                  <span v-else class="text-dimmed" aria-label="No position">—</span>
                </span>
                <span class="w-14 px-2 text-right">{{ formatNumber(v.clicks) }}</span>
                <span class="w-14 pl-2 text-right text-muted">{{ formatNumber(v.impressions) }}</span>
              </div>
            </div>
            <ul v-else-if="variants?.length" class="text-mini space-y-0.5">
              <li v-for="v in variants" :key="v.query" class="truncate text-muted py-0.5 border-t border-default/30 first:border-t-0">
                {{ v.query }}
              </li>
            </ul>
            <p v-else class="text-mini text-muted leading-relaxed">
              This term groups {{ variantCount }} query variants, such as plural and singular spellings.
              <NuxtLink v-if="to" :to="to" class="text-primary hover:underline whitespace-nowrap">View breakdown</NuxtLink>
            </p>
            <div v-if="variants?.length && variantCount && variantCount > variants.length" class="text-mini text-dimmed pt-1">
              +{{ variantCount - variants.length }} more
            </div>
          </div>
        </div>
      </template>
    </UiPopover>
    <!-- Position rank. The badge is a rounded average, so the tooltip carries
         the exact figure and why most rows show no badge. Both badge tooltips
         open below: the chart arrives after the tooltip opens, and a tooltip
         above the badge grew down over the pointer and closed itself. -->
    <UiTooltip
      v-if="position != null && position <= POSITION_DISPLAY_THRESHOLD"
      trigger-as="child"
      side="bottom"
    >
      <span
        :class="positionStyle"
        class="cursor-help"
        @pointerenter="requestPositionSeries"
        @focusin="requestPositionSeries"
      >
        #{{ Math.round(position) }}
      </span>
      <template #text>
        <div class="font-semibold">
          Average position {{ position.toFixed(1) }}
        </div>
        <div class="text-muted text-xs">
          Where this query ranked in Google across the selected period, averaged over every impression.
          Only shown when the average is {{ POSITION_DISPLAY_THRESHOLD }} or better.
        </div>
        <div v-if="positionSeriesLoading && !hasPositionSeries" class="animate-pulse rounded bg-accented/60" :style="{ width: `${SPARK_W}px`, height: `${SPARK_H}px` }" aria-hidden="true" />
        <div v-else-if="hasPositionSeries && positionSeriesSummary" class="space-y-1">
          <UiSparkline
            :data="positionSeries!"
            :width="SPARK_W"
            :height="SPARK_H"
            :inverted="true"
            :stroke-width="1.75"
            preserve-aspect-ratio="none"
          />
          <div class="flex items-baseline justify-between gap-3 text-mini text-dimmed tabular-nums">
            <span>Daily, {{ positionSeriesSummary.range }}</span>
            <span>#{{ positionSeriesSummary.from }} → #{{ positionSeriesSummary.to }}</span>
          </div>
        </div>
      </template>
    </UiTooltip>
    <!-- Falling rank. A different claim from the badge above, so it takes a
         different glyph and hue. Not gated by rank on purpose. -->
    <UiTooltip
      v-if="fall"
      trigger-as="child"
      side="bottom"
    >
      <span
        class="position-badge position-badge--falling cursor-help"
        :aria-label="`Fell ${fallLabel} places, now position ${fall.to.toFixed(1)}`"
        @pointerenter="requestPositionSeries"
        @focusin="requestPositionSeries"
      >
        <UiIcon name="down" class="size-2.5 shrink-0" aria-hidden="true" />
        {{ fallLabel }}
      </span>
      <template #text>
        <div class="font-semibold">
          Fell {{ fallLabel }} places
        </div>
        <div class="text-muted text-xs">
          Average position went from #{{ fall.from.toFixed(1) }} to #{{ fall.to.toFixed(1) }} on
          {{ formatNumber(impressions ?? 0) }} impressions. Flagged at {{ POSITION_FALL_PLACES }}+ places over
          {{ POSITION_FALL_MIN_IMPRESSIONS }}+ impressions.
        </div>
        <div v-if="positionSeriesLoading && !hasPositionSeries" class="animate-pulse rounded bg-accented/60" :style="{ width: `${SPARK_W}px`, height: `${SPARK_H}px` }" aria-hidden="true" />
        <div v-else-if="hasPositionSeries && positionSeriesSummary" class="space-y-1">
          <UiSparkline
            :data="positionSeries!"
            :width="SPARK_W"
            :height="SPARK_H"
            :inverted="true"
            :stroke-width="1.75"
            preserve-aspect-ratio="none"
          />
          <div class="flex items-baseline justify-between gap-3 text-mini text-dimmed tabular-nums">
            <span>Daily, {{ positionSeriesSummary.range }}</span>
            <span>#{{ positionSeriesSummary.from }} → #{{ positionSeriesSummary.to }}</span>
          </div>
        </div>
      </template>
    </UiTooltip>
    <!-- Brand tick. The tooltip says where the brand terms come from. -->
    <UiTooltip
      v-if="brand"
      trigger-as="child"
      title="Brand term"
      description="This query matches a brand term taken from this Site's domain, such as the name itself or the name with a modifier. People who search your brand already know you, so read these queries apart from the demand you had to win."
    >
      <UiIcon name="success" aria-label="Brand term" class="size-3.5 shrink-0 cursor-help" :class="vizTextColor.brand" />
    </UiTooltip>
    <slot />
  </span>
</template>

<style scoped>
.variant-badge {
  font-size: 10px;
  line-height: 1;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  padding: 1px 4px;
  border-radius: 3px;
  flex-shrink: 0;
  color: var(--ui-text-dimmed);
  opacity: 0.55;
  border: 1px dashed var(--ui-border);
}

.variant-badge--interactive {
  opacity: 0.7;
  cursor: default;
  border-style: dotted;
  border-color: var(--ui-border-accented);
}

.variant-badge--interactive:hover {
  opacity: 1;
  color: var(--ui-text-muted);
}

/* Semantic tokens only. One tint recipe for all three bands so a change to the
   scale cannot drift the geometry. */
.position-badge {
  --badge-color: var(--ui-success);
  font-size: 10px;
  line-height: 1;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  padding: 2px 5px;
  border-radius: 4px;
  flex-shrink: 0;
  color: var(--badge-color);
  background: color-mix(in srgb, var(--badge-color) 10%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--badge-color) 25%, transparent);
}

/* Unreachable while the display gate is 7 or better, but the badge should not
   invert if that gate moves. */
.position-badge--moderate {
  --badge-color: var(--ui-warning);
}

.position-badge--weak {
  --badge-color: var(--ui-error);
}

/* Falling: the same box as the rank badge, a different hue and glyph. Warning
   rather than error, because a slide is something to look at, not something
   already broken. */
.position-badge--falling {
  --badge-color: var(--ui-warning);
  display: inline-flex;
  align-items: center;
  gap: 1px;
  padding-left: 3px;
}
</style>
