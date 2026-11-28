<script lang="ts" setup>
import type { RouteLocationRaw } from 'vue-router'
import { computed, ref } from 'vue'
import { NuxtLink, UiChartSkeleton, UiIcon, UiTooltip } from '#components'
/**
 * ProFunnel
 *
 * SVG funnel chart with proportionally tapered bands between steps.
 * First step = 100%, each subsequent band's height is scaled to its
 * share of the first step's value. A conversion % pill sits inside
 * each band; the absolute count sits above; the step label sits below.
 */

export interface FunnelStep {
  key: string
  label: string
  value: number
  /** Pre-formatted display value (e.g. "72K"). Falls back to value.toLocaleString(). */
  displayValue?: string
  to?: RouteLocationRaw
  tooltip?: string
}

interface Props {
  steps: FunnelStep[]
  title?: string
  /** Large hero stat shown top-left of header (e.g. "7.8%"). */
  primary?: string
  /** One-line context shown under the primary stat. */
  context?: string
  /** Period delta shown top-right (e.g. "↑ 0.4% vs prior 30 days"). */
  delta?: { value: string, direction: 'up' | 'down' | 'flat' }
  /** Color ramp source. Default uses neutral text token. */
  scale?: 'neutral' | 'primary' | 'success'
  /** SVG viewBox height; width is fixed at 1000 internally. */
  height?: number
  /** Aria label for the SVG region. */
  ariaLabel?: string
  /** Cold-loading zero-CLS funnel skeleton state. */
  loading?: boolean
}

const {
  steps,
  scale = 'neutral',
  height = 240,
  ariaLabel,
  loading = false,
} = defineProps<Props>()

const hoveredKey = ref<string | null>(null)

const VB_W = 1000
const LABEL_LINE_HEIGHT_PX = 14
const LABEL_UNDERLINE_OFFSET_PX = 4
const LABEL_DECORATION_PX = 1
const LABEL_PADDING_PX = 8
// The band inset must clear the complete label box, including the dotted help
// underline. A generic 24px inset let that decoration touch the chart edge.
const PAD_Y = LABEL_LINE_HEIGHT_PX + LABEL_UNDERLINE_OFFSET_PX + LABEL_DECORATION_PX + LABEL_PADDING_PX

const baseValue = computed(() => steps[0]?.value || 1)
const maxValue = computed(() => Math.max(...steps.map(s => s.value), 1))

const bands = computed(() => {
  if (!steps.length)
    return []
  const colW = VB_W / steps.length
  const innerH = height - PAD_Y * 2
  const midY = height / 2

  return steps.map((step, i) => {
    const prev = i === 0 ? step.value : steps[i - 1]!.value
    const curr = step.value
    const prevH = (prev / maxValue.value) * innerH
    const currH = (curr / maxValue.value) * innerH
    const x = i * colW

    // Smooth cubic-bezier S-curve taper: prev-top → curr-top → curr-bottom → prev-bottom
    const cp = colW * 0.45
    const x2 = x + colW
    const yTop1 = midY - prevH / 2
    const yTop2 = midY - currH / 2
    const yBot2 = midY + currH / 2
    const yBot1 = midY + prevH / 2
    const path = [
      `M ${x} ${yTop1}`,
      `C ${x + cp} ${yTop1} ${x2 - cp} ${yTop2} ${x2} ${yTop2}`,
      `L ${x2} ${yBot2}`,
      `C ${x2 - cp} ${yBot2} ${x + cp} ${yBot1} ${x} ${yBot1}`,
      'Z',
    ].join(' ')

    // 5-stop opacity ramp, lightest at right (drop-off) — matches the reference image
    const ramp = [0.85, 0.55, 0.35, 0.22, 0.12]
    const opacity = ramp[Math.min(i, ramp.length - 1)] ?? 0.12

    const conversionRatio = baseValue.value > 0
      ? Math.min(100, Math.max(0, (curr / baseValue.value) * 100))
      : 0
    // One decimal keeps small but real losses visible. For example 370/371 is
    // 99.7%, not a false 100% retention claim.
    const conversion = Math.round(conversionRatio * 10) / 10
    const conversionLabel = Number.isInteger(conversion)
      ? String(conversion)
      : conversion.toFixed(1)

    return {
      step,
      path,
      x,
      colW,
      midY,
      currH,
      opacity,
      conversion,
      conversionLabel,
      displayValue: step.displayValue ?? curr.toLocaleString(),
    }
  })
})

