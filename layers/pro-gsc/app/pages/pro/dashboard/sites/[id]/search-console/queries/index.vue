<script lang="ts" setup>
import { computed, ref } from 'vue'
import ProGscSurfaceBar from '#layers/pro-gsc/app/components/pro/ProGscSurfaceBar.vue'
import ProGscTopEntityTrendPanel from '#layers/pro-gsc/app/components/pro/ProGscTopEntityTrendPanel.vue'
import { buildBrandFacet, buildQuestionFacet, useProGscFilters } from '#layers/pro-gsc/app/composables/useProGscFilters'
import ProTableKeywords from '#layers/pro-gsc/app/internal/components/pro/ProTableKeywords.vue'
import { deriveUrlBrandKeywords } from '#layers/pro-gsc/shared/brand-queries'

definePageMeta({
  proTab: { feature: 'search-console', label: 'Queries', icon: 'i-lucide-search', order: 10 },
  title: 'Queries',
  icon: 'i-lucide-search',
})

const { siteId, site, siteStatus, gscdumpSiteId } = useSite('Queries')
const { data: syncData, isLifecycleSettled, hasError: syncStatusError, refresh: refreshSyncStatus } = useProGscStatus(siteId)
const { period } = useSitePeriod()
const { brand, questions } = useProGscFilters()

// A has no keyword profile, so brand terms come from what the site URL
// deterministically implies. The Brand facet on the control bar reads the same
// list the table's brand badge does.
const brandTerms = computed(() => deriveUrlBrandKeywords(site.value?.url))

const queryFacets = computed(() => [
  buildBrandFacet(brand.value, brandTerms.value),
  buildQuestionFacet(questions.value),
].filter((facet): facet is NonNullable<typeof facet> => !!facet))

// The top-5 stacked trend leads the table, plotting whichever metric the
// control bar has selected. It mounts with its own skeleton and only unmounts
// if the table settles empty or errored, so nothing pops in above the table.
const hasRows = ref(true)
</script>

<template>
  <UiAlert
    v-if="siteStatus === 'error'"
    status="error"
    title="Failed to load Site data."
  >
    <template #action>
      <UiButton size="xs" purpose="secondary" to="/pro/dashboard">
        Back to Sites
      </UiButton>
    </template>
  </UiAlert>

  <UiSkeleton v-else-if="!isLifecycleSettled" :lines="4" />

  <UiAlert v-else-if="syncStatusError" status="error" title="Search Console sync status could not load.">
    <template #action>
      <UiButton purpose="secondary" @click="refreshSyncStatus()">
        Retry
      </UiButton>
    </template>
  </UiAlert>

  <UiAlert v-else-if="!syncData?.queryable" status="info" title="Search Console data is still being prepared.">
    Queries appear when the first sync makes this Site's data readable.
  </UiAlert>

  <div v-else data-testid="search-console-queries-page" class="flex flex-col gap-5">
    <ProGscSurfaceBar surface="queries" :site-id="siteId" />

    <ProPageZone tier="primary" first>
      <ProSectionHeader
        title="Queries"
        icon="i-lucide-search"
        tooltip="What people searched for before Google showed one of your pages."
      />
      <ProGscTopEntityTrendPanel
        v-if="gscdumpSiteId && hasRows"
        :gscdump-site-id="gscdumpSiteId"
        dimension="query"
        :facets="queryFacets"
        :height="140"
      />
      <ProTableKeywords
        :site-id="siteId"
        :site-url="site?.url"
        :gscdump-site-id="gscdumpSiteId"
        :brand-terms="brandTerms"
        :period="period"
        :page-size="25"
        @available="hasRows = $event"
      />
    </ProPageZone>
  </div>
</template>
