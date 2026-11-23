<script setup lang="ts">
import type { SiteFleetRow } from '~~/layers/core/app/types'
import type { LiveWorkLoad } from '#layers/pro-saas/shared/live-work'
import { useDocumentVisibility, useEventBus, useIntervalFn, useLocalStorage, watchThrottled } from '@vueuse/core'
import { computed, ref, shallowRef, watch } from 'vue'
import { SITES_DATA_KEY } from '~~/layers/core/app/composables/fetch'
import { siteLabel } from '~~/layers/core/app/utils/site-format'
import { refreshNuxtData, useNuxtApp, useNuxtData, useUserSession } from '#imports'
import { holdLiveWork, liveWorkRefreshMs, nextLiveWorkDismissed, readLiveWork, resolveLiveWorkSurface, SITE_ACTIVITY_EVENT, summarizeLiveWork } from '#layers/pro-saas/shared/live-work'

const { siteRef, inHeader } = defineProps<{ siteRef: string | null, inHeader: boolean }>()
const expanded = ref(false)
const { data: roster } = useNuxtData<{ sites: SiteFleetRow[], activityUnavailable?: boolean }>(SITES_DATA_KEY)
const nuxtApp = useNuxtApp()
const { user } = useUserSession()

// The reading the surfaces trust: a failed roster read keeps the last one.
const reading = computed(() => readLiveWork(roster.value?.sites, !!nuxtApp.payload._errors[SITES_DATA_KEY] || !!roster.value?.activityUnavailable, siteRef))
const load = shallowRef<LiveWorkLoad<SiteFleetRow>>(reading.value)
watch(reading, (next) => {
  load.value = holdLiveWork(load.value, next, roster.value?.sites)
})

// A per-viewer convenience, kept per Team so one Team's idle roster cannot
// reopen another's. If storage is unavailable the bar simply shows.
const closedByTeam = useLocalStorage<Record<string, boolean>>('request-indexing:live-work:dismissed', {}, { initOnMounted: true })
const dismissalKey = computed(() => {
  const team = user.value?.currentTeamId
  if (team == null)
    return null
  return siteRef ? `${team}:${siteRef}` : String(team)
})
const dismissed = computed({
  get: () => {
    const id = dismissalKey.value
    return id != null && closedByTeam.value?.[String(id)] === true
  },
  set: (closed: boolean) => {
    const id = dismissalKey.value
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

const icons = computed(() => work.value.map(({ site }) => ({ domain: site.property, label: siteLabel(site) })))
const single = computed(() => work.value.length === 1 ? work.value[0] : null)
const first = computed(() => single.value?.activities[0])
const revision = ref(0)
useEventBus<ReadonlySet<string>>(SITE_ACTIVITY_EVENT).on((ids) => {
  if (roster.value?.sites.some(site => (!siteRef || site.siteId === siteRef) && site.gscdumpSiteId && ids.has(site.gscdumpSiteId)))
    revision.value++
})
watchThrottled(revision, () => {
  if (visibility.value === 'visible')
    void refreshNuxtData(SITES_DATA_KEY)
}, { throttle: 5_000, trailing: true })
watch(visibility, (current) => {
  if (current === 'visible')
    void refreshNuxtData(SITES_DATA_KEY)
})
watch(surface, () => {
  expanded.value = false
})
</script>

<template>
  <span role="status" class="sr-only">{{ summary }}</span>
  <div v-if="surface === 'bar'" data-live-work="bar" class="mb-5 flex w-full min-w-0 items-start gap-1">
    <div class="min-w-0 flex-1 overflow-hidden rounded-xl border border-default bg-default text-default">
      <button type="button" class="flex min-h-12 w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-start hover:bg-elevated/40 focus-visible:outline-primary" :aria-expanded="expanded" @click="expanded = !expanded">
        <UiFaviconStack :sites="icons" :max="3" size="xs" />
        <span class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">{{ single ? siteLabel(single.site) : `${work.length} Sites` }}</span>
        <span v-if="first" class="flex max-w-full items-center gap-2 text-sm text-default">
          <span class="size-1.5 shrink-0 rounded-full bg-primary motion-safe:animate-pulse" aria-hidden="true" />
          {{ first.label }}
          <span v-if="first.percent != null" class="font-mono tabular-nums">{{ first.percent }}%</span>
          <span v-if="single && single.activities.length > 1" class="text-muted">+{{ single.activities.length - 1 }}</span>
        </span>
        <span v-else class="min-w-0 truncate text-sm text-muted">{{ summary }}</span>
        <UiIcon name="chevron-down" class="size-4 shrink-0 text-muted transition-transform motion-reduce:transition-none" :class="{ 'rotate-180': expanded }" aria-hidden="true" />
      </button>
      <div v-if="expanded" class="border-t border-default">
        <ProLiveWorkDetails :work="work" :show-names="!single" />
      </div>
    </div>
    <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-x" class="min-h-11" aria-label="Hide progress" @click="dismissed = true" />
  </div>
  <Teleport v-else-if="surface === 'pill'" to="#site-activity-control" :disabled="!inHeader">
    <div data-live-work="pill" :class="!inHeader && 'mb-3'">
      <UPopover :content="{ side: 'bottom', align: 'end', sideOffset: 8 }">
        <UButton color="neutral" variant="outline" size="sm" class="max-w-[min(18rem,50vw)] rounded-full bg-default">
          <UiFaviconStack :sites="icons" :max="3" size="xs" />
          <span class="truncate">{{ summary }}</span>
        </UButton>
        <template #content>
          <div class="max-h-[70dvh] w-[min(28rem,calc(100vw-2rem))] overflow-y-auto">
            <ProLiveWorkDetails :work="work" show-names />
            <UButton v-if="canShowBar" color="neutral" variant="ghost" size="sm" class="m-2" label="Show at top" @click="dismissed = false" />
          </div>
        </template>
      </UPopover>
    </div>
  </Teleport>
</template>
