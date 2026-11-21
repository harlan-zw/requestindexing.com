<script setup lang="ts">
import type { SiteFleetRow } from '~~/layers/core/app/types'
import type { LiveWork, LiveWorkLoad } from '#layers/pro-saas/shared/live-work'
import { useDocumentVisibility, useIntervalFn, useLocalStorage } from '@vueuse/core'
import { computed, shallowRef, watch } from 'vue'
import { SITES_DATA_KEY } from '~~/layers/core/app/composables/fetch'
import { refreshNuxtData, useNuxtApp, useNuxtData, useUserSession } from '#imports'
import { holdLiveWork, liveWorkRefreshMs, nextLiveWorkDismissed, readLiveWork, resolveLiveWorkSurface, summarizeLiveWork } from '#layers/pro-saas/shared/live-work'
import { SITE_SYNC_LABELS } from '#layers/pro-saas/shared/site-sync'

// The live work bar and its pill (DESIGN.md "Live work bar"): a Site's first
// Search Console sync, shown above every dashboard page until it ends. Rows,
// words and rules come from `live-work.ts`.
const { data: roster } = useNuxtData<{ sites: SiteFleetRow[] }>(SITES_DATA_KEY)
const nuxtApp = useNuxtApp()
const { user } = useUserSession()

// The reading the surfaces trust: a failed roster read keeps the last one.
const reading = computed(() => readLiveWork(roster.value?.sites, !!nuxtApp.payload._errors[SITES_DATA_KEY]))
const load = shallowRef<LiveWorkLoad<SiteFleetRow>>(reading.value)
watch(reading, (next) => {
  load.value = holdLiveWork(load.value, next)
})

// A per-viewer convenience, kept per Team so one Team's idle roster cannot
// reopen another's. If storage is unavailable the bar simply shows.
const closedByTeam = useLocalStorage<Record<string, boolean>>('request-indexing:live-work:dismissed', {}, { initOnMounted: true })
const dismissed = computed({
  get: () => {
    const id = user.value?.currentTeamId
    return id != null && closedByTeam.value?.[String(id)] === true
  },
  set: (closed: boolean) => {
    const id = user.value?.currentTeamId
    if (id == null)
      return
    const next = { ...closedByTeam.value }
    if (closed)
      next[String(id)] = true
    else
      delete next[String(id)]
    closedByTeam.value = next
  },
})
// Watch the stored value too: it lands after mount, often onto a roster that
// is already idle, and the roster alone would never change to reset it.
watch([load, dismissed], ([nextLoad, closed]) => {
  const next = nextLiveWorkDismissed(closed, nextLoad)
  if (next !== closed)
    dismissed.value = next
})

const surface = computed(() => resolveLiveWorkSurface(load.value, dismissed.value))
const work = computed(() => load.value._tag === 'live' ? load.value.work : [])
const summary = computed(() => summarizeLiveWork(work.value).join(' · '))
const running = computed(() => work.value.some(item => item.phase === 'running'))
const canShowBar = computed(() => dismissed.value && running.value)

// One refresh owner while work is live. Nothing else polls the roster.
const refreshMs = computed(() => liveWorkRefreshMs(load.value))
const visibility = useDocumentVisibility()
const { pause, resume } = useIntervalFn(() => refreshNuxtData(SITES_DATA_KEY), () => refreshMs.value ?? 30_000, { immediate: false })
watch(() => refreshMs.value !== null && visibility.value === 'visible', active => active ? resume() : pause(), { immediate: true })

function siteName(item: LiveWork<SiteFleetRow>): string {
  return item.site.domain ?? item.site.property.replace(/^sc-domain:/, '')
}
</script>

<template>
  <span role="status" class="sr-only">{{ summary }}</span>
  <div v-if="surface === 'bar'" data-live-work="bar" class="mb-6 flex items-start gap-2 rounded-xl border border-default bg-muted/40 px-4 py-3">
    <div class="min-w-0 flex-1 space-y-2">
      <p class="flex items-center gap-2 text-sm text-toned">
        <span class="size-1.5 shrink-0 rounded-full bg-amber-400 motion-safe:animate-pulse" aria-hidden="true" />
        <span class="min-w-0">{{ summary }}</span>
      </p>
      <ul class="space-y-1.5">
        <li v-for="item in work" :key="item.site.siteId" class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-xs sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
          <NuxtLink :to="`/pro/dashboard/sites/${item.site.siteId}`" class="truncate text-default hover:text-primary">
            {{ siteName(item) }}
          </NuxtLink>
          <UProgress v-if="item.phase === 'running'" :model-value="item.percent ?? null" color="warning" size="2xs" class="hidden sm:block" />
          <span v-else class="hidden sm:block" />
          <span class="whitespace-nowrap text-muted tabular-nums">
            {{ item.phase === 'running' ? `${SITE_SYNC_LABELS.syncing}${item.percent != null ? ` · ${item.percent}%` : ''}` : SITE_SYNC_LABELS.pending }}
          </span>
        </li>
      </ul>
    </div>
    <UButton color="neutral" variant="ghost" size="xs" icon="i-lucide-x" aria-label="Hide progress" @click="dismissed = true" />
  </div>
  <div
    v-else-if="surface === 'pill'"
    data-live-work="pill"
    class="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40"
  >
    <UPopover :content="{ side: 'top', align: 'end', sideOffset: 8 }">
      <UButton color="neutral" variant="outline" size="sm" class="max-w-[min(18rem,calc(100vw-2rem))] bg-default shadow-sm">
        <span class="size-1.5 shrink-0 rounded-full bg-amber-400" :class="running && 'motion-safe:animate-pulse'" aria-hidden="true" />
        <span class="truncate">{{ summary }}</span>
      </UButton>
      <template #content>
        <div class="w-[min(26rem,calc(100vw-2rem))] space-y-2 p-3">
          <ul class="space-y-1.5">
            <li v-for="item in work" :key="item.site.siteId" class="flex items-center justify-between gap-3 text-xs">
              <NuxtLink :to="`/pro/dashboard/sites/${item.site.siteId}`" class="truncate text-default hover:text-primary">
                {{ siteName(item) }}
              </NuxtLink>
              <span class="whitespace-nowrap text-muted tabular-nums">
                {{ item.phase === 'running' ? `${SITE_SYNC_LABELS.syncing}${item.percent != null ? ` · ${item.percent}%` : ''}` : SITE_SYNC_LABELS.pending }}
              </span>
            </li>
          </ul>
          <UButton v-if="canShowBar" color="neutral" variant="ghost" size="xs" label="Show at top" @click="dismissed = false" />
        </div>
      </template>
    </UPopover>
  </div>
</template>
