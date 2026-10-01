<script setup lang="ts">
// Ported from nuxtseo.com `apps/pro/app/pages/pro/dashboard/integrations.vue`,
// cut to the "Search engines" group the way gscdump.com cut it: Google Search
// Console and Bing Webmaster Tools. Web analytics, market data and delivery
// have no equivalent here and are not stubbed.
//
// Search Console moved here from Account. Account keeps the sign-in identity
// and the Indexing API grant.
//
// Bing runs on gscdump's partner v1 operations only: the fleet read, link,
// authorization, and sitemap submit. The whole row stays behind the `bing`
// feature flag, and gscdump returns a Microsoft round trip to this page.
import { useMounted } from '@vueuse/core'
import { fetchSites } from '~~/layers/core/app/composables/fetch'
import { formatTimeAgo } from '#layers/design-system/app/composables/formatting'
import { useProBingIntegration } from '#layers/pro-gsc/app/composables/useProGscdump'
import ProBingIntegrationCard from '#layers/pro-gsc/app/internal/components/bing/ProBingIntegrationCard.vue'
import { bingIntegrationStatusLine } from '#layers/pro-gsc/app/utils/bing-integration-view'
import { projectGscIntegrationState } from '#layers/pro-gsc/shared/gsc-integration-state'
import { INTEGRATIONS_NO_PROPERTY } from '#layers/pro-gsc/shared/no-property-copy'
import ProNoPropertyNotice from '#layers/pro-saas/app/components/pro/ProNoPropertyNotice.vue'
import { INTEGRATIONS_ROUTE } from '#layers/pro-shell/app/utils/integrations-pending'

definePageMeta({
  layout: 'pro-dashboard',
  title: 'Integrations',
  icon: 'i-lucide-plug',
})
useSeoMeta({ title: 'Integrations' })

const { session } = useUserSession()
const mounted = useMounted()

// ── Search Console ──────────────────────────────────────────────────────
// Every entry point uses the one connect route. The callback returns here.
const gscConnectHref = `/auth/integrations/gsc/connect?returnTo=${encodeURIComponent(INTEGRATIONS_ROUTE)}`
const gscConnected = computed(() => !!session.value?.gscConnected)
const gscEmail = computed(() => session.value?.gscEmail ?? null)

// Same key as the Indexing feature state, so the two share one read.
const {
  data: gscData,
  error: gscFetchError,
  status: gscStatus,
  refresh: refreshGsc,
} = useLazyFetch('/api/pro/gsc-properties', { key: 'pro:gsc-properties' })

const gscState = computed(() => projectGscIntegrationState({
  sessionConnected: gscConnected.value,
  accountStatus: session.value?.gscdumpAccountStatus ?? null,
  queryStatus: gscStatus.value,
  data: gscData.value,
  queryErrorMessage: gscFetchError.value ? 'Search Console could not be checked. Try again.' : undefined,
}))

// The freshest sync across synced properties, so the status line also states
// how fresh the data is. Relative to now, so it waits for mount rather than
// render one string on the server and another in the browser.
// The lifecycle path sends epoch milliseconds; the picker path can send an
// ISO string. Anything else counts as never synced.
function syncedAt(value: unknown): number {
  const time = typeof value === 'string' ? Date.parse(value) : Number(value)
  return Number.isFinite(time) ? time : 0
}
const gscLastSyncLabel = computed(() => {
  if (!mounted.value)
    return null
  const last = (gscData.value?.properties ?? [])
    .filter(property => property.syncStatus === 'synced')
    .reduce((max, property) => Math.max(max, syncedAt(property.lastSyncAt)), 0)
  return last > 0 ? formatTimeAgo(last) : null
})

