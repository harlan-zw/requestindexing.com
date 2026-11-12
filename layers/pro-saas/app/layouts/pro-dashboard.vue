<script setup lang="ts">
// The one dashboard shell. Every `/pro/dashboard/**` page renders through it
// (the pro-features module assigns this layout in `pages:extend`, so a page in a
// feature layer does not have to remember to).
//
// The chrome is `@nuxtseo/pro-shell`'s Dashboard frame: sidebar header and
// command palette trigger, the sidebar nav, the user menu, the page header and
// the Site switcher. This layout keeps what only this app knows: the Site read,
// the Search Console scope alert, the error boundary, and the nav source the
// frame reads.
//
// Sidebar bodies follow nuxtseo.com: the SAME component goes into `#sidebar`
// and `#mobile`, so the desktop rail and the drawer cannot diverge. Scope
// decides which body, not which shell: a Site in the route, or an account with
// exactly one Site, gets the Site nav; anything wider gets the fleet roster.
import type { ProNavSite } from '#layers/pro-features/app/composables/useProSingleSiteNav'
import type { SiteLookup, SiteResource } from '#layers/pro-saas/shared/site-lookup'
import ProShellDashboardFrame from '@nuxtseo/pro-shell/app/components/ProShellDashboardFrame.vue'
import ProShellFeedbackDrawer from '@nuxtseo/pro-shell/app/components/ProShellFeedbackDrawer.vue'
import ProShellMobileNavTrigger from '@nuxtseo/pro-shell/app/components/ProShellMobileNavTrigger.vue'
import ProShellPageHeader from '@nuxtseo/pro-shell/app/components/ProShellPageHeader.vue'
import ProShellSiteSwitcher from '@nuxtseo/pro-shell/app/components/ProShellSiteSwitcher.vue'
import ProShellUserMenu from '@nuxtseo/pro-shell/app/components/ProShellUserMenu.vue'
import { fetchSites } from '~~/layers/core/app/composables/fetch'
import { resolveGscConnection } from '#layers/pro-saas/shared/onboarding'
import { MISSING_SITE_PATH, readSiteLookup, siteLookupKey } from '#layers/pro-saas/shared/site-lookup'
import { useProFeedback } from '../composables/useProFeedback'
import { useProHeaderMenu } from '../composables/useProHeaderMenu'
import { provideProNavSource } from '../composables/useProNavSource'
import { useProUserMenu } from '../composables/useProUserMenu'
import { proNavSiteRef } from '../utils/pro-shell-sites'

const route = useRoute()
const router = useRouter()
const isDev = import.meta.dev

// Compact dashboard type, flat cards and tabular figures, as nuxtseo.com's
// `ProDashboardShell` sets them. The class goes on `<html>` because the
// palette keys on `.light.dashboard-theme` / `.dark.dashboard-theme`, and the
// colour-mode class only ever lands there.
useHead({ htmlAttrs: { class: 'dashboard-theme' } })

// Every Search Console connect link returns to a dashboard page. When Google
// gave no Search Console scope, the callback marks that page with
// `?error=gsc_scope_missing`, so the shell is the one place that says so. A
// returning user carries no marker; gscdump's `scope_missing`, read into the
// session, says it for them. The retry returns to the same page without the
// marker.
const { session } = useUserSession()
const gscScopeMissing = computed(() => resolveGscConnection({
  gscdumpConnected: !!session.value?.gscdumpConnected,
  accountStatus: session.value?.gscdumpAccountStatus ?? null,
  error: route.query.error,
})._tag === 'ScopeMissing')
const gscRetryTo = computed(() => {
  const { error: _error, ...query } = route.query
  return router.resolve({ path: route.path, query, hash: route.hash }).fullPath
})

const routeSiteId = computed(() => typeof route.params.id === 'string' ? route.params.id : null)

