<script setup lang="ts">
import type { SiteFleetRow } from '~~/layers/core/app/types'
import type { LiveWork } from '#layers/pro-saas/shared/live-work'
import { siteLabel } from '~~/layers/core/app/utils/site-format'

defineProps<{ work: LiveWork<SiteFleetRow>[], showNames: boolean }>()
</script>

<template>
  <ul class="activity-list divide-y divide-default">
    <li v-for="{ site, activities } in work" :key="site.siteId" :class="{ 'activity-site': showNames }" class="px-4 py-1">
      <div v-if="showNames" class="activity-name flex min-w-0 items-center gap-2 py-1 font-medium text-highlighted">
        <UiFavicon :domain="site.property" :size="16" decorative />
        <span class="truncate">{{ siteLabel(site) }}</span>
      </div>
      <div class="min-w-0">
        <div v-for="activity in activities" :key="activity.source" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-1 text-sm">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="size-1.5 shrink-0 rounded-full" :class="activity.phase === 'running' ? 'bg-primary motion-safe:animate-pulse' : activity.phase === 'paused' ? 'bg-warning' : 'bg-dimmed'" aria-hidden="true" />
              <span>{{ activity.label }}</span>
              <UProgress v-if="activity.percent != null" :model-value="activity.percent" :aria-label="activity.label" size="xs" class="max-w-14" />
              <span v-if="activity.percent != null" class="font-mono text-muted tabular-nums">{{ activity.percent }}%</span>
            </div>
            <p v-if="activity.source === 'search-console' && site.syncedRange.oldest && site.syncedRange.newest" class="mt-1 ps-3.5 text-xs text-muted">
              {{ site.syncedRange.oldest }} to {{ site.syncedRange.newest }} synced
            </p>
          </div>
          <NuxtLink :to="activity.to" class="inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline">
            {{ activity.source === 'inspection' ? 'Indexing' : activity.source === 'sitemaps' ? 'Sitemaps' : 'Search Console' }}
            <UiIcon name="next" class="size-3 shrink-0" aria-hidden="true" />
          </NuxtLink>
        </div>
      </div>
    </li>
  </ul>
  <ProLiveInspectionAllowance v-if="work.some(item => item.activities.some(activity => activity.monthly))" />
</template>

<style scoped>
.activity-list {
  container-type: inline-size;
}
@container (min-width: 34rem) {
  .activity-site {
    display: grid;
    grid-template-columns: minmax(9rem, 1fr) minmax(0, 2fr);
    align-items: start;
    column-gap: 1rem;
  }
  .activity-name {
    min-height: 3.25rem;
  }
}
</style>
