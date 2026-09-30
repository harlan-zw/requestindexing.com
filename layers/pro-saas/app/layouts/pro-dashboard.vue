<script setup lang="ts">
import type { SiteLookup, SiteResource } from '#layers/pro-saas/shared/site-lookup'
// The one dashboard shell. Every `/pro/dashboard/**` page renders through it
// (the pro-shell module assigns this layout in `pages:extend`, so a page in a
// feature layer does not have to remember to).
//
// Sidebar bodies follow nuxtseo.com: the SAME component goes into `#sidebar`
// and `#mobile`, so the desktop rail and the drawer cannot diverge. Scope
// decides which body, not which shell: a Site in the route, or an account with
// exactly one Site, gets the Site nav; anything wider gets the fleet roster.
import type { ProNavSite } from '#layers/pro-shell/app/composables/useProSingleSiteNav'
import { fetchSites } from '~~/layers/core/app/composables/fetch'
import { resolveGscConnection } from '#layers/pro-saas/shared/onboarding'
import { MISSING_SITE_PATH, readSiteLookup, siteLookupKey } from '#layers/pro-saas/shared/site-lookup'

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

const { data: siteData, status: sitesStatus } = await fetchSites()
const sites = computed<ProNavSite[]>(() => (siteData.value?.sites ?? []) as ProNavSite[])
const sitesLoading = computed(() => sitesStatus.value === 'pending')
const singleSite = computed(() => sites.value.length === 1)

const routeSiteId = computed(() => typeof route.params.id === 'string' ? route.params.id : null)

/**
 * The Site the sidebar is scoped to, or `null` for the fleet.
 *
 * A Site in the route always wins, even before the roster arrives: the sidebar
 * would otherwise render the fleet list for a beat on every deep link and then
 * swap under the reader's cursor. An account with a single Site collapses to
 * the same body, so the sidebar never flips when crossing shells.
 */
const scopedSite = computed<ProNavSite | null>(() => {
  const id = routeSiteId.value
  if (id)
    return sites.value.find(site => (site.publicId ?? site.siteId ?? site.id) === id) ?? { publicId: id }
  return singleSite.value ? sites.value[0]! : null
})

// nuxtseo.com's `showSiteBack`: on a Site's page, an account with more than
// one Site gets a way back to all of them above the Site nav. An account with
// one Site has nowhere wider to go, so it gets none.
const showSiteBack = computed(() => !!routeSiteId.value && !singleSite.value)

// Site scope, nuxtseo.com's `pro-site-dashboard` shape (ADR-0012): the layout
// is the one place that derives the Site from the route. It reads it once,
// provides it, and owns what happens when the read does not come back.
const proFetch = useProFetch()
const { data: siteLookup, status: siteLookupStatus } = await useAsyncData<SiteLookup | null>(
  () => siteLookupKey(routeSiteId.value || 'none'),
  () => routeSiteId.value ? readSiteLookup(url => proFetch(url), routeSiteId.value) : Promise.resolve(null),
  { watch: [routeSiteId], immediate: !!routeSiteId.value, dedupe: 'defer' },
)

const site = computed<SiteResource | null>(() => siteLookup.value?._tag === 'Found' ? siteLookup.value.site : null)
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

/**
 * The dashboard's one `h1`, drawn by `ProPageHeader`, as nuxtseo.com's
 * `pro-dashboard` layout draws it.
 *
 * This app's pages are flat (no parent feature route wrapping a
 * `<NuxtPage>`), so the shell is the one place that mounts the header. Titles
 * come from `definePageMeta({ title })`; a detail page overrides it with
 * `definePageMeta({ proHeader })`. The error page renders inside this layout
 * and names the error in its own heading, so the header steps aside for it.
 */
const { title: headerMetaTitle } = useProHeaderPageMeta()
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
  <UiAppShell inline-mobile-nav content-class="pt-2 pb-4 sm:py-6 lg:py-3">
    <template #brand>
      <ProSidebarHeader to="/pro/dashboard" />
    </template>

    <template #sidebar>
      <ProSidebarScope :show-back="showSiteBack">
        <ProSingleSiteSidebarNav v-if="scopedSite" :site="scopedSite" />
        <ProFleetSidebarNav v-else :sites="sites" :loading="sitesLoading" />
      </ProSidebarScope>
    </template>

    <template #mobile="{ closeNav }">
      <div class="flex min-h-full flex-col gap-3">
        <ProSidebarHeader to="/pro/dashboard" @navigate="closeNav" />
        <div class="flex min-w-0 flex-1 flex-col">
          <ProSidebarScope :show-back="showSiteBack" class="flex-1" @navigate="closeNav">
            <ProSingleSiteSidebarNav v-if="scopedSite" :site="scopedSite" @navigate="closeNav" />
            <ProFleetSidebarNav v-else :sites="sites" :loading="sitesLoading" @navigate="closeNav" />
          </ProSidebarScope>
          <ProSidebarFooterMobile :single-site="singleSite" @navigate="closeNav" />
        </div>
      </div>
    </template>

    <template #footer>
      <ProSidebarFooter :single-site="singleSite" />
    </template>

    <template #extras>
      <ProCommandPalette :sites="sites" />
    </template>

    <!-- Sticky, so the Site crumb survives scrolling. `v-show`, never `v-if`:
         a page teleports header actions into `#pro-dashboard-header-actions`,
         and the target must already be in the DOM when that page mounts. On a
         client-side arrival from a route with no header, `v-if` would create
         the target after the page, the teleport would resolve to null, and
         the action would silently never render. -->
    <ProPageHeader v-show="headerTitle" sticky :title="headerTitle ?? ''">
      <template #crumb>
        <ProSiteSwitcher v-if="routeSiteId" :sites="sites" :site="site" />
      </template>
      <template #actions>
        <div id="pro-dashboard-header-actions" class="contents" />
      </template>
    </ProPageHeader>

    <div class="pro-container pt-4 pb-10 sm:pt-5">
      <!-- With no header on screen, a phone has no other way to the drawer. -->
      <ProMobileNavTrigger v-if="!headerTitle" class="mb-4" />

      <ProGscScopeMissingAlert v-if="gscScopeMissing" :retry-to="gscRetryTo" class="mb-6" />

      <UiEmptyState
        v-if="siteStatus === 'error'"
        icon="error"
        title="This site could not be loaded"
        description="The request for this site failed. Nothing here is out of date; the read did not come back."
      >
        <UButton color="primary" @click="$router.go(0)">
          Try again
        </UButton>
      </UiEmptyState>
      <!-- A page that throws while it renders keeps the sidebar and the
           header: the boundary swaps only the page for this notice. -->
      <NuxtErrorBoundary v-else @error="onPageError">
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
      </NuxtErrorBoundary>
    </div>
  </UiAppShell>
</template>
