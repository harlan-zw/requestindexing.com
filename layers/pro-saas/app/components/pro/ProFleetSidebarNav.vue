<script setup lang="ts">
// The fleet sidebar body: Team destinations, the Site roster, then the rail.
// Adapted from nuxtseo.com's `ProDashboardSidebarNav.vue`, minus the group
// switcher, the monitoring rail and the Reports/Alerts/Chat rows. Account lives
// in the user menu, as upstream; the rail keeps Manage Sites.
//
// `ProShellSidebarNav` draws the manifest; the roster sits in its `#middle`
// slot. Rendered only when the resolved scope is more than one Site. At n=1
// the layout mounts `ProSingleSiteSidebarNav` instead, so a one-Site account
// never sees a list of one and the sidebar never flips when crossing shells.
import type { UiNavLink } from '@nuxtseo/design-system/app/shared/nav'
import type { ProShellNavManifest } from '@nuxtseo/pro-shell/shared/nav'
import type { ProNavSite } from '#layers/pro-features/app/composables/useProSingleSiteNav'
import ProShellSidebarNav from '@nuxtseo/pro-shell/app/components/ProShellSidebarNav.vue'
import { useProShellRoute } from '@nuxtseo/pro-shell/app/composables/useProShellRoute'
import { pathNavItems } from '@nuxtseo/pro-shell/shared/nav'
import { computed } from 'vue'
import { NuxtLink, UiFavicon, UiIcon, UiNavList, UiSkeleton } from '#components'
import { useProNavSetupBadges } from '#layers/pro-features/app/composables/useProNavSetupBadges'
import { integrationsRailLinks } from '#layers/pro-features/app/utils/integrations-pending'
import { HELD_LABEL, HELD_TITLE } from '#layers/pro-gsc/shared/entitlement-copy'

const { sites, loading = false } = defineProps<{
  sites: ProNavSite[]
  loading?: boolean
}>()

const emit = defineEmits<{ navigate: [] }>()

const resolveRoute = useProShellRoute()
const dashboardTo = resolveRoute('dashboard') ?? '/pro/dashboard'
const sitesTo = resolveRoute('sites') ?? '/pro/dashboard/sites'
const addSiteTo = resolveRoute('addSite')

// Integrations joins the rail only while one is pending. It always lives in
// the user menu, as upstream.
const { integrationsSetup } = useProNavSetupBadges()

const manifest = computed<ProShellNavManifest>(() => ({
  pinnedLabel: 'Team',
  pinned: [
    { id: 'dashboard', label: 'Dashboard', icon: 'home', target: { _tag: 'Route', name: 'dashboard' }, active: (p: string) => p === dashboardTo },
    // Active on every fleet Indexing tab: Overview, Issues and Changes.
    { id: 'indexing', label: 'Indexing', icon: 'database', target: { _tag: 'Path', to: '/pro/dashboard/indexing' }, active: (p: string) => p === '/pro/dashboard/indexing' || p.startsWith('/pro/dashboard/indexing/') },
  ],
  railLabel: 'Manage',
  rail: [
    ...pathNavItems(integrationsRailLinks(integrationsSetup.value)),
    { id: 'sites', label: 'Manage Sites', icon: 'settings', target: { _tag: 'Route', name: 'sites' }, active: (p: string) => p === sitesTo },
  ],
}))

function hostnameOf(value: string): string {
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).hostname
  }
  catch {
    return value
  }
}

interface FleetSiteLink extends UiNavLink { domain: string }

const siteLinks = computed<FleetSiteLink[]>(() => sites.map((site) => {
  const ref = site.publicId ?? site.siteId ?? site.id ?? ''
  const raw = site.domain || site.url || site.property || ''
  const domain = raw ? hostnameOf(raw) : ''
  const to = resolveRoute('siteOverview', { site: ref }) ?? `/pro/dashboard/sites/${ref}`
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
  <ProShellSidebarNav :manifest="manifest" @navigate="emit('navigate')">
    <template #middle>
      <div>
        <div class="mb-0.5 flex items-center justify-between px-1 lg:mb-1.5">
          <span class="text-sm font-medium tracking-wide text-dimmed lg:text-xs dark:text-muted">Sites</span>
          <NuxtLink
            v-if="addSiteTo"
            :to="addSiteTo"
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
          No Sites yet.
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
    </template>
  </ProShellSidebarNav>
</template>
