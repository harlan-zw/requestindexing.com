<script setup lang="ts">
import type { IndexNowConnectionV1 } from '@gscdump/contracts/v1'
import type { SiteFleetRow } from '~~/layers/core/app/types'
import type { OverviewSiteRead } from '../../composables/useProOverviewReads'
import type { BingIntegrationRow } from '../../utils/bing-integration-view'
import type { OverviewFleetRow } from './overview-sites'
import { useProShellCopy } from '@nuxtseo/pro-shell/composables/useProShellCopy'
import { useProShellRoute } from '@nuxtseo/pro-shell/composables/useProShellRoute'
import { fillCopy } from '@nuxtseo/pro-shell/shared/copy'
import { proShellFleetPage } from '@nuxtseo/pro-shell/shared/fleet-sites'
import { computed, ref, watch } from 'vue'
import { NuxtLink, UiButton, UiIcon } from '#components'
import ProOverviewSiteCard from './ProOverviewSiteCard.vue'

const { rows, sites, bingRows, reads, setupSiteId, setupIndexNow } = defineProps<{
  rows: readonly OverviewFleetRow[]
  sites: readonly Pick<SiteFleetRow, 'siteId' | 'gscdumpSiteId'>[]
  bingRows: readonly BingIntegrationRow[]
  reads: Readonly<Record<string, OverviewSiteRead>>
  setupSiteId: string | null
  setupIndexNow: IndexNowConnectionV1 | null
}>()

const copy = useProShellCopy().fleetSites
const sitesTo = useProShellRoute()('sites')
const page = ref(0)
const pager = computed(() => proShellFleetPage(rows, page.value, 9))
watch(() => pager.value.page, clamped => page.value = clamped)
const bingBySite = computed(() => new Map(bingRows.map(row => [row.site.siteId, row])))
const engineIds = computed(() => new Map(sites.map(site => [site.siteId, site.gscdumpSiteId])))
</script>

<template>
  <div>
    <h2 class="mb-3 px-1 text-label">
      <NuxtLink
        v-if="sitesTo"
        :to="sitesTo"
        class="inline-flex items-center gap-1 rounded-sm outline-none hover:text-default focus-visible:ring-2 focus-visible:ring-primary"
      >
        {{ copy.heading }}
        <UiIcon name="chevron-right" class="size-3" aria-hidden="true" />
      </NuxtLink>
      <template v-else>
        {{ copy.heading }}
      </template>
    </h2>
    <div class="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
      <ProOverviewSiteCard
        v-for="row in pager.rows"
        :key="row.id"
        :row="row"
        :gscdump-site-id="engineIds.get(row.id)"
        :bing-row="bingBySite.get(row.id)"
        :indexing="reads[row.id]?.indexing"
        :setup-index-now="row.id === setupSiteId ? setupIndexNow : undefined"
      />
    </div>
    <div v-if="pager.pageCount > 1" class="mt-2 flex items-center justify-between gap-2 text-sm text-muted">
      <span>{{ fillCopy(copy.pagerRange, { start: pager.start, end: pager.end, total: rows.length }) }}</span>
      <div class="flex gap-1">
        <UiButton purpose="quiet" size="xs" icon="chevron-left" :aria-label="copy.previousPage" :disabled="pager.page === 0" @click="page = pager.page - 1" />
        <UiButton purpose="quiet" size="xs" icon="chevron-right" :aria-label="copy.nextPage" :disabled="pager.page === pager.pageCount - 1" @click="page = pager.page + 1" />
      </div>
    </div>
  </div>
</template>
