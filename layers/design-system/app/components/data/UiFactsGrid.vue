<script setup lang="ts">
import type { SemanticStatus } from '../../composables/semanticColors'
import { NuxtLink, UiHelpLabel, UiSkeleton } from '#components'
import { semanticColors } from '../../composables/semanticColors'

/**
 * UiFactsGrid — the quiet definition-list facts grid (label-over-value).
 * Extracted from the hand-rolled `<dl>` in per-URL / scan / entity headers.
 *
 * Color budget: a fact's `status` renders as a calm LEADING DOT + neutral value
 * (never a tinted value), so a grid of facts can't spend the page's color budget
 * on non-events. `mono` is for IDs / hashes / URLs / raw machine strings ONLY —
 * numerals stay `.numerals-display` at the call site, never mono.
 */

export interface FactItem {
  label: string
  value?: string | number | null
  /** Preserve the fact cell while its value is being resolved. */
  loading?: boolean
  /** Semantic status — renders a calm leading dot; never tints the value. */
  status?: SemanticStatus
  /** Mono value — IDs / hashes / raw machine strings ONLY (not URLs, not numerals). */
  mono?: boolean
  /** Span the full row (long values like a canonical URL). */
  span?: boolean
  /** Wrap long prose instead of truncating it. */
  wrap?: boolean
  /** Link the value (row-level navigation is fine; the value is not an @click). */
  to?: string
  /** Contextual help — renders a (?) UiHelpLabel on the fact label. */
  tooltip?: string
  /** Bold title in the help tooltip. Defaults to the label. */
  tooltipTitle?: string
  /** Full value shown on hover when the visible value is shortened. */
  title?: string
}

const { facts, columns = 3 } = defineProps<{
  facts: FactItem[]
  /** Max columns at sm+ (mobile is always 2). Default 3. */
  columns?: 2 | 3
}>()
</script>

<template>
  <dl
    data-ui="UiFactsGrid"
    class="grid grid-cols-2 gap-x-6 gap-y-3"
    :class="columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'"
  >
    <div
      v-for="fact in facts"
      :key="fact.label"
      class="min-w-0"
      :class="fact.span ? 'col-span-full' : ''"
    >
      <!--
        `UiHelpLabel` wraps its text in a UiTooltip trigger BUTTON, whose own
        type classes beat the inherited `.text-label` spec. Without this a fact
        that carries a tooltip renders sentence-case at a different size than
        the fact beside it, so one grid shows two label styles.
      -->
      <dt class="text-label [&_button]:font-[inherit] [&_button]:text-[inherit] [&_button]:uppercase [&_button]:tracking-[inherit]">
        <UiHelpLabel
          v-if="fact.tooltip"
          :text="fact.label"
          :tooltip="fact.tooltip"
          :tooltip-title="fact.tooltipTitle"
        />
        <template v-else>
          {{ fact.label }}
        </template>
      </dt>
      <dd class="mt-0.5 flex items-center gap-1.5 text-sm">
        <span
          v-if="fact.status && !fact.loading"
          class="size-1.5 shrink-0 rounded-full"
          :class="semanticColors[fact.status].dot"
          aria-hidden="true"
        />
        <UiSkeleton
          v-if="fact.loading"
          type="text"
          :base="80"
          :range="20"
          class="max-w-28"
        />
        <component
          :is="fact.to ? NuxtLink : 'span'"
          v-else
          :to="fact.to || undefined"
          :class="[
            fact.wrap ? 'break-words' : 'truncate',
            fact.mono ? 'font-mono text-muted' : 'text-default',
            fact.to ? 'underline-offset-2 hover:text-default hover:underline' : '',
          ]"
          :title="fact.title ?? (fact.value != null ? String(fact.value) : undefined)"
        >
          {{ fact.value ?? '—' }}
        </component>
      </dd>
    </div>
  </dl>
</template>
