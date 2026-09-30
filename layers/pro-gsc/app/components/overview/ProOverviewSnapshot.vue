<script setup lang="ts">
import type { OverviewSnapshotCard, OverviewSnapshotKey } from './overview-snapshot'
import { computed } from 'vue'
import { formatNumber } from '~~/layers/design-system/app/composables/formatting'
import { NuxtLink, UiButton, UiIcon, UiSkeleton, UiSparkline, UiTooltip } from '#components'
import { OVERVIEW_SNAPSHOT_META } from './overview-snapshot'

// The Search Console band, ported from gscdump.com's `AppOverviewSnapshot.vue`,
// itself a cut of nuxtseo.com's `ProOverviewSnapshot.vue`.
//
// Upstream lets a reader add, remove, reorder and persist cards, and pick the
// window. Both are cut: this band is a fixed set over one fixed window. Bing
// stays off, as on gscdump.com, because Bing reads one Site at a time. A card
// is a doorway only where a fleet route owns its number.
const { cards, loading = false, failedSites = 0 } = defineProps<{
  cards: OverviewSnapshotCard[]
  loading?: boolean
  /** Sites with a failed read, which the cards leave out. */
  failedSites?: number
}>()

const emit = defineEmits<{ retry: [] }>()

const PLACEHOLDER_KEYS: OverviewSnapshotKey[] = ['clicks', 'impressions', 'ctr', 'position', 'indexed', 'not-indexed']

const blocking = computed(() => !loading && !cards.length && failedSites > 0)

