<script setup lang="ts">
import type { VNodeChild } from 'vue'
import type { FactItem } from './UiFactsGrid.vue'
import { useElementHover } from '@vueuse/core'
import { useTemplateRef } from 'vue'
import { ClientOnly, UiCard, UiFactsGrid, UiSparkline, UiStat } from '#components'
/**
 * UiEntitySummary — the identity header for a machine-object DETAIL page
 * (a competitor, a Lighthouse scan, an alert delivery). One hero metric +
 * sparkline on the left, a quiet facts grid on the right, in a single card.
 *
 * NOT a data-page hero moment — the "UiMetricsRow OR UiStats cards, never both"
 * gate is untouched. This is an *entity header*; it lives on detail pages that
 * aren't in the page-hero blueprint at all.
 *
 * Squint test: the hero column dominates by SIZE + WEIGHT (lg value); facts
 * recede (text-label / text-sm). The column divider is a NEUTRAL rule
 * (--ui-border) — never a semantic / accent stripe (Avoid: left-border cliché).
 *
 * It's a thin composition of UiStat (hero) + UiSparkline + UiFactsGrid — keep it
 * that way. Domain-shaped props stay at the call site; this only knows
 * {heading, metric, facts}.
 */

const {
  heading,
  title,
  tooltip,
  tooltipDescription,
  value,
  suffix,
  caption,
  trend,
  trendSuffix,
  invertTrend,
  sparkline,
  sparklineColor,
  facts = [],
  factColumns = 3,
  status,
  emphasis = true,
  divider = 'bleed',
  stackHeaderOnMobile = false,
} = defineProps<{
  /** Entity identity line (e.g. a hostname). Overridable via #heading. */
  heading?: string
  /** Hero metric label (e.g. "Organic traffic"). */
  title?: string
  /** Contextual help — renders a (?) on the hero metric label. */
  tooltip?: string
  tooltipDescription?: string
  value?: string | number | null
  suffix?: string
  /** Period / context line under the metric (e.g. "Last 12 months"). */
  caption?: string
  /** Full caption shown on hover when the visible caption is shortened. */
  captionTitle?: string
  trend?: number | null
  trendSuffix?: string
  invertTrend?: boolean
  /** Hero sparkline series (metric identity color via sparklineColor). */
  sparkline?: number[] | Record<string, number | string>[]
  sparklineColor?: string
  facts?: FactItem[]
  factColumns?: 2 | 3
  /** Threshold state — surfaces UiStat's status chip beside the metric label. */
  status?: 'crisis' | 'warning' | 'good'
  /**
   * Separator treatment between hero / facts and under the header:
   *   - `bleed` crisp hairline bled to the card edges — structural ⊤ (default)
   *   - `inset` same full-bleed geometry, carved (line + highlight offset)
   *   - `fade`  muted hairline that fades before the padding edges
   *   - `none`  no rule — spacing carries the split (Linear-clean)
   * `bleed` / `inset` run the header rule full card width and the column rule
   * from that rule down to the card's bottom edge.
   */
  divider?: 'fade' | 'none' | 'inset' | 'bleed'
  /**
   * The one sanctioned card lift (--elevation-emphasis + primary-tinted top
   * bevel). Defaults on: the entity header is a detail page's single hero
   * surface, so it's the sanctioned "max one per page" emphasis. Turn off when
   * the page already spends its emphasis elsewhere.
   */
  emphasis?: boolean
  /** Stack identity and actions on narrow screens when actions need full labels. */
  stackHeaderOnMobile?: boolean
}>()

defineSlots<{
  /** Override the identity line (e.g. to host a UiOverflowCount / favicon). */
  heading?: () => VNodeChild
  /** Top-right actions (eject menu, refresh, links). */
  actions?: () => VNodeChild
  /** Override the hero column entirely. */
  hero?: () => VNodeChild
  /** Override the facts column entirely. */
  facts?: () => VNodeChild
}>()
// Card hover drives the sparkline's draw-in tracer — the sanctioned spark-joy
// micro-moment (DESIGN: hover tracer is the one exception to animate-once).
const cardEl = useTemplateRef<HTMLElement>('cardEl')
const cardHovered = useElementHover(cardEl)
</script>

