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
import ProShellSidebarSiteSwitch from '@nuxtseo/pro-shell/app/components/ProShellSidebarSiteSwitch.vue'
import { useProShellRoute } from '@nuxtseo/pro-shell/app/composables/useProShellRoute'
import { useProShellSiteMenu } from '@nuxtseo/pro-shell/app/composables/useProShellSiteMenu'
import { useRoute } from 'nuxt/app'
import { computed } from 'vue'
import { NuxtLink, UiFavicon, UiIcon, UiTooltip } from '#components'
import { useProSingleSiteNav } from '#layers/pro-features/app/composables/useProSingleSiteNav'
import { gatedSiteNavItems, gatedSiteNavSections } from '../../utils/pro-shell-nav'

const { site } = defineProps<{ site: ProNavSite }>()

const emit = defineEmits<{ navigate: [] }>()
function onNavigate() {
  emit('navigate')
}

const route = useRoute()
const nav = useProSingleSiteNav(() => site)
const { activeCount, copy } = useProShellSiteMenu()
const resolveRoute = useProShellRoute()
const allSitesTo = computed(() => {
  const to = resolveRoute('dashboard')
  return activeCount.value > 1 && to && route.path.replace(/\/$/, '') !== to ? to : null
})
const addSiteTo = resolveRoute('addSite')
const switchActions = computed(() => addSiteTo ? [{ label: 'Connect a Site', icon: 'add', to: addSiteTo }] : [])
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
      <div class="mb-2 flex items-center rounded-md border border-default bg-default">
        <UiTooltip v-if="allSitesTo" :text="copy.allSites" side="bottom" trigger-as="child">
          <NuxtLink
            :to="allSitesTo"
            :aria-label="copy.allSites"
            class="flex size-11 shrink-0 items-center justify-center rounded-l-[5px] border-r border-default text-dimmed transition-colors hover:bg-elevated hover:text-default focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:h-7 lg:w-6"
            @click="onNavigate"
          >
            <UiIcon name="back" class="size-4" aria-hidden="true" />
          </NuxtLink>
        </UiTooltip>
        <NuxtLink
          :to="nav.siteTo.value"
          class="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2 py-1 text-sm font-medium transition-colors hover:bg-elevated focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:h-7 lg:min-h-0"
          :class="[
            !allSitesTo ? 'rounded-l-[5px]' : undefined,
            headerActive
              ? 'text-highlighted'
              : 'text-highlighted dark:text-toned dark:hover:text-highlighted',
          ]"
          :aria-current="headerActive ? 'page' : undefined"
          @click="onNavigate"
        >
          <span class="inline-flex size-[18px] shrink-0 items-center justify-center rounded-[4px] border border-default bg-default">
            <UiFavicon :domain="nav.siteDomain.value" :size="12" decorative class="shrink-0" />
          </span>
          <span class="truncate">{{ nav.siteLabel.value }}</span>
        </NuxtLink>
        <ProShellSidebarSiteSwitch :actions="switchActions" />
      </div>
    </template>
  </ProShellSidebarNav>
</template>