function signed(value: number, digits = 0): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`
}
</script>

<template>
  <section v-if="loading || blocking || cards.length" aria-labelledby="overview-snapshot-heading">
    <div class="mb-3 flex min-h-9 flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h2 id="overview-snapshot-heading" class="text-label">
        Search Console
      </h2>
      <span class="text-xs text-dimmed">Last 28 days, against the 28 days before</span>
    </div>

    <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      <span class="sr-only" role="status" aria-live="polite">Loading Search Console totals</span>
      <div v-for="(key, index) in PLACEHOLDER_KEYS" :key="key" aria-hidden="true" class="min-h-28 rounded-xl border border-default bg-elevated/20 p-3">
        <p class="text-xs text-dimmed">
          {{ OVERVIEW_SNAPSHOT_META[key].label }}
        </p>
        <UiSkeleton type="text" :base="64" :range="28" :index="index + 4" class="mt-2 !h-6" />
        <UiSkeleton type="block" class="mt-4 h-8 w-full rounded" />
      </div>
    </div>

    <div v-else-if="blocking" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-default bg-elevated/20 p-4">
      <p class="text-sm text-muted">
        Search Console totals did not load. Retry to read them again.
      </p>
      <UiButton purpose="secondary" size="sm" label="Retry" class="min-h-11 sm:min-h-9" @click="emit('retry')" />
    </div>

    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <component
          :is="OVERVIEW_SNAPSHOT_META[card.key].to ? NuxtLink : 'div'"
          v-for="card in cards"
          :key="card.key"
          :to="OVERVIEW_SNAPSHOT_META[card.key].to ?? undefined"
          class="group block rounded-xl border border-default bg-elevated/20 p-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary"
          :class="OVERVIEW_SNAPSHOT_META[card.key].to ? 'hover:border-accented' : ''"
        >
          <div class="flex items-center gap-1.5">
            <UiIcon name="i-simple-icons-google" class="size-3.5 shrink-0 opacity-70" aria-hidden="true" />
            <UiTooltip :text="OVERVIEW_SNAPSHOT_META[card.key].hint" trigger-as="span">
              <p class="min-w-0 truncate text-xs text-dimmed">
                {{ OVERVIEW_SNAPSHOT_META[card.key].label }}
              </p>
            </UiTooltip>
            <UiIcon v-if="OVERVIEW_SNAPSHOT_META[card.key].to" name="chevron-right" class="ml-auto size-3 shrink-0 text-dimmed opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
          </div>

          <template v-if="card.key === 'clicks' || card.key === 'impressions'">
            <p class="mt-1 flex items-baseline gap-1.5 tabular-nums">
              <span class="text-xl font-semibold text-highlighted">{{ formatNumber(card.total) }}</span>
              <span v-if="card.deltaPercent != null" class="text-xs" :class="card.deltaPercent > 0 ? 'text-success' : 'text-error'">{{ signed(card.deltaPercent) }}%</span>
            </p>
            <UiSparkline v-if="card.spark.length" :data="card.spark" size="sm" :color="card.key" width="100%" :height="32" preserve-aspect-ratio="none" class="mt-3" />
          </template>

          <template v-else-if="card.key === 'ctr'">
            <p class="mt-1 flex items-baseline gap-1.5 tabular-nums">
              <span class="text-xl font-semibold text-highlighted">{{ card.percent.toFixed(1) }}%</span>
              <span v-if="card.deltaPoints != null" class="text-xs" :class="card.deltaPoints > 0 ? 'text-success' : 'text-error'">{{ signed(card.deltaPoints, 1) }}pp</span>
            </p>
            <UiSparkline v-if="card.spark.length" :data="card.spark" size="sm" color="ctr" width="100%" :height="32" preserve-aspect-ratio="none" class="mt-3" />
            <p v-else class="mt-3 text-xs text-dimmed">
              clicks per impression
            </p>
          </template>

          <template v-else-if="card.key === 'position'">
            <p class="mt-1 flex items-baseline gap-1.5 tabular-nums">
              <span class="text-xl font-semibold text-highlighted">{{ card.value.toFixed(1) }}</span>
              <!-- Position: down is good. A positive change is a drop. -->
              <span v-if="card.delta != null" class="text-xs" :class="card.delta < 0 ? 'text-success' : 'text-error'">{{ signed(card.delta, 1) }}</span>
            </p>
            <UiSparkline v-if="card.spark.length" :data="card.spark" size="sm" color="green" inverted width="100%" :height="32" preserve-aspect-ratio="none" class="mt-3" />
            <p v-else class="mt-3 text-xs text-dimmed">
              impressions-weighted
            </p>
          </template>

          <template v-else-if="card.key === 'indexed'">
            <p class="mt-1 tabular-nums">
              <span class="text-xl font-semibold text-highlighted">{{ Math.round(card.averagePercent) }}%</span>
            </p>
            <!-- Per-Site distribution, ranked. A cross-Site read, not a trend,
                 so a single Site keeps the caption instead. -->
            <div v-if="card.bars.length > 1" class="mt-3 flex h-8 items-end gap-1" aria-hidden="true">
              <span
                v-for="bar in card.bars.slice(0, 12)"
                :key="bar.label"
                class="w-2 rounded-sm bg-accented transition-colors group-hover:bg-[var(--ui-border-accented)]"
                :style="{ height: `${Math.max(bar.percent, 6)}%` }"
                :title="`${bar.label}: ${Math.round(bar.percent)}%`"
              />
            </div>
            <p v-else class="mt-3 text-xs text-dimmed">
              of known pages
            </p>
          </template>

          <template v-else>
            <p class="mt-1 tabular-nums">
              <span class="text-xl font-semibold text-highlighted">{{ formatNumber(card.total) }}</span>
            </p>
            <p class="mt-3 text-xs text-dimmed">
              known URLs outside Google's index
            </p>
          </template>
        </component>
      </div>

      <div v-if="failedSites > 0" class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p class="text-xs text-muted">
          Search Console data for {{ failedSites }} {{ failedSites === 1 ? 'Site' : 'Sites' }} did not load, so these cards leave {{ failedSites === 1 ? 'it' : 'them' }} out.
        </p>
        <UiButton purpose="link" size="xs" label="Retry" @click="emit('retry')" />
      </div>
    </template>
  </section>
</template>
