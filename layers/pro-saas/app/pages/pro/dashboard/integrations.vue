<script setup lang="ts">
// Ported from nuxtseo.com `apps/pro/app/pages/pro/dashboard/integrations.vue`,
// cut to the "Search engines" group the way gscdump.com cut it: Google Search
// Console and Bing Webmaster Tools. Web analytics, market data and delivery
// have no equivalent here and are not stubbed.
//
// Search Console moved here from Account. Account keeps the sign-in identity
// and the Indexing API grant.
//
// Bing is read-only. gscdump's partner v1 protocol reports each Site's Bing
// connection, but it has no connect or reconnect operation, and this app never
// calls gscdump's app surface. So the row counts what Bing reports and offers
// no button.
import { useMounted } from '@vueuse/core'
import { fetchSites } from '~~/layers/core/app/composables/fetch'
import { formatTimeAgo } from '#layers/design-system/app/composables/formatting'
import { useProBingIntegration } from '#layers/pro-gsc/app/composables/useProGscdump'
import { bingIntegrationStatusLine } from '#layers/pro-gsc/app/utils/bing-view'
import { projectGscIntegrationState } from '#layers/pro-gsc/shared/gsc-integration-state'
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

const gscFailure = computed(() => {
  const state = gscState.value
  if (state._tag === 'reconnect-required')
    return 'Search Console data has stopped updating. Reconnect to resume collection.'
  return state._tag === 'payload-error' || state._tag === 'query-error' ? state.message : null
})

// ── Bing ────────────────────────────────────────────────────────────────
// Bing reads each Site through its Search Console link, so the row counts
// linked Sites. The layout already fetched the roster; this reuses it.
const { data: siteData } = await fetchSites()
const bing = useProBingIntegration(() => siteData.value?.sites ?? [])
const bingState = computed(() => bing.state.value)
const bingStatusLine = computed(() => bingIntegrationStatusLine(bingState.value))
const bingNote = computed(() => bingState.value._tag === 'unavailable'
  ? 'Request Indexing cannot connect Bing yet.'
  : 'You cannot connect or reconnect Bing from Request Indexing yet. Open a Site\'s Indexing: Bing page to see its connection.')
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
          <p v-if="gscState._tag === 'ready' && gscEmail" class="mt-2 text-sm break-words text-muted">
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
          <div v-if="gscState._tag === 'ready'" class="mt-3 flex flex-wrap gap-2">
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
          name="Bing Webmaster Tools"
          logo="i-logos-bing"
          :status="bingStatusLine"
          :connected="bingState._tag === 'ready' && bingState.connected > 0 && !bingState.reconnect"
        >
          <p class="text-sm text-muted">
            Bing's crawl activity and search performance for each Site. Use it when Google and Bing
            disagree about your pages.
          </p>
          <p class="mt-2 text-sm text-muted">
            {{ bingNote }}
          </p>
          <UiAlert
            v-if="bingState._tag === 'read-failed'"
            class="mt-3"
            status="error"
            title="Bing state could not be read"
            description="No Site returned its Bing connection. Retry to read them again."
          >
            <template #action>
              <UiButton purpose="secondary" size="xs" icon="refresh" label="Retry" class="min-h-11 sm:min-h-0" @click="bing.refresh()" />
            </template>
          </UiAlert>
        </IntegrationRow>
      </div>
    </section>
  </div>
</template>
