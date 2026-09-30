<script setup lang="ts">
// The body of the Bing row on Integrations: which Sites collect, which can
// link now, and the one step that unlocks the rest. Bing links per Site, but
// one Microsoft grant serves every Site the owner has, so after the first
// round trip every other Site links in place.
//
// Ported from nuxtseo.com `layers/pro/gsc/app/components/pro/ProBingIntegrationCard.vue`.
// Upstream calls gscdump's private app surface and starts the round trip with
// a host redirect route. Here every call is a partner v1 operation through
// the browser proxy, and Connect asks gscdump for the authorize URL first.
import type { SemanticStatus } from '#layers/design-system/app/composables/semanticColors'
import type { useProBingIntegration } from '#layers/pro-gsc/app/composables/useProGscdump'
import type { BingIntegrationRow, BingIntegrationSiteRef } from '#layers/pro-gsc/app/utils/bing-integration-view'
import { NuxtLink, UiAlert, UiButton, UiFavicon, UiRelativeTime, UiSkeleton, UiStatusBadge, UiTableShell, UiTableTd, UiTableTh } from '#components'
import { cleanDomain, siteLabel } from '#layers/design-system/app/composables/formatting'
import { useProBingAuthorize } from '#layers/pro-gsc/app/composables/useProGscdump'
import {
  bingLinkOutcomeMessage,
  bingSitemapLabel,
  bingSitemapSubmitMessage,
  parseBingAuthorizationReturn,
} from '#layers/pro-gsc/app/utils/bing-integration-view'

const { bing } = defineProps<{ bing: ReturnType<typeof useProBingIntegration> }>()
// The Microsoft round trip landed back here, so the row that holds its
// outcome must open: a message inside a closed row is a message nobody reads.
const emit = defineEmits<{ authorizationReturned: [] }>()

const route = useRoute()
const toast = useToast()
const authorize = useProBingAuthorize()

function siteName(site: BingIntegrationSiteRef): string {
  return siteLabel(site) || 'Site'
}

function siteHost(site: BingIntegrationSiteRef): string {
  return cleanDomain(site.domain) || site.siteId
}

function siteBingPath(site: BingIntegrationSiteRef): string {
  return `/pro/dashboard/sites/${encodeURIComponent(site.siteId)}/indexing/bing`
}

const rows = computed(() => bing.rows.value)
const linkedRows = computed(() => rows.value.filter(row =>
  row._tag === 'collecting' || row._tag === 'verify' || row._tag === 'reconnect'))
const openRows = computed(() => rows.value.filter(row =>
  row._tag === 'linkable' || row._tag === 'grant-required'))
const linkableSites = computed(() => openRows.value
  .filter(row => row._tag === 'linkable' && row.canAct)
  .map(row => row.site))
const ownerOnly = computed(() => openRows.value.some(row => !row.canAct))
const needsSearchConsoleCount = computed(() => rows.value
  .filter(row => row._tag === 'unavailable' && row.reason === 'needs-search-console')
  .length)
const notEnabledCount = computed(() => rows.value
  .filter(row => row._tag === 'unavailable' && row.reason === 'not-enabled')
  .length)
const pending = computed(() => bing.state.value._tag === 'checking')
const readFailed = computed(() => bing.state.value._tag === 'read-failed')

const STATUS: Record<'collecting' | 'verify' | 'reconnect', { label: string, status: SemanticStatus }> = {
  collecting: { label: 'Collecting', status: 'success' },
  verify: { label: 'DNS record needed', status: 'warning' },
  reconnect: { label: 'Reconnect needed', status: 'error' },
}

function linkedStatus(row: BingIntegrationRow) {
  return STATUS[row._tag as keyof typeof STATUS]
}

// One failure line per Site, set by its own attempt and cleared by the next.
const rowErrors = ref<Record<string, string>>({})
const linkingAll = ref(false)
const authorizingSiteId = ref<string | null>(null)
// One link at a time across the card: gscdump refreshes the grant on the
// first link after it expires, and parallel links each refresh it.
const busy = computed(() => linkingAll.value || bing.linkingSiteIds.value.size > 0 || authorizingSiteId.value !== null)

