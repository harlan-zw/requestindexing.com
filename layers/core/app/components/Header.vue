<script setup lang="ts">
import { NavigationMenuContent, NavigationMenuItem, NavigationMenuList, NavigationMenuRoot, NavigationMenuTrigger, NavigationMenuViewport } from 'reka-ui'
import { createLogoutHandler } from '~~/layers/core/app/composables/auth'
import { fetchSites } from '~~/layers/core/app/composables/fetch'
import { ONBOARDING_ROUTE } from '#layers/pro-saas/shared/onboarding'

const { loggedIn, user } = useUserSession()

const logout = createLogoutHandler()
const router = useRouter()

const isOnWelcome = computed(() => router.currentRoute.value.path === ONBOARDING_ROUTE)

const sites = ref((loggedIn.value && !isOnWelcome.value) ? await fetchSites().then(res => res.data.value?.sites) : [])

const hasSites = computed(() => loggedIn.value && !isOnWelcome.value && (sites.value?.length ?? 0) > 0)

const megaMenuItems = computed(() => {
  const items: Array<{ value: string, label: string, icon: string, to: string, hasDropdown: boolean }> = []
  if (loggedIn.value && !isOnWelcome.value) {
    items.push({ value: 'dashboard', label: 'Dashboard', icon: 'i-ph-chart-bar-duotone', to: '/pro/dashboard', hasDropdown: false })
  }
  if (hasSites.value) {
    items.push({ value: 'sites', label: 'Sites', icon: 'i-ph-globe-duotone', to: '/pro/dashboard', hasDropdown: true })
  }
  items.push(
    { value: 'guides', label: 'Guides', icon: 'i-ph-books-duotone', to: '/guides', hasDropdown: true },
    { value: 'tools', label: 'Tools', icon: 'i-ph-wrench-duotone', to: '/tools', hasDropdown: true },
  )
  return items
})

// Mobile nav data
const mobileGuides = [
  { label: 'Ask Google to Index a URL', icon: 'i-heroicons-document-magnifying-glass', to: '/request-indexing-google-search-console' },
  { label: 'Google Indexing API', icon: 'i-heroicons-book-open', to: '/google-indexing-api' },
  { label: 'Setup Tutorial', icon: 'i-heroicons-academic-cap', to: '/google-indexing-api-tutorial' },
  { label: 'Node.js Implementation', icon: 'i-simple-icons-nodedotjs', to: '/google-indexing-api-node-js' },
  { label: 'Bulk Submit URLs', icon: 'i-heroicons-arrow-up-tray', to: '/bulk-submit-urls-google-indexing-api' },
  { label: 'For Blog Posts', icon: 'i-heroicons-document-text', to: '/indexing-api-for-blog-posts' },
  { label: 'Quota & Limits', icon: 'i-heroicons-chart-bar', to: '/google-indexing-api-quota' },
]

const mobileTools = [
  { label: 'Google Index Checker', icon: 'i-heroicons-magnifying-glass', to: '/tools/google-indexing-checker' },
  { label: 'Bulk Indexing Checker', icon: 'i-heroicons-queue-list', to: '/tools/bulk-indexing-checker' },
  { label: 'Site Indexing Report', icon: 'i-heroicons-document-chart-bar', to: '/tools/site-indexing-report' },
]

const mobileSites = computed(() =>
  (sites.value ?? []).map(site => ({
    label: siteLabel(site),
    icon: 'i-ph-browser-duotone',
    to: dashboardSiteHref(site.siteId, 'search-console'),
  })),
)

function withTitle<T extends { label: string }>(items: T[]) {
  return items.map(m => ({ ...m, title: m.label, path: 'to' in m && typeof m.to === 'string' ? m.to : '' }))
}

const authDropdownItems = computed(() => {
  if (isOnWelcome.value) {
    return [[
      {
        label: 'Logout',
        onSelect: () => logout(),
        icon: 'i-heroicons-arrow-left-end-on-rectangle',
      },
    ]]
  }
  return [
    [
      { label: 'Account', to: '/pro/dashboard/account', icon: 'i-heroicons-user-circle' },
    ],
    [
      {
        label: 'Logout',
        onSelect: () => logout(),
        icon: 'i-heroicons-arrow-left-end-on-rectangle',
      },
    ],
  ]
})
</script>

