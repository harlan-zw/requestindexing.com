<script lang="ts" setup>
import type { SiteHoldReason } from '@gscdump/contracts'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { SiteFleetRow } from '~~/layers/core/app/types'
import { fetchSites } from '~~/layers/core/app/composables/fetch'
import { HELD_LABEL, holdMessage } from '#layers/pro-gsc/shared/entitlement-copy'
import ProAbilityGate from '#layers/pro-saas/app/components/pro/team/ProAbilityGate.vue'

// The Site roster, ported from nuxtseo.com's `sites/index.vue` and cut to what
// this app offers: no groups, no pause, no crawl or analytics columns. Each row
// opens the Site, its settings, or removes it.
definePageMeta({
  layout: 'pro-dashboard',
  title: 'Manage Sites',
  icon: 'i-heroicons-cog-6-tooth',
})

const { data, status, error, refresh } = await fetchSites()

const { currentTeamId } = useCurrentWorkspace()
const policy = useTeamPolicy(currentTeamId)
const canManageSites = computed(() => policy.can('manage-sites'))

interface SiteRow {
  siteId: string
  label: string
  url: string
  property: string
  syncLabel: string
  /** gscdump holds the Site before its first import; the sync label does not apply. */
  hold: SiteHoldReason | null
  to: string
}

const SYNC_LABELS: Record<SiteFleetRow['syncStatus'], string> = {
  idle: 'Waiting to sync',
  pending: 'Waiting to sync',
  syncing: 'Syncing',
  synced: 'Synced',
  error: 'Sync failed',
}

const rows = computed<SiteRow[]>(() => (data.value?.sites ?? []).map(site => ({
  siteId: site.siteId,
  label: siteLabel(site),
  url: siteLabel(site),
  property: site.property,
  syncLabel: SYNC_LABELS[site.syncStatus],
  hold: site.hold,
  to: `/pro/dashboard/sites/${site.siteId}`,
})))

const loading = computed(() => status.value === 'pending' && !data.value)

const toast = useToast()
const siteToRemove = ref<SiteRow | null>(null)
const removing = ref(false)
const confirmOpen = computed({
  get: () => siteToRemove.value !== null,
  set: (open: boolean) => {
    if (!open && !removing.value)
      siteToRemove.value = null
  },
})

function rowMenuItems(row: SiteRow): DropdownMenuItem[][] {
  const primary: DropdownMenuItem[] = [
    { label: 'Open', icon: 'i-heroicons-arrow-top-right-on-square', to: row.to },
    { label: 'Settings', icon: 'i-heroicons-cog-6-tooth', to: `${row.to}/settings` },
  ]
  if (!canManageSites.value)
    return [primary]
  return [primary, [{
    label: 'Remove',
    icon: 'i-heroicons-trash',
    color: 'error',
    onSelect: () => { siteToRemove.value = row },
  }]]
}

async function removeSite() {
  const row = siteToRemove.value
  if (!row)
    return
  removing.value = true
  const result = await $fetch<{ success: boolean }>(`/api/sites/${row.siteId}`, { method: 'DELETE' })
    .then(() => ({ _tag: 'Ok' as const }))
    .catch((err: unknown) => ({ _tag: 'Err' as const, error: err }))
  removing.value = false

  if (result._tag === 'Err') {
    const e = result.error as { statusMessage?: string, data?: { statusMessage?: string } }
    toast.add({
      title: 'Site could not be removed',
      description: e?.data?.statusMessage || e?.statusMessage || 'Try again in a moment.',
      color: 'error',
    })
    return
  }

  siteToRemove.value = null
  toast.add({ title: 'Site removed', description: `${row.label} is no longer connected.`, color: 'success' })
  // The sidebar reads the same `sites` key, so one refresh updates both.
  await refresh()
}
</script>