const gscStatusLine = computed(() => {
  const state = gscState.value
  switch (state._tag) {
    case 'disconnected':
      return 'Not connected'
    case 'reconnect-required':
      return state.reason === 'refresh_missing'
        ? 'Reconnect needed. Google did not return a refresh token.'
        : 'Reconnect needed. Google stopped accepting this connection.'
    case 'checking':
      return 'Checking'
    case 'ready': {
      // Connected, with nothing to read. "0 of 0 properties synced" told the
      // reader nothing about why no data arrives.
      if (!state.stats.total)
        return INTEGRATIONS_NO_PROPERTY
      const count = state.stats.readyToSync
        ? `${state.stats.synced} of ${state.stats.total} properties synced, ${state.stats.readyToSync} ready`
        : `${state.stats.synced} of ${state.stats.total} properties synced`
      return gscLastSyncLabel.value ? `${count} · updated ${gscLastSyncLabel.value}` : count
    }
    case 'payload-error':
      return state.reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT'
        ? 'Permission not granted'
        : state.message
    case 'query-error':
    default:
      return state.message
  }
})

// The no-property state. nuxtseo.com has none: its Sites need no property.
// The ready row there offers "Manage properties" and "Reconnect"; here, with
// no property, both lead nowhere new, so the row offers the no-property
// actions instead.
const gscNoProperty = computed(() => gscState.value._tag === 'ready' && !gscState.value.stats.total)

const gscFailure = computed(() => {
  const state = gscState.value
  if (state._tag === 'reconnect-required')
    return 'Search Console data has stopped updating. Reconnect to resume collection.'
  return state._tag === 'payload-error' || state._tag === 'query-error' ? state.message : null
})

// ── Bing ────────────────────────────────────────────────────────────────
// gscdump reports every Site's Bing state in one read. The layout already
// fetched the Site roster; this reuses it as the denominator.
const { data: siteData } = await fetchSites()
const bing = useProBingIntegration(() => siteData.value?.sites ?? [])
const bingState = computed(() => bing.state.value)
const bingStatusLine = computed(() => bingIntegrationStatusLine(bingState.value))
const bingSummary = computed(() => bingState.value._tag === 'ready' ? bingState.value.summary : null)

// The header action is the one step that unlocks the most Sites: the
// Microsoft round trip while no grant works, else linking every Site the grant
// can reach, else the sitemaps Bing lists none for.
const bingRowOpen = ref(false)
const bingCard = useTemplateRef<InstanceType<typeof ProBingIntegrationCard>>('bingCard')
const bingAction = computed(() => {
  const summary = bingSummary.value
  if (!summary)
    return null
  const grant = bing.grantTarget.value
  if (grant)
    return { _tag: 'grant', label: grant.reason === 'reauthorization-required' ? 'Reconnect Bing' : 'Connect Bing' } as const
  if (summary.linkable)
    return { _tag: 'link', label: summary.linkable === 1 ? 'Link 1 Site' : `Link ${summary.linkable} Sites` } as const
  if (summary.sitemapsMissing)
    return { _tag: 'sitemaps', label: summary.sitemapsMissing === 1 ? 'Submit 1 sitemap' : `Submit ${summary.sitemapsMissing} sitemaps` } as const
  return null
})
function runBingAction() {
  bingRowOpen.value = true
  const action = bingAction.value
  if (action?._tag === 'grant')
    bingCard.value?.startGrant()
  else if (action?._tag === 'link')
    bingCard.value?.linkAll()
  else if (action?._tag === 'sitemaps')
    bingCard.value?.submitAll()
}
const bingActionLoading = computed(() => !!bingCard.value
  && (bingCard.value.linkingAll || bingCard.value.submittingAll || bingCard.value.authorizingSiteId !== null))
</script>

