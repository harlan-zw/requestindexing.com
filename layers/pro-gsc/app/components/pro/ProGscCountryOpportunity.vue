<script setup lang="ts">
import type { CountryOpportunityRow } from '../../../shared/country-opportunity'
import { useHumanFriendlyNumber } from '@nuxtseo/design-system/app/composables/formatting'
import { countryCodeToFlagIcon, getCountryName } from '@nuxtseo/design-system/app/utils/countries'
import { computed } from 'vue'
import { ClientOnly, UiEmptyState, UiIcon, UiScatterPlot } from '#components'
import { COUNTRY_OPPORTUNITY_MIN_IMPRESSIONS, projectCountryOpportunity } from '../../../shared/country-opportunity'

// Country opportunity scatter, ported from nuxtseo.com. Each country is
// plotted by reach (impressions, x, log scale) against conversion (CTR, y),
// the flag sized by clicks. Bottom-right means lots of reach but weak CTR, a
// snippet or title opportunity. Top-right means winning.
//
// Presentational only. The caller supplies the rows and the placement rules
// live in `shared/country-opportunity`.

const { rows = [], loading = false, error = false } = defineProps<{
  rows?: CountryOpportunityRow[]
  loading?: boolean
  /** The country fetch failed or timed out. Never render that as "no data". */
  error?: boolean
}>()

const projection = computed(() => projectCountryOpportunity(rows))
const hiddenCount = computed(() => projection.value.hiddenCount)
const plotted = computed(() => projection.value.points.map(point => ({
  ...point,
  title: getCountryName(point.country),
  description: `${useHumanFriendlyNumber(point.clicks)} clicks · ${useHumanFriendlyNumber(point.impressions)} impressions · ${(point.ctr * 100).toFixed(1)}% CTR · pos ${point.position.toFixed(1)}`,
})))
</script>

<template>
  <ClientOnly>
    <!-- SSR reserves the same plot box the client renders, so the card does
         not grow from zero height on mount. -->
    <template #fallback>
      <UiScatterPlot loading :points="[]" midline y-label="CTR →" x-label="Impressions →" />
    </template>

    <UiScatterPlot v-if="loading" loading :points="[]" midline y-label="CTR →" x-label="Impressions →" />

    <div v-else-if="plotted.length">
      <UiScatterPlot
        :points="plotted"
        midline
        y-label="CTR →"
        x-label="Impressions →"
      >
        <template #marker="{ point }">
          <UiIcon :name="countryCodeToFlagIcon(point.country)" class="rounded-[1px]" :style="{ width: `${point.iconPx}px`, height: `${point.iconPx}px` }" aria-hidden="true" />
        </template>
      </UiScatterPlot>
      <p v-if="hiddenCount" class="mt-1 text-xs text-dimmed">
        {{ hiddenCount }} low-volume {{ hiddenCount === 1 ? 'country' : 'countries' }} hidden. Under {{ COUNTRY_OPPORTUNITY_MIN_IMPRESSIONS }} impressions is too few for a reliable CTR.
      </p>
    </div>

    <!-- Held to the plot's own height so an empty site lines up with a
         populated one. A failed fetch reads as a failure, never as "this site
         has no country traffic". -->
    <div v-else class="flex h-60 items-center justify-center">
      <UiEmptyState
        v-if="error"
        compact
        icon="caution"
        title="Could not load country data"
        description="The country read did not finish. Change the date range or reload to try again."
      />
      <UiEmptyState
        v-else
        compact
        icon="globe"
        title="No country data yet"
        description="Search Console needs impression data before country performance appears."
      />
    </div>
  </ClientOnly>
</template>