function clearErrors(sites: readonly BingIntegrationSiteRef[]) {
  const errors = { ...rowErrors.value }
  for (const site of sites)
    delete errors[site.siteId]
  rowErrors.value = errors
}

async function link(sites: readonly BingIntegrationSiteRef[]) {
  clearErrors(sites)
  // A transport failure ends the attempt and is said here. Expected Bing
  // outcomes arrive as values below, never through this path.
  const outcomes = await bing.linkSites(sites).catch(() => {
    toast.add({ title: 'Bing could not be reached', description: 'Retry in a moment. Sites linked before the failure stay linked.', color: 'error' })
    return null
  })
  if (!outcomes)
    return
  for (const { site, result } of outcomes) {
    if (result._tag === 'failed')
      rowErrors.value = { ...rowErrors.value, [site.siteId]: bingLinkOutcomeMessage(result, siteName(site)).text }
  }
  const stopped = outcomes.find(outcome => outcome.result._tag === 'grant-required')
  if (stopped) {
    toast.add({ title: bingLinkOutcomeMessage(stopped.result, siteName(stopped.site)).text, color: 'warning' })
    return
  }
  const linked = outcomes.filter(outcome => outcome.result._tag === 'linked')
  if (linked.length === 1) {
    const message = bingLinkOutcomeMessage(linked[0]!.result, siteName(linked[0]!.site))
    toast.add({ title: message.text, color: message.tone === 'success' ? 'success' : 'warning' })
  }
  else if (linked.length > 1) {
    toast.add({ title: `${linked.length} Sites linked to Bing`, color: 'success' })
  }
}

function linkOne(site: BingIntegrationSiteRef) {
  if (busy.value)
    return
  void link([site])
}

function linkAll() {
  if (busy.value || !linkableSites.value.length)
    return
  linkingAll.value = true
  void link(linkableSites.value).finally(() => {
    linkingAll.value = false
  })
}

async function startAuthorization(site: BingIntegrationSiteRef) {
  if (busy.value || !site.gscdumpSiteId)
    return
  authorizingSiteId.value = site.siteId
  clearErrors([site])
  const outcome = await authorize(site.gscdumpSiteId)
  // A redirect leaves the page, so the spinner stays until it does.
  if (outcome._tag === 'failed') {
    authorizingSiteId.value = null
    rowErrors.value = { ...rowErrors.value, [site.siteId]: outcome.message }
  }
}

// Sitemaps: one Submit per Site that Bing lists none for, and the header's
// "Submit N sitemaps" once nothing else is owed.
const missingSitemapSites = computed(() => rows.value
  .filter(row => row._tag === 'collecting' && row.canAct && row.sitemap._tag === 'missing')
  .map(row => row.site))
const submittingAll = ref(false)

async function submit(sites: readonly BingIntegrationSiteRef[]) {
  clearErrors(sites)
  const outcomes = await bing.submitSitemaps(sites)
  for (const { site, result } of outcomes.filter(outcome => outcome.result._tag !== 'submitted'))
    rowErrors.value = { ...rowErrors.value, [site.siteId]: bingSitemapSubmitMessage(result, siteName(site)).text }
  const submitted = outcomes.filter(outcome => outcome.result._tag === 'submitted')
  if (submitted.length === 1) {
    const message = bingSitemapSubmitMessage(submitted[0]!.result, siteName(submitted[0]!.site))
    toast.add({ title: message.text, color: message.tone === 'success' ? 'success' : 'warning' })
  }
  else if (submitted.length > 1) {
    toast.add({ title: `${submitted.length} sitemaps submitted to Bing`, color: 'success' })
  }
}

function submitOne(site: BingIntegrationSiteRef) {
  void submit([site])
}

function submitAll() {
  if (submittingAll.value || !missingSitemapSites.value.length)
    return
  submittingAll.value = true
  void submit(missingSitemapSites.value).finally(() => {
    submittingAll.value = false
  })
}

