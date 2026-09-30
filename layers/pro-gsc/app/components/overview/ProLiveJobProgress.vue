<script setup lang="ts">
import type { OverviewSite } from './overview-sites'
import { computed, ref } from 'vue'
import { NuxtLink, UiButton, UiFavicon, UiIcon } from '#components'
import { overviewSiteLabel, siteRoute } from './overview-sites'

// ONE live banner, ported from gscdump.com's `AppOverviewLiveJobProgress`,
// itself nuxtseo.com's `ProLiveJobProgress`.
//
// Two row kinds, both read off the Site's own lifecycle: syncing (a sync is in
// flight) and queued (a connected Site whose first sync has not started). No
// new read: the Sites list already carries both, and the page refetches it on
// every sync event. A failed Site is not live work, so its row in the Sites
// column carries it instead.
const { sites } = defineProps<{
  sites: OverviewSite[]
}>()

const syncingSites = computed(() => sites.filter(site => site.syncStatus === 'syncing'))
// Queued for the first sync: not syncing and no reporting day yet. A Site with
// history doing routine work belongs on its own page, not on a live banner.
const queuedSites = computed(() => sites.filter(site =>
  (site.syncStatus === 'pending' || site.syncStatus === 'idle') && !site.syncedRange.newest))
const liveSites = computed(() => [...syncingSites.value, ...queuedSites.value])

const userExpanded = ref<boolean | null>(null)
// Rows stay open while there is little to scan. A longer list collapses behind
// the header until asked for.
const expanded = computed({
  get: () => userExpanded.value ?? liveSites.value.length <= 3,
  set: (value: boolean) => { userExpanded.value = value },
})

function sitesWord(count: number): string {
  return count === 1 ? 'Site' : 'Sites'
}

/** The days already in the record, when the Site reports a range. */
function syncedWindow(site: OverviewSite): string | null {
  const { oldest, newest } = site.syncedRange
  return oldest && newest ? `${oldest} to ${newest}` : null
}
</script>

<template>
  <div v-if="liveSites.length" class="relative w-full overflow-hidden rounded-xl border border-default bg-elevated/20">
    <UiButton
      type="button"
      purpose="quiet"
      intensity="subtle"
      block
      :animated-label="false"
      class="!min-h-11 !justify-start !flex-wrap gap-x-2.5 gap-y-1 !rounded-none !px-4 !py-2.5 text-left !whitespace-normal hover:bg-elevated/40"
      :aria-expanded="expanded"
      aria-label="Toggle live sync details"
      @click="expanded = !expanded"
    >
      <span class="flex shrink-0 items-center gap-1.5 text-mini font-medium uppercase tracking-wide text-info">
        <span class="size-1.5 animate-pulse rounded-full bg-info motion-reduce:animate-none" aria-hidden="true" />
        Live
      </span>
      <p class="min-w-48 flex-1 text-xs text-muted">
        <template v-if="syncingSites.length">
          Syncing {{ syncingSites.length }} of {{ liveSites.length }} {{ sitesWord(liveSites.length) }}. Results appear as each sync finishes.
        </template>
        <template v-else>
          Waiting to start the first sync for {{ queuedSites.length }} {{ sitesWord(queuedSites.length) }}.
        </template>
      </p>
      <UiIcon
        name="chevron-down"
        class="size-3.5 shrink-0 text-muted transition-transform duration-200"
        :class="{ 'rotate-180': expanded }"
        aria-hidden="true"
      />
    </UiButton>

    <ul v-if="expanded" class="divide-y divide-default/60 border-t border-default/60">
      <li
        v-for="site in liveSites"
        :key="site.siteId"
        class="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1 px-4 py-2.5"
      >
        <UiFavicon :domain="overviewSiteLabel(site)" :size="14" decorative class="shrink-0 rounded bg-default p-px" />
        <div class="min-w-0">
          <NuxtLink :to="siteRoute(site)" class="block min-h-11 truncate py-3 text-xs text-default transition-colors hover:text-primary sm:min-h-0 sm:py-0">
            {{ overviewSiteLabel(site) }}
          </NuxtLink>
          <p v-if="site.syncStatus === 'syncing'" class="truncate text-xs text-muted">
            Syncing Search Console history<span v-if="syncedWindow(site)" class="text-dimmed">, {{ syncedWindow(site) }} synced</span>
          </p>
          <p v-else class="truncate text-xs text-muted">
            Waiting to start the first sync
          </p>
          <div class="mt-1 h-0.5 w-20 rounded-full bg-info/50 motion-safe:animate-pulse" aria-hidden="true" />
        </div>
      </li>
    </ul>
  </div>
</template>