// Site scope, nuxtseo.com's `pro-site-dashboard` shape (ADR-0012): the layout
// is the one place that derives the Site from the route. It reads it once,
// provides it, and owns what happens when the read does not come back.
//
// The roster and the Site read do not depend on each other. Awaiting them one
// after the other added the Site read's whole round trip to every Site page
// before it could render, so both start here and the layout waits once.
const proFetch = useProFetch()
const [
  { data: siteData, status: sitesStatus },
  { data: siteLookup, status: siteLookupStatus },
] = await Promise.all([
  fetchSites(),
  useAsyncData<SiteLookup | null>(
    () => siteLookupKey(routeSiteId.value || 'none'),
    () => routeSiteId.value ? readSiteLookup(url => proFetch(url), routeSiteId.value) : Promise.resolve(null),
    { watch: [routeSiteId], immediate: !!routeSiteId.value, dedupe: 'defer' },
  ),
])
const sites = computed<ProNavSite[]>(() => (siteData.value?.sites ?? []) as ProNavSite[])
const sitesLoading = computed(() => sitesStatus.value === 'pending')
const singleSite = computed(() => sites.value.length === 1)

const site = computed<SiteResource | null>(() => siteLookup.value?._tag === 'Found' ? siteLookup.value.site : null)

/**
 * The Site the sidebar is scoped to, or `null` for the fleet.
 *
 * A Site in the route always wins, even before the roster arrives: the sidebar
 * would otherwise render the fleet list for a beat on every deep link and then
 * swap under the reader's cursor. The roster row names the Site, as the
 * sidebar always has; the layout's own read covers a Site the roster lacks.
 * An account with a single Site collapses to the same body, so the sidebar
 * never flips when crossing shells.
 */
const scopedSite = computed<ProNavSite | null>(() => {
  const id = routeSiteId.value
  if (id)
    return sites.value.find(row => proNavSiteRef(row) === id) ?? (site.value as ProNavSite | null) ?? { publicId: id }
  return singleSite.value ? sites.value[0]! : null
})

// nuxtseo.com's `showSiteBack`: on a Site's page, an account with more than
// one Site gets a way back to all of them above the Site nav. An account with
// one Site has nowhere wider to go, so it gets none.
const showSiteBack = computed(() => !!routeSiteId.value && !singleSite.value)

const siteStatus = computed(() => {
  if (!routeSiteId.value)
    return 'idle'
  // A missing Site is on its way to the Sites list, so its page waits.
  if (siteLookup.value?._tag === 'NotFound')
    return 'pending'
  if (siteLookup.value?._tag === 'Unavailable')
    return 'error'
  return siteLookupStatus.value
})
// An id that names no Site used to fall through as "this Site is not connected
// yet", which put the sample-data shell on screen for a Site that does not
// exist. As nuxtseo.com does, a vanished Site sends the reader to the Sites
// list, which lists what the Team can still open.
if (siteLookup.value?._tag === 'NotFound')
  await navigateTo(MISSING_SITE_PATH, { replace: true })
watch(siteLookup, (value) => {
  if (value?._tag === 'NotFound')
    void navigateTo(MISSING_SITE_PATH, { replace: true })
})

provide('site', site)
provide('siteStatus', siteStatus)

// The frame, the switcher, the sidebar gates and the user menu read this.
provideProNavSource({
  sites: computed(() => sitesLoading.value && !siteData.value ? null : sites.value),
  scopedSite,
  routeSiteRef: routeSiteId,
})

const { items: userMenu } = useProUserMenu({ singleSite })

// Send feedback opens from the page header and the user menu. The drawer
// files the report against the page it opened on.
const feedback = useProFeedback()
const feedbackOpen = feedback.isOpen
const feedbackContext = computed(() => ({
  path: route.path,
  intent: feedback.intent.value,
  ...(routeSiteId.value ? { siteId: routeSiteId.value } : {}),
}))
const feedbackAccount = computed(() => session.value?.user
  ? { email: session.value.user.email ?? null, id: session.value.user.id != null ? String(session.value.user.id) : null }
  : null)

/**
 * The dashboard's one `h1`, drawn by `ProShellPageHeader`, as nuxtseo.com's
 * `pro-dashboard` layout draws it.
 *
 * This app's pages are flat (no parent feature route wrapping a
 * `<NuxtPage>`), so the shell is the one place that mounts the header. Titles
 * come from `definePageMeta({ title })`; a detail page overrides it with
 * `definePageMeta({ proHeader })`, whose ancestors extend the title trail.
 * The error page renders inside this layout and names the error in its own
 * heading, so the header steps aside for it.
 */