<template>
  <div class="space-y-5">
    <UiAlert
      v-if="error"
      status="error"
      icon="caution"
      title="Your Sites could not be loaded"
    >
      <template #action>
        <UiButton size="xs" purpose="secondary" @click="refresh()">
          Retry
        </UiButton>
      </template>
    </UiAlert>

    <div v-if="loading" class="space-y-2" aria-label="Loading Sites">
      <UiSkeleton v-for="index in 4" :key="index" class="h-14 w-full rounded-lg" />
    </div>

    <UiEmptyState
      v-else-if="!rows.length && !error"
      icon="globe"
      title="No Sites yet"
      description="Connect a Site from Google Search Console to see its indexing status and search data."
    >
      <UiButton purpose="cta" icon="add" to="/pro/dashboard/sites/connect">
        Connect a Site
      </UiButton>
    </UiEmptyState>

    <div v-else-if="rows.length" class="overflow-hidden rounded-xl border border-default bg-default">
      <div class="flex min-h-16 flex-wrap items-center gap-3 border-b border-default bg-elevated/60 px-5 py-3.5">
        <span class="text-base font-semibold text-highlighted">All Sites</span>
        <span class="text-xs text-dimmed tabular-nums">{{ rows.length }}</span>
        <div class="ml-auto">
          <ProAbilityGate ability="manage-sites">
            <UiButton size="sm" purpose="cta" icon="add" to="/pro/dashboard/sites/connect">
              Connect a Site
            </UiButton>
          </ProAbilityGate>
        </div>
      </div>

      <UiTableShell
        class="hidden md:block"
        table-class="min-w-[640px] table-fixed"
        size="sm"
        row-hover
        label="Connected Sites"
      >
        <template #head>
          <UiTableTh class="w-[40%]">
            Site
          </UiTableTh>
          <UiTableTh class="w-[35%]">
            Search Console property
          </UiTableTh>
          <UiTableTh>
            Sync
          </UiTableTh>
          <UiTableTh class="w-12">
            <span class="sr-only">Actions</span>
          </UiTableTh>
        </template>
        <tr v-for="row in rows" :key="row.siteId">
          <UiTableTd row-header>
            <NuxtLink :to="row.to" class="block min-w-0 rounded py-1 focus-visible:outline-2 focus-visible:outline-primary">
              <ProSiteIdentity :url="row.url" :size="18" />
            </NuxtLink>
          </UiTableTd>
          <UiTableTd>
            <span class="block truncate font-mono text-xs text-muted">{{ row.property }}</span>
          </UiTableTd>
          <UiTableTd>
            <UTooltip v-if="row.hold" :text="holdMessage(row.hold)">
              <UBadge color="warning" variant="subtle" :label="HELD_LABEL" />
            </UTooltip>
            <span v-else class="text-sm">{{ row.syncLabel }}</span>
          </UiTableTd>
          <UiTableTd>
            <UDropdownMenu :items="rowMenuItems(row)" :content="{ align: 'end', sideOffset: 6 }">
              <UiButton purpose="quiet" size="xs" icon="more-horizontal" :aria-label="`Actions for ${row.label}`" />
            </UDropdownMenu>
          </UiTableTd>
        </tr>
      </UiTableShell>

      <ul class="divide-y divide-default md:hidden">
        <li v-for="row in rows" :key="row.siteId" class="flex min-h-16 items-center gap-2 px-4 py-3">
          <NuxtLink :to="row.to" class="min-w-0 flex-1">
            <ProSiteIdentity :url="row.url" :size="18" />
            <span v-if="row.hold" class="mt-1 block pl-7 text-xs text-muted">
              <UBadge color="warning" variant="subtle" size="sm" :label="HELD_LABEL" class="mr-1" />{{ holdMessage(row.hold) }}
            </span>
            <span v-else class="mt-1 block pl-7 text-xs text-muted">{{ row.syncLabel }}</span>
          </NuxtLink>
          <UDropdownMenu :items="rowMenuItems(row)" :content="{ align: 'end', sideOffset: 6 }">
            <UiButton purpose="quiet" icon="more-horizontal" class="min-h-11 min-w-11" :aria-label="`Actions for ${row.label}`" />
          </UDropdownMenu>
        </li>
      </ul>
    </div>

    <UModal
      v-model:open="confirmOpen"
      title="Remove this Site?"
      :description="`${siteToRemove?.label ?? 'This Site'} and everything archived for it will be deleted.`"
    >
      <template #body>
        <p class="text-sm text-muted">
          Removing a Site deletes its archived Search Console data and its indexing history. You can connect it again later, but the archive does not come back.
        </p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UiButton purpose="quiet" :disabled="removing" @click="confirmOpen = false">
            Cancel
          </UiButton>
          <UiButton purpose="danger" :loading="removing" @click="removeSite()">
            Remove Site
          </UiButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
