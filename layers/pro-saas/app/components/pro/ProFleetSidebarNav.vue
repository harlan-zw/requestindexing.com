<script setup lang="ts">
// The fleet sidebar body: workspace destinations, then the Site roster.
// Adapted from nuxtseo.com's `ProDashboardSidebarNav.vue`, minus the group
// switcher, the monitoring rail and the Reports/Alerts/Chat rows. Account lives
// in the user menu, as upstream; the rail keeps Manage Sites.
//
// Rendered only when the resolved scope is more than one Site. At n=1 the
// layout mounts `ProSingleSiteSidebarNav` instead, so a one-Site account never
// sees a list of one and the sidebar never flips when crossing shells.
import type { UiNavLink } from '#layers/design-system/app/shared/nav'
import type { ProNavSite } from '#layers/pro-shell/app/composables/useProSingleSiteNav'
import { computed } from 'vue'
import { NuxtLink, UiFavicon, UiIcon, UiNavList, UiSkeleton } from '#components'
import { HELD_LABEL, HELD_TITLE } from '#layers/pro-gsc/shared/entitlement-copy'
import { useProNavSetupBadges } from '#layers/pro-shell/app/composables/useProNavSetupBadges'
import { integrationsRailLinks } from '#layers/pro-shell/app/utils/integrations-pending'

const { sites, loading = false } = defineProps<{
  sites: ProNavSite[]
  loading?: boolean
}>()

const emit = defineEmits<{ navigate: [] }>()

const primaryLinks = computed<UiNavLink[]>(() => [
  { label: 'Dashboard', icon: 'home', to: '/pro/dashboard', active: p => p === '/pro/dashboard' },
  { label: 'Indexing', icon: 'database', to: '/pro/dashboard/web-indexing' },
])

function hostnameOf(value: string): string {
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).hostname
  }
  catch {
    return value
  }
}

// Integrations joins the rail only while one is pending. It always lives in
// the user menu, as upstream.
const { integrationsSetup } = useProNavSetupBadges()
const railLinks = computed<UiNavLink[]>(() => [
  ...integrationsRailLinks(integrationsSetup.value),
  { label: 'Manage Sites', icon: 'settings', to: '/pro/dashboard/sites', active: p => p === '/pro/dashboard/sites' },
])

interface FleetSiteLink extends UiNavLink { domain: string }

const siteLinks = computed<FleetSiteLink[]>(() => sites.map((site) => {
  const ref = site.publicId ?? site.siteId ?? site.id ?? ''
  const raw = site.domain || site.url || site.property || ''
  const domain = raw ? hostnameOf(raw) : ''
  const to = `/pro/dashboard/sites/${ref}`
  return {
    label: site.name || domain || 'Site',
    to,
    domain,
    ...(site.hold ? { badge: HELD_LABEL, badgeColor: 'warning' as const, title: HELD_TITLE } : {}),
    active: (path: string) => path === to || path.startsWith(`${to}/`),
  }
}))
</script>

<template>
  <div class="flex min-h-full flex-col gap-3 lg:gap-5">
    <UiNavList
      variant="sidebar"
      tone="default"
      label="Workspace"
      :links="primaryLinks"
      @click="emit('navigate')"
    />

    <div>
      <div class="mb-0.5 flex items-center justify-between px-1 lg:mb-1.5">
        <span class="text-sm font-medium tracking-wide text-dimmed lg:text-xs dark:text-muted">Sites</span>
        <NuxtLink
          to="/pro/dashboard/sites/connect"
          aria-label="Connect a Site"
          class="flex size-11 items-center justify-center rounded text-dimmed transition-colors hover:bg-elevated hover:text-highlighted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:size-6"
          @click="emit('navigate')"
        >
          <UiIcon name="add" class="size-3.5" aria-hidden="true" />
        </NuxtLink>
      </div>
      <!-- A roster that has not arrived yet is three rows of nothing, not an
           empty list: an empty list reads as "you have no sites". -->
      <div v-if="loading && !siteLinks.length" class="space-y-1 px-1" aria-hidden="true">
        <UiSkeleton v-for="n in 3" :key="n" type="block" class="h-7 w-full rounded" />
      </div>
      <p v-else-if="!siteLinks.length" class="px-1 text-sm text-muted">
        No sites yet.
      </p>
      <UiNavList
        v-else
        variant="sidebar"
        tone="default"
        label="Sites"
        :links="siteLinks"
        @click="emit('navigate')"
      >
        <template #icon="{ link }">
          <UiFavicon :domain="(link as FleetSiteLink).domain" :size="13" decorative class="shrink-0" />
        </template>
      </UiNavList>
    </div>

    <div class="mt-auto border-t border-default pt-2 lg:pt-3">
      <UiNavList
        variant="sidebar"
        label="Manage"
        :links="railLinks"
        @click="emit('navigate')"
      />
    </div>
  </div>
</template>
