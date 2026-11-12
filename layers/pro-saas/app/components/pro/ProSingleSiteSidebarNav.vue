<script setup lang="ts">
// The single-Site sidebar body, rendered by the desktop rail AND the mobile
// drawer so the two cannot diverge. Ported from nuxtseo.com's
// `ProSingleSiteSidebarNav.vue`: the pro-features registry builds the rows,
// and `ProShellSidebarNav` draws them.
//
// The favicon plus site-name header row IS the Site landing link, which is why
// `useProSingleSiteNav` suppresses the synthesized Overview row.
import type { ProNavSite } from '#layers/pro-features/app/composables/useProSingleSiteNav'
import ProShellSidebarNav from '@nuxtseo/pro-shell/app/components/ProShellSidebarNav.vue'
import { useRoute } from 'nuxt/app'
import { computed } from 'vue'
import { NuxtLink, UiFavicon } from '#components'
import { useProSingleSiteNav } from '#layers/pro-features/app/composables/useProSingleSiteNav'
import { gatedSiteNavItems, gatedSiteNavSections } from '../../utils/pro-shell-nav'

const { site } = defineProps<{ site: ProNavSite }>()

const emit = defineEmits<{ navigate: [] }>()
function onNavigate() {
  emit('navigate')
}

const route = useRoute()
const nav = useProSingleSiteNav(() => site)
const headerActive = computed(() => route.path === nav.siteTo.value)
const manifest = computed(() => ({
  pinnedLabel: 'Site',
  pinned: gatedSiteNavItems(nav.pinnedLinks.value),
  sections: gatedSiteNavSections(nav.sections.value),
  railLabel: 'Site settings',
  rail: gatedSiteNavItems(nav.railLinks.value),
}))
</script>

<template>
  <ProShellSidebarNav :manifest="manifest" @navigate="onNavigate">
    <template #header>
      <div class="mb-0.5 flex items-center justify-between px-1 lg:mb-2">
        <!-- The header IS the Site landing row, so it renders like one: the
             same raised active surface every UiNavList row gets. -->
        <NuxtLink
          :to="nav.siteTo.value"
          class="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:min-h-0"
          :class="headerActive
            ? 'bg-elevated text-highlighted'
            : 'text-highlighted hover:bg-elevated dark:text-toned dark:hover:text-highlighted'"
          :style="headerActive ? { boxShadow: 'var(--elevation-raised)', backgroundImage: 'var(--surface-raised)' } : undefined"
          :aria-current="headerActive ? 'page' : undefined"
          @click="onNavigate"
        >
          <UiFavicon :domain="nav.siteDomain.value" :size="13" decorative class="shrink-0" />
          <span class="truncate">{{ nav.siteLabel.value }}</span>
        </NuxtLink>
      </div>
    </template>
  </ProShellSidebarNav>
</template>