const scaleVar = computed(() => {
  if (scale === 'primary')
    return 'var(--ui-primary)'
  if (scale === 'success')
    return 'var(--color-success-500, var(--ui-primary))'
  return 'var(--ui-text)'
})

function stageAriaLabel(band: typeof bands.value[number]): string {
  const baseLabel = steps[0]?.label ?? 'first stage'
  return `${band.step.label}: ${band.displayValue}, ${band.conversionLabel}% of ${baseLabel}.${band.step.tooltip ? ` ${band.step.tooltip}` : ''}`
}
</script>

<template>
  <div
    class="pro-funnel"
    :style="{
      '--funnel-label-underline-offset': `${LABEL_UNDERLINE_OFFSET_PX}px`,
      '--funnel-label-decoration': `${LABEL_DECORATION_PX}px`,
    }"
  >
    <!-- Header -->
    <div v-if="title || primary || delta" class="flex items-start justify-between gap-4 mb-3">
      <div class="min-w-0">
        <div v-if="title" class="text-label mb-1">
          {{ title }}
        </div>
        <div v-if="primary" class="text-3xl font-bold text-default leading-none">
          {{ primary }}
        </div>
        <p v-if="context" class="text-xs text-muted mt-1.5">
          {{ context }}
        </p>
      </div>
      <div v-if="delta" class="text-right shrink-0">
        <div
          class="inline-flex items-center gap-1 text-xs font-medium tabular-nums"
          :class="delta.direction === 'up' ? 'text-success' : delta.direction === 'down' ? 'text-error' : 'text-dimmed'"
        >
          <UiIcon
            v-if="delta.direction !== 'flat'"
            :name="delta.direction === 'up' ? 'i-lucide-arrow-up' : 'i-lucide-arrow-down'"
            class="size-3 shrink-0"
            aria-hidden="true"
          />
          <span v-else aria-hidden="true">·</span>
          <span class="sr-only">{{ delta.direction === 'up' ? 'Up' : delta.direction === 'down' ? 'Down' : 'No change' }}</span>
          {{ delta.value }}
        </div>
      </div>
    </div>

    <UiChartSkeleton v-if="loading" variant="funnel" :height="height" />

    <!-- Narrow containers use stacked stage rows. The chart remains the same
         component, but its labels never have to share four cramped columns. -->
    <template v-else>
      <div class="funnel-mobile" :style="{ '--funnel-base': scaleVar }" role="group" :aria-label="ariaLabel || title || 'Funnel stages'">
        <UiTooltip
          v-for="band in bands"
          :key="`m-${band.step.key}`"
          :text="band.step.tooltip"
          :disabled="!band.step.tooltip"
          trigger-as="child"
        >
          <component
            :is="band.step.to ? NuxtLink : band.step.tooltip ? 'button' : 'div'"
            :to="band.step.to || undefined"
            :type="!band.step.to && band.step.tooltip ? 'button' : undefined"
            :role="!band.step.to && !band.step.tooltip ? 'group' : undefined"
            :aria-label="stageAriaLabel(band)"
            class="funnel-mobile-row"
          >
            <span class="funnel-mobile-copy">
              <span class="text-sm font-medium text-default">{{ band.step.label }}</span>
              <span class="text-sm numerals-display text-default">{{ band.displayValue }}</span>
            </span>
            <span class="funnel-mobile-meta">
              {{ band.conversionLabel }}% of {{ steps[0]?.label.toLowerCase() ?? 'first stage' }}
            </span>
            <span class="funnel-mobile-track" aria-hidden="true">
              <span :style="{ width: `${band.conversion}%` }" />
            </span>
          </component>
        </UiTooltip>
      </div>

      <!-- Wide containers keep the visual UI funnel. The SVG is decorative;
         its visible stage controls are the single accessible representation. -->
      <div class="funnel-chart" role="group" :aria-label="ariaLabel || title || 'Funnel stages'">
        <div class="relative">
          <svg
            :viewBox="`0 0 ${VB_W} ${height}`"
            preserveAspectRatio="none"
            class="block w-full"
            :style="{ 'height': `${height}px`, '--funnel-base': scaleVar }"
            aria-hidden="true"
          >
            <g>
              <path
                v-for="(band, i) in bands"
                :key="band.step.key"
                :d="band.path"
                :fill="scaleVar"
                class="funnel-band transition-opacity duration-150"
                :style="{
                  '--band-delay': `${i * 60}ms`,
                  '--final-opacity': hoveredKey && hoveredKey !== band.step.key ? band.opacity * 0.45 : band.opacity,
                }"
              />
              <line
                v-for="i in steps.length - 1"
                :key="`div-${i}`"
                :x1="i * (VB_W / steps.length)"
                :x2="i * (VB_W / steps.length)"
                y1="0"
                :y2="height"
                stroke="var(--ui-border)"
                stroke-width="1"
                vector-effect="non-scaling-stroke"
                opacity="0.6"
              />
            </g>
          </svg>

          <div class="pointer-events-none absolute inset-0 grid" :style="{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }">
            <component
              :is="band.step.to ? NuxtLink : 'div'"
              v-for="band in bands"
              :key="`o-${band.step.key}`"
              :to="band.step.to || undefined"
              class="funnel-col transition-opacity duration-150"
              :class="[
                { 'funnel-col--link': !!band.step.to },
                hoveredKey && hoveredKey !== band.step.key ? 'opacity-50' : '',
              ]"
              @pointerenter="hoveredKey = band.step.key"
              @pointerleave="hoveredKey = null"
            >
              <span class="funnel-count">{{ band.displayValue }}</span>
              <span class="funnel-pill">{{ band.conversionLabel }}%</span>
              <UiTooltip
                v-if="band.step.tooltip"
                :text="stageAriaLabel(band)"
                :trigger-as="band.step.to ? 'span' : 'button'"
              >
                <span class="funnel-label funnel-label--help">{{ band.step.label }}</span>
              </UiTooltip>
              <span v-else class="funnel-label">{{ band.step.label }}</span>
            </component>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.pro-funnel {
  container-name: pro-funnel;
  container-type: inline-size;
  width: 100%;
}

