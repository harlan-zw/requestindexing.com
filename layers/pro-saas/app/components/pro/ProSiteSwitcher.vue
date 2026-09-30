<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { ProNavSite } from '#layers/pro-shell/app/composables/useProSingleSiteNav'
import { useRoute } from 'nuxt/app'
import { computed } from 'vue'
import { NuxtLink, UDropdownMenu, UiFavicon, UiIcon, UiTooltip } from '#components'
import { buildSiteSwitchPath, siteSwitchIdentity } from '../../utils/site-switch'

// Ported from nuxtseo.com's `layers/saas/app/components/pro/ProSiteSwitcher.vue`:
// the Site switcher, rendered as the context segment of the page-title
// breadcrumb ("example.com / Search Console") through ProPageHeader's `#crumb`
// slot. The Site name renders at title scale with a chevron and opens a menu
// of Sites. Each item is a real `to` link that keeps the current page, so it
// inherits menu a11y while it navigates. Left out: Site groups, inactive Sites
// and monitoring tiers, which this app does not have.
const { sites, site = null } = defineProps<{
  /** The Sites the account can switch to: the sidebar roster. */
  sites: ProNavSite[]
  /** The Site the layout resolved from the route, for a Site the roster lacks. */
  site?: ProNavSite | null
}>()

const route = useRoute()
const routeParamId = computed(() => typeof route.params.id === 'string' ? route.params.id : '')

const allSites = computed(() => {
  if (!site)
    return sites
  const ref = siteSwitchIdentity(site).ref
  return sites.some(s => siteSwitchIdentity(s).ref === ref) ? sites : [site, ...sites]
})
// Prefer the roster row, as the sidebar does, so the crumb and the sidebar
// name the Site alike. Fall back to the layout's read for a Site the roster
// lacks: an identity crumb that renders nothing is worse than one that cannot
// switch.
const currentSite = computed(() =>
  allSites.value.find(s => siteSwitchIdentity(s).ref === routeParamId.value) ?? site,
)
const current = computed(() => currentSite.value ? siteSwitchIdentity(currentSite.value) : null)
const hasMultiple = computed(() => allSites.value.length > 1)

// Menu items carry a favicon host and an active flag for the leading and
// trailing slots. The active Site links to itself, a path-keeping no-op.
type SiteMenuItem = DropdownMenuItem & { host: string, active: boolean }

const items = computed<SiteMenuItem[]>(() => allSites.value.map((s) => {
  const identity = siteSwitchIdentity(s)
  return {
    label: identity.label,
    host: identity.domain,
    active: identity.ref === current.value?.ref,
    to: buildSiteSwitchPath(route, routeParamId.value, identity.ref),
  }
}))
</script>

<template>
  <div v-if="current" class="flex min-w-0 max-w-52 items-center gap-2 sm:max-w-72">
    <!-- Return to every Site. It sits on the breadcrumb, beside the identity it
         steps out of. Below `sm` it hides: the 44px it frees is the Site
         name's readability, and the drawer's back link carries the same
         destination on a phone. -->
    <UiTooltip v-if="hasMultiple" text="All Sites" side="bottom" trigger-as="child">
      <NuxtLink
        to="/pro/dashboard"
        aria-label="All Sites"
        class="hidden sm:-ml-1 sm:flex size-7 shrink-0 items-center justify-center rounded-md text-dimmed transition-colors hover:bg-elevated hover:text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <UiIcon name="back" class="size-4" aria-hidden="true" />
      </NuxtLink>
    </UiTooltip>

    <UDropdownMenu
      v-if="hasMultiple"
      :items="items"
      :content="{ align: 'start', sideOffset: 6 }"
      :ui="{ content: 'w-60 max-h-80' }"
    >
      <button
        type="button"
        class="group -ml-1 flex min-h-11 min-w-0 max-w-full cursor-pointer items-center gap-1.5 rounded-md px-1 py-0.5 text-highlighted transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :aria-label="`Switch Site, current Site: ${current.label}`"
      >
        <UiFavicon :domain="current.domain" :size="18" decorative class="shrink-0" />
        <span class="truncate text-title" :title="current.label">{{ current.label }}</span>
        <UiIcon name="expand" class="size-5 shrink-0 text-dimmed transition-colors group-hover:text-default" aria-hidden="true" />
      </button>

      <template #item-leading="{ item }">
        <UiFavicon
          v-if="(item as SiteMenuItem).host"
          :domain="(item as SiteMenuItem).host"
          :size="16"
          decorative
          class="shrink-0"
        />
      </template>
      <template #item-trailing="{ item }">
        <UiIcon v-if="(item as SiteMenuItem).active" name="check" class="size-4 shrink-0 text-primary" aria-hidden="true" />
      </template>
    </UDropdownMenu>

    <!-- One Site: a static identity, with nothing to switch to. -->
    <div v-else class="flex min-w-0 max-w-full items-center gap-1.5 px-1 text-highlighted">
      <UiFavicon :domain="current.domain" :size="18" decorative class="shrink-0" />
      <span class="truncate text-title" :title="current.label">{{ current.label }}</span>
    </div>

    <span class="text-sm font-normal leading-none text-dimmed select-none" aria-hidden="true">/</span>
  </div>
</template>