// The row header owns the one step that unlocks the most Sites.
function startGrant() {
  const target = bing.grantTarget.value
  if (target)
    void startAuthorization(target.site)
}

defineExpose({ linkAll, linkingAll, busy, submitAll, submittingAll, startGrant, authorizingSiteId })

function retry() {
  void bing.refresh()
}

// gscdump returns the browser here with the outcome in the query. Read it
// once, say it, then drop it so a reload does not repeat the message.
const authorizationError = ref<string | null>(null)
onMounted(() => {
  const outcome = parseBingAuthorizationReturn(route.query)
  if (outcome._tag === 'none')
    return
  if (outcome._tag === 'error') {
    authorizationError.value = outcome.message
    toast.add({ title: 'Bing connection failed', description: outcome.message, color: 'error' })
  }
  else if (outcome._tag === 'verification-required') {
    toast.add({ title: 'Bing connected. Add the Bing DNS record to start collection.', color: 'warning' })
  }
  else {
    toast.add({ title: 'Bing connected. Link your other Sites below.', color: 'success' })
  }
  emit('authorizationReturned')
  retry()
  const query = { ...route.query }
  delete query.bing
  delete query.reason
  void navigateTo({ path: route.path, query, hash: route.hash }, { replace: true })
})
</script>

<template>
  <div>
    <UiAlert
      v-if="authorizationError"
      class="mt-3"
      status="error"
      title="Bing connection failed"
      :description="authorizationError"
    />

    <UiAlert
      v-if="readFailed"
      class="mt-3"
      status="error"
      title="Bing state could not be read"
      description="Retry the check. Linked Sites keep collecting."
    >
      <template #action>
        <UiButton purpose="secondary" size="xs" icon="refresh" label="Retry" class="min-h-11 sm:min-h-0" @click="retry" />
      </template>
    </UiAlert>

    <div v-else-if="pending" class="mt-4 space-y-2" aria-busy="true">
      <UiSkeleton type="block" class="h-4 w-40" />
      <UiSkeleton type="block" class="h-24 w-full" />
    </div>

    <template v-else>
      <div v-if="linkedRows.length" class="mt-4">
        <p class="mb-2 text-xs font-medium text-muted">
          Linked Sites
        </p>
        <UiTableShell bordered row-hover size="sm" label="Sites linked to Bing">
          <template #head>
            <UiTableTh>Site</UiTableTh>
            <UiTableTh>Status</UiTableTh>
            <UiTableTh visible-from="sm">
              Sitemap
            </UiTableTh>
            <UiTableTh visible-from="md">
              Last data
            </UiTableTh>
          </template>
          <tr v-for="row in linkedRows" :key="row.site.siteId">
            <UiTableTd row-header class="max-w-0 w-full">
              <NuxtLink :to="siteBingPath(row.site)" class="flex min-w-0 items-center gap-2 hover:text-primary transition-colors">
                <UiFavicon :domain="siteHost(row.site)" :size="16" class="shrink-0 rounded-sm" />
                <span class="block truncate">{{ siteName(row.site) }}</span>
              </NuxtLink>
            </UiTableTd>
            <UiTableTd class="whitespace-nowrap">
              <NuxtLink v-if="row._tag === 'verify'" :to="siteBingPath(row.site)">
                <UiStatusBadge v-bind="linkedStatus(row)" />
              </NuxtLink>
              <UiStatusBadge v-else v-bind="linkedStatus(row)" />
              <!-- Below `sm` the Sitemap column is hidden, so its one action
                   moves under the status rather than disappearing. -->
              <div v-if="row._tag === 'collecting' && row.canAct && row.sitemap._tag === 'missing'" class="mt-1.5 sm:hidden">
                <UiButton
                  size="xs"
                  purpose="secondary"
                  label="Submit sitemap"
                  class="min-h-11"
                  :loading="bing.submittingSiteIds.value.has(row.site.siteId)"
                  :disabled="submittingAll"
                  @click="submitOne(row.site)"
                />
              </div>
              <span v-if="rowErrors[row.site.siteId]" class="mt-1 block whitespace-normal text-xs text-error">{{ rowErrors[row.site.siteId] }}</span>
            </UiTableTd>
            <UiTableTd visible-from="sm" class="whitespace-nowrap text-muted">
              <template v-if="row._tag === 'collecting'">
                <UiButton
                  v-if="row.canAct && row.sitemap._tag === 'missing'"
                  size="xs"
                  purpose="secondary"
                  label="Submit sitemap"
                  :loading="bing.submittingSiteIds.value.has(row.site.siteId)"
                  :disabled="submittingAll"
                  @click="submitOne(row.site)"
                />
                <template v-else>
                  {{ bingSitemapLabel(row.sitemap) }}
                </template>
              </template>
              <template v-else>
                Not yet
              </template>
            </UiTableTd>
            <UiTableTd visible-from="md" class="whitespace-nowrap text-muted">
              <UiRelativeTime
                :date="row._tag === 'collecting' ? row.lastEvidenceAt : null"
                fallback="Not yet"
              />
            </UiTableTd>
          </tr>
        </UiTableShell>
      </div>

      <div v-if="openRows.length" class="mt-4">
        <p class="mb-2 text-xs font-medium text-muted">
          Unlinked Sites
        </p>
        <ul class="space-y-1.5">
          <li v-for="row in openRows" :key="row.site.siteId" class="flex min-h-7 items-center gap-2">
            <UiFavicon :domain="siteHost(row.site)" :size="16" class="shrink-0 rounded-sm" />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm text-default">{{ siteName(row.site) }}</span>
              <span v-if="rowErrors[row.site.siteId]" class="block text-xs text-error">{{ rowErrors[row.site.siteId] }}</span>
            </span>
            <UiButton
              v-if="row.canAct && row._tag === 'linkable'"
              size="xs"
              purpose="secondary"
              label="Link Site"
              :aria-label="`Link ${siteName(row.site)} to Bing`"
              class="min-h-11 shrink-0 sm:min-h-0"
              :loading="bing.linkingSiteIds.value.has(row.site.siteId)"
              :disabled="busy && !bing.linkingSiteIds.value.has(row.site.siteId)"
              @click="linkOne(row.site)"
            />
            <!-- Each Site that still needs a grant can start its own round
                 trip, so one Site Bing refuses cannot block the rest. -->
            <UiButton
              v-else-if="row.canAct && row._tag === 'grant-required'"
              size="xs"
              purpose="secondary"
              :label="row.reason === 'reauthorization-required' ? 'Reconnect Bing' : 'Connect Bing'"
              class="min-h-11 shrink-0 sm:min-h-0"
              :loading="authorizingSiteId === row.site.siteId"
              :disabled="busy && authorizingSiteId !== row.site.siteId"
              @click="startAuthorization(row.site)"
            />
          </li>
        </ul>
        <p class="mt-3 text-xs text-muted">
          <template v-if="bing.grantTarget.value?.reason === 'grant-missing'">
            Connect Bing once. Every Site above then links without another Microsoft sign in.
          </template>
          Linking adds the Site to your Bing Webmaster Tools account when it is not there yet.
          <template v-if="ownerOnly">
            Only the owner of a Site can link it.
          </template>
        </p>
      </div>

      <p v-if="notEnabledCount" class="mt-3 text-sm text-muted">
        Bing is not available for {{ notEnabledCount === 1 ? '1 Site' : `${notEnabledCount} Sites` }} yet.
      </p>
      <p v-if="needsSearchConsoleCount" class="mt-3 text-sm text-muted">
        {{ needsSearchConsoleCount === 1 ? '1 Site needs' : `${needsSearchConsoleCount} Sites need` }} Search Console linked before Bing can link it.
        <NuxtLink to="/pro/dashboard/sites" class="text-default underline underline-offset-2">
          Manage Sites
        </NuxtLink>
      </p>
    </template>
  </div>
</template>