.funnel-mobile {
  display: grid;
  gap: 0.5rem;
}

.funnel-chart {
  display: none;
}

.funnel-mobile-row {
  display: grid;
  min-height: 2.75rem;
  gap: 0.375rem;
  width: 100%;
  padding: 0.5rem;
  border-radius: 0.5rem;
  text-align: left;
  transition: background-color 150ms ease-out;
}

.funnel-mobile-row:is(button, a) {
  cursor: help;
}

.funnel-mobile-row:is(button, a):hover {
  background: var(--ui-bg-accented);
}

.funnel-mobile-row:is(button, a):focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}

.funnel-mobile-copy,
.funnel-mobile-meta {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.funnel-mobile-meta {
  color: var(--ui-text-muted);
  font-size: 0.875rem;
}

.funnel-mobile-track {
  display: block;
  height: 0.25rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--ui-bg-accented);
}

.funnel-mobile-track > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--funnel-base);
}

@container pro-funnel (min-width: 34rem) {
  .funnel-mobile {
    display: none;
  }

  .funnel-chart {
    display: block;
  }
}

.funnel-band {
  opacity: 0;
  animation: funnel-band-in 320ms ease-out forwards;
  animation-delay: var(--band-delay, 0ms);
}

.funnel-col {
  display: grid;
  grid-template-rows: auto 1fr auto;
  align-items: center;
  justify-items: center;
  padding: 0.5rem 0.5rem 0.5rem;
  pointer-events: auto;
  min-width: 0;
  text-align: center;
}

.funnel-col--link {
  cursor: pointer;
  border-radius: 0.375rem;
  outline: none;
}

.funnel-col--link:hover .funnel-pill {
  box-shadow: 0 0 0 1px var(--ui-border-accented);
}

.funnel-col--link:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}

.funnel-count {
  font-size: 0.875rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--ui-text);
  line-height: 1;
}

.funnel-pill {
  font-size: 0.875rem;
  font-weight: 600;
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  background: var(--ui-bg);
  color: var(--ui-text);
  border: 1px solid var(--ui-border);
  line-height: 1;
}

.funnel-label {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ui-text-muted);
  line-height: 1;
}

.funnel-label--help {
  text-decoration-line: underline;
  text-decoration-style: dotted;
  text-decoration-color: var(--ui-border-accented);
  text-decoration-thickness: var(--funnel-label-decoration);
  text-underline-offset: var(--funnel-label-underline-offset);
}

@keyframes funnel-band-in {
  from { opacity: 0; }
  to   { opacity: var(--final-opacity, 1); }
}

@media (prefers-reduced-motion: reduce) {
  .funnel-band {
    animation: none;
    opacity: var(--final-opacity, 1);
  }
}
</style>
