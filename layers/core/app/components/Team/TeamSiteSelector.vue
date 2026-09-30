<script setup lang="ts">
import type { SitePreview, SitesPreview } from '~~/layers/core/app/types'
import { useHumanFriendlyNumber } from '~~/layers/design-system/app/composables/formatting'

// No cap here. Picking moves Sites the caller already has onto the Team, so it
// creates no Site. gscdump's Free allowance counts a Site when it registers.
const props = defineProps<{
  sites: SitesPreview
  modelValue: string[]
}>()

const emits = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const data = ref<SitesPreview>(props.sites)
// const { user, fetch } = useUserSession()

// const isPending = computed(() => !props.sites.length)

const selected = ref<string[]>([...props.modelValue])

watch(selected, () => {
  emits('update:modelValue', selected.value)
})

const toast = useToast()
function select(row: SitePreview) {
  if (!selected.value.includes(row.siteId))
    selected.value.push(row.siteId)
  else
    selected.value = selected.value.filter(s => s !== row.siteId)
}

// `property` is the Search Console identifier and the only field that carries
// the `sc-domain:` prefix; `domain` is a bare host derived from it. Reading
// `domain` labelled every domain property "URL Property".
function isDomainProperty(site: { domain?: string | null, property?: string | null }): boolean {
  return (site.property || site.domain || '').startsWith('sc-domain:')
}

const sitePage = ref(1)
const pageCount = 6

const siteRows = computed<SitePreview[]>(() => {
  return (data.value || []).map((site) => {
    const sitemapWarningsCount = site.sitemaps?.reduce((acc, curr) => acc + (Number(curr.warnings) || 0), 0)
    const sitemapErrorsCount = site.sitemaps?.reduce((acc, curr) => acc + (Number(curr.errors) || 0), 0)
    return {
      ...site,
      sitemapWarningsCount,
      sitemapErrorsCount,
    }
  }).sort((a, b) => b.pageCount30Day - a.pageCount30Day)
})

const paginatedSites = computed<SitePreview[]>(() => {
  return siteRows.value.slice((sitePage.value - 1) * pageCount, (sitePage.value) * pageCount)
})

onMounted(() => {
  // watch(isPending, () => {
  //   if (!isPending.value && siteRows.value.length) {
  //     if (props.modelValue)
  //       selected.value = siteRows.value.filter(s => props.modelValue.includes(s.siteId))
  //     else
  //       selected.value = klona(siteRows.value).slice(0, Math.min(siteRows.value.length, maxSites))
  //   }
  // })
  if (!selected.value?.length)
    selected.value = siteRows.value.map(s => s.siteId).filter(id => props.modelValue.includes(id))
})

// const tableSelectedRows = computed(() => {
//   return selected.value.map(id => siteRows.value.find(s => s.siteId === id))
// })

const isSyncing = ref(false)
const nuxtApp = useNuxtApp()
const sideEffects: (() => void)[] = []
async function resync() {
  // we need to wait for the ws to update the sites
  interface SyncContext { syncedSites: number, createdSites: number }
  const hook = nuxtApp.hooks.hook as unknown as (name: 'app:users:syncGscSites', callback: (ctx: SyncContext) => void) => () => void
  sideEffects.push(hook('app:users:syncGscSites', (ctx) => {
    isSyncing.value = false
    toast.add({ title: 'Google Search Console Synced', description: `Found ${ctx.syncedSites} existing sites and ${ctx.createdSites} new sites.`, color: 'success' })
    sideEffects.forEach(fn => fn())
  }))
  isSyncing.value = true
  await $fetch('/api/user/sync-gsc')
}
onBeforeUnmount(() => {
  sideEffects.forEach(fn => fn())
})
</script>

<template>
  <div>
    <slot />
    <!-- The counter and the Resync action used to sit below the grid they
         describe, at opposite edges of the page. They lead the grid now. -->
    <div class="mb-4 flex flex-wrap items-end justify-between gap-4">
      <div class="min-w-[200px]">
        <div class="text-sm text-muted">
          Selected Sites
        </div>
        <div class="text-lg font-bold tabular-nums text-highlighted">
          {{ selected.length }}
        </div>
      </div>
      <div class="max-w-[240px]">
        <UButton :loading="isSyncing" type="button" class="mb-1 min-h-10" icon="i-heroicons-arrow-path" @click="resync">
          Resync
        </UButton>
        <div class="text-xs text-muted">
          Made changes to Google Search Console? Resync your data.
        </div>
      </div>
    </div>

    <div v-if="siteRows.length" class="mb-5">
      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <!-- A `<label>`, not a button. `UCheckbox` renders its own `<button>`,
             and a button inside a button is invalid HTML: the parser closed the
             outer one and hoisted the rest of the card out to `<body>`, which
             broke hydration on this page. The wrapper also carried its own
             `@click="select(site)"`, so a click that landed on the checkbox
             fired `select` twice and cancelled itself out. A label toggles the
             checkbox natively, once, and stays keyboard reachable. -->
        <label
          v-for="(site, key) in paginatedSites"
          :key="key"
          class="flex cursor-pointer items-center gap-2 rounded-md p-3 text-left transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary"
          :class="selected.some(s => s === site.siteId) ? 'bg-primary/10' : 'bg-elevated/50 hover:bg-elevated'"
        >
          <UCheckbox color="primary" :model-value="selected.some(s => s === site.siteId)" @update:model-value="select(site)" />
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <SiteFavicon :site="site" />
              <div class="truncate font-bold text-highlighted">
                {{ siteLabel(site) }}
              </div>
            </div>
            <div class="flex items-center gap-2 text-xs text-muted">
              <div>
                {{ isDomainProperty(site) ? 'Domain' : 'URL' }} Property
              </div>
              <UiTooltip v-if="!site.pageCount30Day" text="Page count is still syncing from Google Search Console">
                <span class="flex items-center gap-1">
                  <UIcon name="i-ph-arrows-clockwise-duotone" class="size-4 animate-spin" />
                  <span>Syncing</span>
                </span>
              </UiTooltip>
              <div v-else>
                {{ useHumanFriendlyNumber(site.pageCount30Day) }} {{ site.pageCount30Day === 1 ? 'Page' : 'Pages' }}
              </div>
            </div>
          </div>
        </label>
      </div>
      <div v-if="siteRows.length > pageCount" class="mt-7 flex items-center justify-between border-t border-default px-3 py-5">
        <UPagination v-model:page="sitePage" :items-per-page="pageCount" :total="siteRows.length" :show-edges="false" />
        <div class="text-base text-muted tabular-nums">
          {{ siteRows.length }} total
        </div>
      </div>
    </div>
  </div>
</template>