const { title: headerMetaTitle, crumbs: headerMetaCrumbs } = useProHeaderPageMeta()
const headerAncestorCrumbs = computed(() => headerMetaCrumbs.value.slice(0, -1))
const { groups: headerMenuGroups } = useProHeaderMenu()
const nuxtError = useError()
const headerTitle = computed(() => {
  if (nuxtError.value)
    return null
  const title = headerMetaTitle.value ?? route.meta.title
  return typeof title === 'string' && title ? title : null
})

// Surface (do not swallow) a page render error the boundary caught, so it
// still reaches the console and Sentry with the route that threw. The router's
// route, not `route`: a page that throws on arrival never finishes, so the
// Nuxt route still names the page before it.
function onPageError(error: unknown) {
  console.error(`[pro-dashboard] page render error on ${router.currentRoute.value.fullPath}:`, error)
}
</script>

<template>
  <ProShellDashboardFrame>
    <template #brand-mark>
      <OgBrand :size="24" semantic />
    </template>

    <template #sidebar>
      <ProSidebarScope :show-back="showSiteBack">
        <ProSingleSiteSidebarNav v-if="scopedSite" :site="scopedSite" />
        <ProFleetSidebarNav v-else :sites="sites" :loading="sitesLoading" />
      </ProSidebarScope>
    </template>

    <template #mobile="{ closeNav }">
      <div class="flex min-w-0 flex-1 flex-col">
        <ProSidebarScope :show-back="showSiteBack" class="flex-1" @navigate="closeNav">
          <ProSingleSiteSidebarNav v-if="scopedSite" :site="scopedSite" @navigate="closeNav" />
          <ProFleetSidebarNav v-else :sites="sites" :loading="sitesLoading" @navigate="closeNav" />
        </ProSidebarScope>
        <ProShellUserMenu variant="drawer" :items="userMenu" @navigate="closeNav" />
      </div>
    </template>

    <template #footer>
      <ProShellUserMenu :items="userMenu" />
    </template>

    <template #command-palette>
      <ProCommandPalette :sites="sites" />
    </template>

    <!-- Sticky, so the Site crumb survives scrolling. `v-show`, never `v-if`:
         toggling the header must not remount the Site switcher on every
         navigation between a titled and an untitled route. -->
    <ProShellPageHeader
      v-show="headerTitle"
      sticky
      :title="headerTitle ?? ''"
      :crumbs="headerAncestorCrumbs"
      :menu-groups="headerMenuGroups"
    >
      <template v-if="routeSiteId" #crumb>
        <ProShellSiteSwitcher />
      </template>
    </ProShellPageHeader>

    <div class="pro-container pt-4 pb-10 sm:pt-5">
      <!-- With no header on screen, a phone has no other way to the drawer. -->
      <ProShellMobileNavTrigger v-if="!headerTitle" class="mb-4" />

      <ProGscScopeMissingAlert v-if="gscScopeMissing" :retry-to="gscRetryTo" class="mb-6" />

      <UiEmptyState
        v-if="siteStatus === 'error'"
        icon="error"
        title="This Site could not be loaded"
        description="The request for this Site failed. Nothing here is out of date; the read did not come back."
      >
        <UButton color="primary" @click="$router.go(0)">
          Try again
        </UButton>
      </UiEmptyState>
      <!-- A page that throws while it renders keeps the sidebar and the
           header: the boundary swaps only the page for this notice, until the
           next navigation. -->
      <ProPageErrorBoundary v-else @error="onPageError">
        <slot />
        <template #error="{ error, clearError }">
          <UiAlert
            status="error"
            icon="caution"
            title="This page didn't load"
            :description="isDev ? String(error) : 'Try again. If the error returns, reload the dashboard.'"
          >
            <template #action>
              <div class="flex shrink-0 gap-2">
                <UiButton size="xs" purpose="secondary" icon="refresh" @click="clearError">
                  Try again
                </UiButton>
                <UiButton size="xs" purpose="quiet" @click="reloadNuxtApp({ persistState: false })">
                  Reload
                </UiButton>
              </div>
            </template>
          </UiAlert>
        </template>
      </ProPageErrorBoundary>
    </div>

    <ProShellFeedbackDrawer
      v-model:open="feedbackOpen"
      :context="feedbackContext"
      :account="feedbackAccount"
      :submit="feedback.submit"
    />
  </ProShellDashboardFrame>
</template>