<template>
  <UiCard variant="subtle" :emphasis="emphasis" :class="`divider-${divider}`" data-ui="UiEntitySummary">
    <!-- Identity + actions header (optional). Separator is a faded hairline
         (mask idiom) so it never hard-hits the card padding edges. -->
    <div
      v-if="heading || $slots.heading || $slots.actions"
      class="entity-hrule relative mb-5 flex justify-between gap-3 pb-4"
      :class="stackHeaderOnMobile ? 'flex-col items-stretch sm:flex-row sm:items-center' : 'items-center'"
    >
      <slot name="heading">
        <span class="truncate text-sm font-medium text-highlighted">{{ heading }}</span>
      </slot>
      <div
        v-if="$slots.actions"
        class="flex shrink-0 items-center gap-2"
        :class="stackHeaderOnMobile ? 'w-full justify-end sm:w-auto' : ''"
      >
        <slot name="actions" />
      </div>
    </div>

    <!-- Hero (left, dominant) · facts (right, recede). Neutral column rule.
         items-stretch lets the sparkline flex-fill the hero column so it
         anchors the metric instead of floating; the facts column top-aligns. -->
    <div class="grid items-stretch gap-y-6 lg:grid-cols-2 lg:gap-x-0">
      <slot name="hero">
        <div ref="cardEl" class="flex min-w-0 flex-col gap-1 lg:pr-6">
          <UiStat
            size="lg"
            :title="title"
            :tooltip="tooltip"
            :tooltip-description="tooltipDescription"
            :value="value"
            value-class="text-highlighted"
            :suffix="suffix"
            :trend="trend"
            :trend-suffix="trendSuffix"
            :invert-trend="invertTrend"
            :status="status"
            trend-colored
          />
          <p v-if="caption" class="text-sm text-muted" :title="captionTitle">
            {{ caption }}
          </p>
          <ClientOnly v-if="sparkline?.length">
            <div class="mt-2 min-h-[76px] flex-1">
              <UiSparkline
                :data="sparkline"
                :color="sparklineColor"
                :inverted="invertTrend"
                :stroke-width="2"
                interactive
                :hovered="cardHovered"
                area
                width="100%"
                height="100%"
                preserve-aspect-ratio="none"
                class="block size-full"
              />
            </div>
          </ClientOnly>
        </div>
      </slot>

      <div class="entity-vrule relative min-w-0 lg:pl-6">
        <slot name="facts">
          <UiFactsGrid :facts="facts" :columns="factColumns" />
        </slot>
      </div>
    </div>
  </UiCard>
</template>

<style scoped>
/* Separator geometry (shared). Color / mask / depth is set per `divider` mode
   below so the same positions read four ways. A hard, edge-to-edge, full-weight
   1px line is the cheap tell — every mode here softens or structures that. */
.entity-hrule::after {
  content: '';
  position: absolute;
  inset-inline: 0;
  bottom: 0;
  height: 1px;
}

/* Vertical column rule — desktop only; on mobile the columns stack (gap-y). */
@media (min-width: 1024px) {
  .entity-vrule::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0.25rem;
    bottom: 0.25rem;
    width: 1px;
  }
}

/* none — no rule; spacing carries the split. */
.divider-none .entity-hrule::after,
.divider-none .entity-vrule::before {
  display: none;
}

/* fade — muted hairline that fades before the padding edges (mask idiom). */
.divider-fade .entity-hrule::after {
  background: var(--ui-border-muted);
  -webkit-mask-image: linear-gradient(to right, transparent, #000 4%, #000 96%, transparent);
  mask-image: linear-gradient(to right, transparent, #000 4%, #000 96%, transparent);
}
.divider-fade .entity-vrule::before {
  background: var(--ui-border-muted);
  -webkit-mask-image: linear-gradient(to bottom, transparent, #000 14%, #000 86%, transparent);
  mask-image: linear-gradient(to bottom, transparent, #000 14%, #000 86%, transparent);
}

/* bleed — crisp full-length hairline, edge to edge. Structured / Stripe-like. */
.divider-bleed .entity-hrule::after,
.divider-bleed .entity-vrule::before {
  background: var(--ui-border);
}

/* inset — carved line: a hairline with a 1px light highlight offset below / to
   the right, so the seam reads recessed (tactile depth, not a flat stroke). */
.divider-inset .entity-hrule::after {
  background: var(--ui-border-accented);
  box-shadow: 0 1px 0 var(--ui-bg-elevated);
}
.divider-inset .entity-vrule::before {
  background: var(--ui-border-accented);
  box-shadow: 1px 0 0 var(--ui-bg-elevated);
}

/* Full-bleed structural geometry (bleed + inset): the seams reach the card's
   inner edges. --seam-pad tracks UiCard's body padding so the negative insets
   land exactly on the border; the card's overflow-hidden clips any overshoot.
   Header rule → full card width; column rule → from the header rule (mb-5) down
   to the card's bottom edge (the Vercel ⊤). */
[data-ui='UiEntitySummary'] {
  --seam-pad: 1rem;
}
@media (min-width: 640px) {
  [data-ui='UiEntitySummary'] {
    --seam-pad: var(--density-card-padding, 1.5rem);
  }
}
.divider-bleed .entity-hrule::after,
.divider-inset .entity-hrule::after {
  inset-inline: calc(-1 * var(--seam-pad));
}
@media (min-width: 1024px) {
  .divider-bleed .entity-vrule::before,
  .divider-inset .entity-vrule::before {
    top: -1.25rem;
    bottom: calc(-1 * var(--seam-pad));
  }
}
</style>