<template>
  <!-- The menu toggle grows to 44x44 for touch. The end margin pulls the extra
       width back, so the icon keeps the page gutter and the row keeps its width.
       The pull-back is on the end side only, so the whole 12px lands outside the
       row and the gap to the call to action survives. Below lg the right slot
       holds that gap at 8px, the spacing both Apple and Material ask for between
       adjacent touch targets. The wordmark drops one step below sm to pay for it. -->
  <UHeader
    :ui="{
      root: 'border-none bg-transparent pt-2 mb-3 px-4 sm:px-5 h-auto',
      container: 'max-w-[1452px] lg:bg-elevated/40 lg:border border-default mx-auto py-0 px-0 lg:px-5 sm:px-0 rounded-lg max-lg:gap-2',
      right: 'max-lg:gap-2',
      toggle: 'min-h-11 min-w-11 justify-center -me-3',
    }"
  >
    <template #left>
      <NuxtLink
        to="/"
        title="Home"
        aria-label="Request Indexing"
        class="flex items-center gap-2 font-bold text-lg sm:text-xl text-default tracking-[-1.5px] max-lg:min-h-11"
      >
        <span class="text-primary italic">Request</span> Indexing
      </NuxtLink>
    </template>

    <template #default>
      <NavigationMenuRoot class="hidden lg:flex justify-center relative py-2">
        <NavigationMenuList class="flex items-center gap-0.5">
          <NavigationMenuItem v-for="item in megaMenuItems" :key="item.value" :value="item.value">
            <template v-if="item.hasDropdown">
              <NavigationMenuTrigger as-child>
                <NuxtLink
                  :to="item.to"
                  class="group relative flex items-center gap-1.5 font-medium text-sm px-2.5 py-1.5 before:absolute before:z-[-1] before:rounded-md before:inset-x-px before:inset-y-0 data-[state=open]:before:bg-elevated data-[state=open]:text-highlighted before:transition-colors transition-colors"
                >
                  <UIcon :name="item.icon" class="shrink-0 size-4 opacity-50 group-hover:opacity-80 group-data-[state=open]:opacity-90 transition-opacity" />
                  {{ item.label }}
                </NuxtLink>
              </NavigationMenuTrigger>
              <NavigationMenuContent
                class="absolute top-0 left-0 w-auto data-[motion=from-start]:animate-[enter-from-left_200ms_ease] data-[motion=from-end]:animate-[enter-from-right_200ms_ease] data-[motion=to-start]:animate-[exit-to-left_200ms_ease] data-[motion=to-end]:animate-[exit-to-right_200ms_ease]"
              >
                <HeaderSitesMenu v-if="item.value === 'sites'" :sites="sites ?? []" />
                <HeaderGuidesMenu v-else-if="item.value === 'guides'" />
                <HeaderToolsMenu v-else-if="item.value === 'tools'" />
              </NavigationMenuContent>
            </template>

            <NuxtLink
              v-else
              :to="item.to"
              class="group relative flex items-center gap-1.5 font-medium text-sm px-2.5 py-1.5 before:absolute before:z-[-1] before:rounded-md before:inset-x-px before:inset-y-0 before:transition-colors transition-colors"
            >
              <UIcon :name="item.icon" class="shrink-0 size-4 opacity-50 group-hover:opacity-80 transition-opacity" />
              {{ item.label }}
            </NuxtLink>
          </NavigationMenuItem>
        </NavigationMenuList>

        <Teleport to="body">
          <NavigationMenuViewport
            class="fixed top-[60px] left-1/2 -translate-x-1/2 overflow-hidden bg-elevated shadow-xl rounded-md ring-1 ring-[var(--ui-border-accented)] h-(--reka-navigation-menu-viewport-height) w-(--reka-navigation-menu-viewport-width) transition-[width,height] duration-200 origin-[top_center] data-[state=open]:animate-[scale-in_100ms_ease-out] data-[state=closed]:animate-[scale-out_100ms_ease-in] z-[100]"
          />
        </Teleport>
      </NavigationMenuRoot>
    </template>

    <template #body>
      <div class="space-y-5">
        <div v-if="hasSites">
          <div class="text-muted text-sm mb-3">
            Sites
          </div>
          <UContentNavigation :navigation="withTitle(mobileSites)" />
        </div>
        <div>
          <div class="text-muted text-sm mb-3">
            Guides
          </div>
          <UContentNavigation :navigation="withTitle(mobileGuides)" />
        </div>
        <div>
          <div class="text-muted text-sm mb-3">
            Tools
          </div>
          <UContentNavigation :navigation="withTitle(mobileTools)" />
        </div>
      </div>
    </template>

    <template #right>
      <div class="flex items-center justify-end lg:-mr-1.5 gap-2 lg:gap-3">
        <!-- Below lg the box grows to 44x44 for touch. The negative margins pull
             the extra width back, so the row keeps the same layout width. -->
        <UColorModeButton class="max-lg:min-h-11 max-lg:min-w-11 max-lg:justify-center max-lg:-mx-1.5" />

        <UButton
          aria-label="Request Indexing on GitHub"
          to="https://github.com/harlan-zw/requestindexing.com"
          target="_blank"
          color="neutral"
          variant="ghost"
          class="hidden lg:inline-flex transition opacity-85"
          icon="i-simple-icons-github"
        />

        <template v-if="!loggedIn">
          <!-- Two doors, as on nuxtseo.com: `/login` for an existing account,
               `/pro/onboarding` for a new one. -->
          <UButton to="/login" external rel="noopener" color="neutral" variant="ghost" class="hidden md:flex max-lg:min-h-11">
            Sign in
          </UButton>
          <!-- Under 375px the label collapses to an icon so the call to action and
               the menu toggle both fit. The label stays as the accessible name. -->
          <UButton to="/pro/onboarding" external rel="noopener" color="primary" variant="solid" class="max-lg:min-h-11 max-[375px]:min-w-11 max-[375px]:justify-center">
            <UIcon name="next" class="hidden size-5 max-[375px]:block" />
            <span class="max-[375px]:sr-only">Get started</span>
          </UButton>
        </template>
        <template v-else>
          <UDropdownMenu :items="authDropdownItems" mode="hover" class="flex items-center">
            <UButton color="neutral" variant="ghost" class="p-0 max-lg:min-h-11">
              <UAvatar :src="user?.avatarUrl || undefined" :alt="user?.name || user?.email || 'Account'" size="sm" />
              <UIcon name="i-heroicons-chevron-down" class="w-4 h-4 ml-1 opacity-50" />
            </UButton>
          </UDropdownMenu>
        </template>
      </div>
    </template>
  </UHeader>
</template>
