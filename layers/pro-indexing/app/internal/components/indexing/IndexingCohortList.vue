<script lang="ts" setup>
import type { IndexCohortsResponse } from '#layers/pro-indexing/shared/contracts/index-cohorts'
import { withQuery } from 'ufo'
import { computed } from 'vue'
import { NuxtLink, UiIcon } from '#components'
import { sampledIndexStateMessage } from '#layers/pro-indexing/shared/index-cohorts'
// Which PART of the site does Google treat worse than the rest — the question
// GSC's own taxonomy ("37 crawled but not indexed") cannot answer because it
// names a symptom, not a place.
//
// Rows carry no severity dot on purpose: every cohort in this list already
// cleared a corrected significance test, so a dot on all of them encodes nothing
// and spends the status-colour budget on a non-signal (DESIGN, colour budget).

const { state, urlsRoute } = defineProps<{
  state: IndexCohortsResponse
  /** Base route for the URL evidence browser. */
  urlsRoute: string
}>()

const percent = (value: number) => `${Math.round(value * 100)}%`

const cells = computed(() => state._tag === 'outliers' ? state.cells : [])

/** One honest verdict sentence, then the list (ADR-0105). */
const verdict = computed(() => {
  if (state._tag === 'no-evidence') {
    if (state.reason === 'sampled-index-state' && state.sample)
      return sampledIndexStateMessage(state.sample.enumerated, state.sample.reported)
    return state.reason === 'no-completed-crawl'
      ? 'No completed crawl yet, so pages cannot be grouped.'
      : 'No inspected URL matched a crawled page.'
  }
  if (state._tag === 'uniform') {
    const spread = `${state.baseline.notIndexed.toLocaleString()} of ${state.baseline.total.toLocaleString()} pages are not indexed`
    // `tested: 0` means no group was large enough to compare — a coverage fact,
    // not a clean bill. Reporting it as "nothing indexes worse" would assert a
    // comparison that never ran.
    return state.tested === 0
      ? `${spread}, and no group of pages is large enough to compare.`
      : `No part of this Site indexes worse than the rest. ${spread}, spread evenly.`
  }
  // The hero already states the worst cohort as the page's primary diagnosis.
  // Restating it here would tell the same story twice on one screen, so this
  // line frames what the list IS. HOW it was ranked is method, and method rides
  // the dimmed coverage line below rather than the verdict.
  const count = state.cells.length
  return `${count === 1 ? 'One part' : `${count} parts`} of this Site index worse than the rest.`
})

/**
 * The join is never a census — pages Google knows but we never crawled carry no
 * cohort attributes, so they sit outside every rate on screen.
 */
const coverageNote = computed(() => {
  if (state._tag === 'no-evidence')
    return null
  const { analysed, notCrawled, excludedFragments } = state.coverage
  const groups = state._tag === 'uniform' || state._tag === 'outliers' ? state.tested : 0
  const parts = [
    groups > 0
      ? `${analysed.toLocaleString()} crawled pages compared across ${groups.toLocaleString()} groups`
      : `${analysed.toLocaleString()} crawled pages compared`,
  ]
  if (notCrawled > 0)
    parts.push(`${notCrawled.toLocaleString()} not-indexed URLs are outside this crawl`)
  if (excludedFragments > 0)
    parts.push(`${excludedFragments.toLocaleString()} fragment URLs excluded`)
  return parts.join(' · ')
})

function cohortRoute(pathPrefix: string | null): string {
  return withQuery(urlsRoute, pathPrefix
    ? { status: 'not_indexed', search: pathPrefix }
    : { status: 'not_indexed' })
}
</script>

<template>
  <div>
    <p class="text-sm text-default">
      {{ verdict }}
    </p>

    <div v-if="cells.length" class="mt-3 divide-y divide-default">
      <NuxtLink
        v-for="cell in cells"
        :key="`${cell.dimension}:${cell.key}`"
        :to="cohortRoute(cell.pathPrefix)"
        class="flex min-h-11 items-center gap-3 rounded-md px-1 py-2 hover:bg-accented focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm text-default">{{ cell.label }}</span>
          <span class="block text-mini text-muted">
            {{ cell.notIndexed.toLocaleString() }} of {{ cell.total.toLocaleString() }} pages · {{ percent(cell.complementRate) }} across the rest
            <template v-if="cell.overlapNotIndexed > 0">
              · {{ cell.overlapNotIndexed.toLocaleString() }} also counted above
            </template>
          </span>
        </span>
        <!-- The rate carries the meaning; the fraction is supporting detail. -->
        <span class="shrink-0 text-sm numerals-display text-default">
          {{ percent(cell.rate) }}
        </span>
        <UiIcon name="chevron-right" class="size-4 shrink-0 text-dimmed" aria-hidden="true" />
      </NuxtLink>
    </div>

    <p v-if="coverageNote" class="mt-3 text-mini text-dimmed">
      {{ coverageNote }}
    </p>
  </div>
</template>