<template>
  <div class="max-w-3xl">
    <p class="text-sm text-muted">
      Request Indexing reads your search data from these Integrations.
    </p>

    <section id="search-engines" class="mt-6">
      <UiSectionHeader title="Search engines" />
      <div class="mt-3 divide-y divide-default overflow-hidden rounded-xl border border-default bg-elevated/40">
        <IntegrationRow
          name="Google Search Console"
          logo="i-logos-google-icon"
          :status="gscStatusLine"
          :connected="gscState._tag === 'ready'"
        >
          <template #action>
            <UiButton
              v-if="gscState._tag === 'disconnected' || gscState._tag === 'reconnect-required'"
              :to="gscConnectHref"
              external
              size="md"
              purpose="secondary"
              :label="gscState._tag === 'reconnect-required' ? 'Reconnect' : 'Connect'"
              class="min-h-11 shrink-0"
            />
          </template>

          <p class="text-sm text-muted">
            Impressions, clicks, and average position for every query and page Google serves. This is the
            data behind Search Performance and Indexing.
          </p>
          <!-- No property: the same state and the same three actions as
               Connect a Site. Its grant control is the only one in the row,
               so "Reconnect" never sits beside a second label for the same
               round trip (2026-10-01 replay, N9). -->
          <ProNoPropertyNotice
            v-if="gscNoProperty"
            class="mt-3"
            :email="gscEmail"
            :gsc-return-to="INTEGRATIONS_ROUTE"
          />
          <p v-else-if="gscState._tag === 'ready' && gscEmail" class="mt-2 text-sm break-words text-muted">
            {{ gscEmail }} grants access to your properties.
          </p>
          <UiAlert
            v-if="gscFailure"
            class="mt-3"
            status="error"
            :title="gscState._tag === 'reconnect-required' ? 'Search Console needs reconnecting' : 'Search Console unavailable'"
            :description="gscFailure"
          >
            <template #action>
              <!-- Retry re-runs a read the projection overrides, so it can
                   never clear this state. Reconnecting is the only exit. -->
              <UiButton
                v-if="gscState._tag === 'reconnect-required'"
                :to="gscConnectHref"
                external
                purpose="secondary"
                size="xs"
                label="Reconnect"
                class="min-h-11 sm:min-h-0"
              />
              <UiButton v-else purpose="secondary" size="xs" icon="refresh" label="Retry" class="min-h-11 sm:min-h-0" @click="refreshGsc()" />
            </template>
          </UiAlert>
          <div v-if="gscState._tag === 'ready' && !gscNoProperty" class="mt-3 flex flex-wrap gap-2">
            <UiButton
              to="/pro/dashboard/sites"
              size="xs"
              purpose="secondary"
              trailing-icon="next"
              label="Manage Sites"
              class="min-h-11 sm:min-h-0"
            />
            <UiButton
              :to="gscConnectHref"
              external
              size="xs"
              purpose="quiet"
              label="Reconnect"
              class="min-h-11 sm:min-h-0"
            />
          </div>
        </IntegrationRow>

        <IntegrationRow
          id="bing"
          v-model:open="bingRowOpen"
          name="Bing Webmaster Tools"
          logo="i-logos-bing"
          :status="bingStatusLine"
          :connected="!!bingSummary && bingSummary.linked > 0 && !bingSummary.pending"
        >
          <template v-if="bingAction" #action>
            <!-- Below `sm` a bulk label squeezes the row name to one word, and
                 each Site row below carries the same action. The grant stays,
                 because one round trip unlocks every Site. -->
            <UiButton
              size="md"
              purpose="secondary"
              :label="bingAction.label"
              :loading="bingActionLoading"
              :disabled="bingCard?.busy && !bingActionLoading"
              class="min-h-11 shrink-0"
              :class="bingAction._tag === 'grant' ? '' : 'hidden sm:inline-flex'"
              @click="runBingAction"
            />
          </template>

          <p class="text-sm text-muted">
            Bing's crawl activity and search performance for each Site. Use it when Google and Bing
            disagree about your pages.
          </p>
          <p v-if="bingState._tag === 'unavailable' || bingState._tag === 'not-offered'" class="mt-2 text-sm text-muted">
            Request Indexing cannot link Bing for your account yet.
          </p>
          <ProBingIntegrationCard
            v-else
            ref="bingCard"
            :bing="bing"
            @authorization-returned="bingRowOpen = true"
          />
        </IntegrationRow>
      </div>
    </section>
  </div>
</template>
