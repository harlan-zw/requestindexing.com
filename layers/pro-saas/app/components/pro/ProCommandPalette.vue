<script setup lang="ts">
// Ported from nuxtseo.com's `ProCommandPalette.vue`, cut to what this app
// offers: no AI handoff, no recents, no groups. Search Indexing is the one
// fleet concern page so far.
//
// Per-Site entries come from the Site nav manifest rather than a hand-kept
// list, so the palette cannot offer a surface the sidebar does not have, and a
// flagged row (Bing) stays hidden in both while its flag is off.
import type { CommandPaletteItem } from '@nuxt/ui'
import type { ProNavSite } from '#layers/pro-shell/app/composables/useProSingleSiteNav'
import { computed, ref } from 'vue'
import { UDashboardSearch, UiFavicon, UiNavIcon } from '#components'
import { expandProSiteRoute, proSiteFeatureManifest, proSiteFeatureNavOrder, readProFeatureFlags } from '#layers/pro-shell/shared/manifest'
import { proNavGroups } from '#layers/pro-shell/shared/nav-groups'
import { useProCommandPalette } from '../../composables/useProCommandPalette'

const { sites } = defineProps<{ sites: ProNavSite[] }>()

const { open } = useProCommandPalette()
const searchTerm = ref('')
const flags = computed(() => readProFeatureFlags(useRuntimeConfig().public))

const fuseOptions = { keys: ['label', 'suffix', 'keywords'], threshold: 0.3 }

type SiteCommandPaletteItem = CommandPaletteItem & { faviconDomain?: string }

function hostnameOf(value: string): string {
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`).hostname
  }
  catch {
    return value
  }
}

const groupLabels = new Map(proNavGroups.map(group => [group.id, group.label]))

const navItems = computed<SiteCommandPaletteItem[]>(() => {
  const items: SiteCommandPaletteItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'home', to: '/pro/dashboard' },
    { id: 'across-indexing', label: 'Search Indexing (across sites)', icon: 'database', to: '/pro/dashboard/indexing', keywords: ['search indexing', 'coverage', 'indexed', 'portfolio'] },
    { id: 'manage-sites', label: 'Manage Sites', icon: 'settings', to: '/pro/dashboard/sites', keywords: ['remove', 'sites'] },
    { id: 'connect-site', label: 'Connect a Site', icon: 'add', to: '/pro/dashboard/sites/connect', keywords: ['search console', 'gsc', 'properties'] },
    { id: 'team-settings', label: 'Team settings', icon: 'settings', to: '/pro/dashboard/team/settings', keywords: ['workspace'] },
    { id: 'members', label: 'Members', icon: 'users', to: '/pro/dashboard/team/members', keywords: ['invite', 'team'] },
    { id: 'account', label: 'Account', icon: 'user', to: '/pro/dashboard/account' },
    { id: 'developers', label: 'Developers', icon: 'terminal', to: '/pro/dashboard/developers', keywords: ['api', 'mcp', 'cli', 'gscdump'] },
  ]

  for (const site of sites) {
    const ref = site.publicId ?? site.siteId ?? site.id
    if (!ref)
      continue
    const raw = site.domain || site.url || site.property || ''
    const domain = raw ? hostnameOf(raw) : ''
    const name = site.name || domain || 'Site'
    const siteKeywords = [name, domain].filter(Boolean)
    const identity = { faviconDomain: domain }

    items.push({ id: `${ref}-overview`, label: `${name}: Overview`, ...identity, to: `/pro/dashboard/sites/${ref}`, keywords: [...siteKeywords, 'overview'] })

    for (const featureId of proSiteFeatureNavOrder) {
      const entry = proSiteFeatureManifest[featureId]
      if ('flag' in entry && entry.flag && !flags.value[entry.flag])
        continue
      const group = entry.group === 'footer' ? null : groupLabels.get(entry.group)
      // A group's Overview row is the group itself: "Indexing", not "Indexing: Overview".
      const page = group ? (entry.label === 'Overview' ? group : `${group}: ${entry.label}`) : entry.label
      items.push({
        id: `${ref}-${featureId}`,
        label: `${name}: ${page}`,
        ...identity,
        to: expandProSiteRoute(entry.route, ref),
        keywords: [...siteKeywords, page.toLowerCase()],
      })
    }
  }

  return items
})

const groups = computed(() => [{ id: 'navigation', label: 'Navigation', items: navItems.value }])
</script>

<template>
  <UDashboardSearch
    v-model:open="open"
    v-model:search-term="searchTerm"
    size="sm"
    :groups="groups"
    :fuse="{ fuseOptions }"
    placeholder="Search pages and sites…"
  >
    <template #item-leading="{ item }">
      <UiFavicon
        v-if="(item as SiteCommandPaletteItem).faviconDomain"
        :domain="(item as SiteCommandPaletteItem).faviconDomain!"
        :size="14"
        decorative
        class="shrink-0"
      />
      <UiNavIcon v-else-if="item.icon" :icon="item.icon" />
    </template>
  </UDashboardSearch>
</template>
