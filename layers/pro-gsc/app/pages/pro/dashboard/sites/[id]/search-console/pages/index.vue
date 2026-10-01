<script lang="ts" setup>
import { ref } from 'vue'
import ProGscSurfaceBar from '#layers/pro-gsc/app/components/pro/ProGscSurfaceBar.vue'
import ProGscTopEntityTrendPanel from '#layers/pro-gsc/app/components/pro/ProGscTopEntityTrendPanel.vue'
import ProTablePages from '#layers/pro-gsc/app/internal/components/pro/ProTablePages.vue'

definePageMeta({
  proTab: { feature: 'search-console', label: 'Pages', icon: 'i-lucide-file-text', order: 20 },
  title: 'Pages',
  icon: 'i-lucide-file-text',
})

const { siteId, siteStatus, gscdumpSiteId } = useSite('Pages')
const { period } = useSitePeriod()

// Same shape as Queries: the top-5 stacked trend leads the table and plots
// whichever metric the control bar has selected. It only unmounts if the table
// settles empty or errored, so nothing pops in above the table later.
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

  <div v-else data-testid="search-console-pages-page" class="flex flex-col gap-5">
    <ProGscSurfaceBar surface="pages" :site-id="siteId" />

    <ProPageZone tier="primary" first>
      <ProSectionHeader
        title="Pages"
        icon="i-lucide-file-text"
        tooltip="The pages Google showed in search results, ranked by the metric you picked."
      />
      <ProGscTopEntityTrendPanel
        v-if="gscdumpSiteId && hasRows"
        :gscdump-site-id="gscdumpSiteId"
        dimension="page"
        :height="180"
      />
      <ProTablePages
        :site-id="siteId"
        :gscdump-site-id="gscdumpSiteId"
        :period="period"
        :page-size="25"
        @available="hasRows = $event"
      />
    </ProPageZone>
  </div>
</template>
