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
import { readSiteLookup, siteLookupKey } from '#layers/pro-saas/shared/site-lookup'

const route = useRoute()
const router = useRouter()

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
  return sites.value.length === 1 ? sites.value[0]! : null
})

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
  if (siteLookup.value && siteLookup.value._tag !== 'Found')
    return 'error'
  return siteLookupStatus.value
})
// An id that names no Site used to fall through as "this Site is not connected
// yet", which put the sample-data shell on screen for a Site that does not
// exist. nuxtseo.com sends a vanished Site to its Sites roster
// (`MISSING_SITE_PATH`); there is no roster page here, so the honest landing is
// the 404 page.
function siteNotFound() {
  return createError({ statusCode: 404, statusMessage: 'Site not found', fatal: true })
}
if (siteLookup.value?._tag === 'NotFound')
  throw siteNotFound()
watch(siteLookup, (value) => {
  if (value?._tag === 'NotFound')
    showError(siteNotFound())
})

provide('site', site)
provide('siteStatus', siteStatus)

/**
 * The dashboard's one `h1`, drawn through the design system's `UiPageHeader`.
 *
 * nuxtseo.com puts the same component behind `ProPage` / `ProSiteFeaturePage`,
 * which every one of its dashboard routes renders, so a route there always
 * names itself. This app's pages are flat (no parent feature route wrapping a
 * `<NuxtPage>`), so the shell is the shared place to mount the same header.
 * Titles come from `definePageMeta({ title })`, which the account shell layout
 * already read before this.
 *
 * `proHideHeader` is the page-meta twin of upstream's `hide-header` prop: the
 * query and page drill-ins fold their heading into a richer identity block, so
 * the shell steps aside and no route ships two `h1`s.
 */
const ownsHeading = computed(() => (route.meta as { proHideHeader?: boolean }).proHideHeader === true)
const pageTitle = computed(() => {
  if (ownsHeading.value)
    return null
  const title = route.meta.subTitle ?? route.meta.title
  return typeof title === 'string' && title ? title : null
})
const pageIcon = computed(() => typeof route.meta.icon === 'string' ? route.meta.icon : undefined)
</script>

<template>
  <UiAppShell content-class="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
    <template #brand>
      <ProSidebarHeader to="/pro/dashboard" />
    </template>

    <template #sidebar>
      <ProSingleSiteSidebarNav v-if="scopedSite" :site="scopedSite" />
      <ProFleetSidebarNav v-else :sites="sites" :loading="sitesLoading" />
    </template>

    <template #mobileNav>
      <NuxtLink to="/pro/dashboard" class="inline-flex min-h-11 items-center rounded-md text-default">
        <OgBrand :size="22" wordmark semantic />
      </NuxtLink>
    </template>

    <template #mobile="{ closeNav }">
      <div class="flex min-h-full flex-col gap-3">
        <ProSidebarHeader to="/pro/dashboard" @navigate="closeNav" />
        <!-- Flex column, so the nav body's `mt-auto` rail pins to the drawer bottom. -->
        <div class="flex flex-1 flex-col *:flex-1">
          <ProSingleSiteSidebarNav v-if="scopedSite" :site="scopedSite" @navigate="closeNav" />
          <ProFleetSidebarNav v-else :sites="sites" :loading="sitesLoading" @navigate="closeNav" />
        </div>
        <div class="border-t border-default pt-2">
          <ProSidebarFooter :single-site="sites.length === 1" />
        </div>
      </div>
    </template>

    <template #footer>
      <ProSidebarFooter :single-site="sites.length === 1" />
    </template>

    <template #extras>
      <ProCommandPalette :sites="sites" />
    </template>

    <UiPageHeader
      v-if="pageTitle"
      flush
      :border="false"
      :title="pageTitle"
      class="mb-6"
    >
      <template v-if="pageIcon" #icon>
        <UIcon :name="pageIcon" class="size-5 shrink-0 text-primary" aria-hidden="true" />
      </template>
    </UiPageHeader>

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
    <slot v-else />
  </UiAppShell>
</template>
