<script setup lang="ts">
import type { SiteAllowance } from '#layers/pro-gsc/shared/free-allowance'
import type { PropertyPickerResponse } from '#layers/pro-gsc/shared/property-picker'
import { siteAllowanceReached, siteAllowanceSummary } from '#layers/pro-gsc/shared/entitlement-copy'
import { projectPropertyPicker, propertyPickerBlocksConnect } from '#layers/pro-gsc/shared/property-picker'
import { parseSiteUrlInput } from '#layers/pro-saas/shared/site-url'

// Connect a Site from the caller's Search Console properties.
//
// nuxtseo.com's `gsc` entry mode (`apps/pro/app/components/pro/ProSiteAddForm.vue`):
// the list comes from gscdump, with a Refresh that reads Google live, a
// reconnect state, a failed read, and a state for an account with no property.
// nuxtseo.com also takes any typed address, because its Sites have value
// without Search Console. A Site here has none, so the server refuses an
// address no verified property covers, and the address field is only for a
// subdomain of a listed property.
//
// Three pages render it: the onboarding wizard, Connect a Site, and the
// Manage Sites modal. `gscReturnTo` is required because the Google grant must
// come back to the page that started it. A default of the wizard once sent
// finished users there, and the onboarding gate bounced them to the dashboard.
const { gscReturnTo } = defineProps<{
  gscReturnTo: string
}>()

const emit = defineEmits<{
  changed: [count: number]
  /** One Site connected. */
  connected: [site: { siteId: string, domain: string | null }]
  /**
   * Nothing can connect right now: no property, no Google connection, a failed
   * read, a refused attempt, or a full Free allowance. The wizard reveals its
   * skip on this, as nuxtseo.com does.
   */
  blocked: []
}>()

interface ConnectedSite {
  siteId: string
  domain: string | null
  property: string | null
}

interface SitesPreviewResponse {
  sites: ConnectedSite[]
  /** gscdump's Site allowance. `Uncapped` while the partner is exempt. */
  siteAllowance: SiteAllowance
}

const toast = useToast()
const { session } = useUserSession()

// Both reads are lazy, as on nuxtseo.com, so they start together and the
// form renders its loading text at once. Awaited, they ran one after the
// other, and the Manage Sites modal stayed empty until both answered.
//
// `defer`: a background refresh (the realtime resync) joins a read already
// running instead of cancelling and restarting it. A re-read the user or a
// connect asks for passes `cancel`, so it always starts fresh.
const { data: preview, refresh: refreshSites, status: sitesStatus } = useFetch<SitesPreviewResponse>('/api/sites/preview', {
  key: 'site-add-form-sites',
  server: false,
  lazy: true,
  dedupe: 'defer',
})

// gscdump answers from its stored copy of the Google list. The Refresh button
// asks for a live read once, for a property the user added a moment ago.
const liveRead = ref(false)
const { data: gsc, refresh: refreshGsc, status: gscStatus } = useFetch<PropertyPickerResponse>('/api/pro/gsc-properties', {
  key: 'site-add-form-gsc-properties',
  server: false,
  lazy: true,
  dedupe: 'defer',
  query: { refresh: computed(() => liveRead.value ? '1' : undefined) },
  watch: false,
})

async function refreshProperties() {
  liveRead.value = true
  try {
    await refreshGsc({ dedupe: 'cancel' })
  }
  finally {
    liveRead.value = false
  }
}

async function rereadAfterConnect() {
  await Promise.all([refreshSites({ dedupe: 'cancel' }), refreshGsc({ dedupe: 'cancel' })])
}

const sitesLoaded = computed(() => preview.value != null || sitesStatus.value === 'error')

const connectedSites = computed(() => preview.value?.sites ?? [])
// nuxtseo.com shows the count against its cap and stops the form at the cap.
// Here the cap is the Free allowance, which gscdump counts across every Team
// the owner has, so the count can be higher than this Team's list. With no
// cap (an exempt partner, or an unknown read) the form shows no count.
const cappedAllowance = computed(() => {
  const allowance = preview.value?.siteAllowance
  return allowance?._tag === 'Capped' ? allowance : null
})
const atLimit = computed(() => !!cappedAllowance.value && cappedAllowance.value.used >= cappedAllowance.value.allowance)
// One notice for a full allowance, above every way to connect. Every Connect
// control is disabled under it, so no click can fail with the same message.
const allowanceFullNotice = computed(() => atLimit.value && cappedAllowance.value ? siteAllowanceReached(cappedAllowance.value.allowance) : null)

const connectedDomains = computed(() => new Set(connectedSites.value.map(s => s.domain).filter(Boolean) as string[]))

// The Search Console section as one tagged state.
const picker = computed(() => projectPropertyPicker({
  queryStatus: gscStatus.value,
  data: gsc.value,
  sitesLoaded: sitesLoaded.value,
  connectedDomains: connectedDomains.value,
}))
// A re-read keeps the list on screen, so the Refresh button carries the wait.
const listReading = computed(() => picker.value._tag === 'Loading' || gscStatus.value === 'pending')

watch([atLimit, picker], ([full, state]) => {
  if (full || propertyPickerBlocksConnect(state))
    emit('blocked')
}, { immediate: true })

watch(connectedSites, sites => emit('changed', sites.length), { immediate: true })

// The address field serves a subdomain of a listed property. Shown to an
// account with no property, it invites an address the server must refuse.
const showAddressField = computed(() => picker.value._tag === 'Properties' || picker.value._tag === 'AllConnected')

const gscConnectUrl = computed(() => `/auth/integrations/gsc/connect?returnTo=${encodeURIComponent(gscReturnTo)}`)
const noPropertiesTitle = computed(() => session.value?.gscEmail
  ? `${session.value.gscEmail} has no Search Console property`
  : 'This Google account has no Search Console property')

const url = ref('')
const submitting = ref<string | null>(null)
// A refusal shows where the attempt started: under the field for a typed
// address, above the list for a row.
const connectError = ref<{ source: 'field' | 'list', message: string } | null>(null)

const typedError = computed(() => {
  if (!url.value.trim())
    return ''
  const parsed = parseSiteUrlInput(url.value)
  return parsed._tag === 'Err' ? parsed.message : ''
})

// A refusal that raced the page says what the notice above already says once
// the re-read lands; show it in one place only.
function visibleError(source: 'field' | 'list'): string | undefined {
  const error = connectError.value
  if (error?.source === source && error.message !== allowanceFullNotice.value)
    return error.message
  return undefined
}
const fieldError = computed(() => visibleError('field') || typedError.value || undefined)
const listError = computed(() => visibleError('list'))

async function connect(value: string, source: 'field' | 'list') {
  if (submitting.value || atLimit.value)
    return
  connectError.value = null

  const parsed = parseSiteUrlInput(value)
  if (parsed._tag === 'Err') {
    connectError.value = { source, message: parsed.message }
    return
  }

  submitting.value = parsed.domain
  try {
    const { site } = await $fetch<{ site: { id: string, domain: string | null } }>('/api/pro/sites', { method: 'POST', body: { url: parsed.origin } })
    url.value = ''
    await rereadAfterConnect()
    toast.add({ title: `Connected ${parsed.domain}`, color: 'success' })
    emit('connected', { siteId: site.id, domain: site.domain })
  }
  catch (err: unknown) {
    // The API error envelope carries the reader-facing message: this app's
    // copy for a property refusal or a Free allowance refusal.
    const message = (err as { data?: { data?: { message?: unknown } } } | null)?.data?.data?.message
    connectError.value = {
      source,
      message: typeof message === 'string' && message ? message : 'Request Indexing could not connect that site. Try again.',
    }
    emit('blocked')
    // A refusal means the allowance or the property list moved since the page
    // loaded. Re-read both so the list and the count match what gscdump said.
    await rereadAfterConnect()
  }
  finally {
    submitting.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <div v-if="connectedSites.length" class="space-y-2">
      <h2 class="text-sm font-semibold text-highlighted">
        Connected
      </h2>
      <ul class="space-y-2">
        <li
          v-for="site in connectedSites"
          :key="site.siteId"
          class="flex items-center gap-2 rounded-lg border border-default bg-elevated/40 px-3 py-2"
        >
          <UIcon name="i-heroicons-check-circle" class="size-5 shrink-0 text-primary" aria-hidden="true" />
          <span class="truncate text-sm text-highlighted">{{ site.domain || site.property }}</span>
        </li>
      </ul>
    </div>

    <ProAlert v-if="allowanceFullNotice" color="warning" :title="allowanceFullNotice" />

    <section class="space-y-3" aria-labelledby="site-add-form-properties">
      <div class="flex items-center justify-between gap-2">
        <h2 id="site-add-form-properties" class="text-sm font-semibold text-highlighted">
          Your Search Console properties
        </h2>
        <UButton
          v-if="picker._tag !== 'NotConnected' && picker._tag !== 'Reconnect'"
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-heroicons-arrow-path"
          class="min-h-11 shrink-0"
          label="Refresh list"
          aria-label="Refresh your Search Console properties"
          :loading="listReading"
          :disabled="listReading"
          data-testid="gsc-refresh"
          @click="refreshProperties()"
        />
      </div>

      <ProAlert v-if="listError" color="error" :title="listError" />

      <p v-if="picker._tag === 'Loading'" class="text-sm text-muted" role="status" aria-live="polite">
        Reading your Search Console properties.
      </p>

      <div v-else-if="picker._tag === 'NotConnected'" class="space-y-3 rounded-lg border border-dashed border-default p-4" data-testid="gsc-not-connected">
        <div class="space-y-1">
          <p class="text-sm font-medium text-highlighted">
            Connect Google Search Console
          </p>
          <p class="text-sm text-muted">
            Request Indexing lists your Search Console properties here after you connect Google.
          </p>
        </div>
        <UButton :to="gscConnectUrl" external color="primary" icon="i-simple-icons-google" class="min-h-11" label="Connect Google" />
      </div>

      <div v-else-if="picker._tag === 'Provisioning'" class="space-y-1 rounded-lg border border-dashed border-default p-4" role="status">
        <p class="text-sm font-medium text-highlighted">
          Search Console setup is in progress
        </p>
        <p class="text-sm text-muted">
          {{ picker.message }}
        </p>
      </div>

      <div v-else-if="picker._tag === 'Reconnect'" class="space-y-2">
        <ProAlert color="warning" :title="picker.message" />
        <UButton :to="gscConnectUrl" external color="neutral" variant="subtle" class="min-h-11" label="Reconnect Google" />
      </div>

      <ProAlert v-else-if="picker._tag === 'Failed'" color="warning" title="Your Search Console properties could not load" :description="picker.message" />

      <div v-else-if="picker._tag === 'NoProperties'" class="space-y-3 rounded-lg border border-dashed border-default p-4" data-testid="gsc-empty-state">
        <div class="space-y-1">
          <p class="text-sm font-medium text-highlighted break-words">
            {{ noPropertiesTitle }}
          </p>
          <p class="text-sm text-muted">
            Add your site in Search Console and verify it, then refresh this list. If a different Google account owns the property, connect that account.
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            to="https://search.google.com/search-console"
            target="_blank"
            rel="noopener"
            external
            color="neutral"
            variant="subtle"
            trailing-icon="i-heroicons-arrow-top-right-on-square"
            class="min-h-11"
            label="Open Search Console"
          />
          <UButton :to="gscConnectUrl" external color="neutral" variant="ghost" class="min-h-11" label="Connect another Google account" />
        </div>
        <ULink
          to="https://support.google.com/webmasters/answer/9008080"
          target="_blank"
          rel="noopener"
          class="inline-flex items-center gap-1 text-sm text-muted underline"
        >
          How to verify a site
        </ULink>
      </div>

      <p v-else-if="picker._tag === 'AllConnected'" class="text-sm text-muted">
        Every property in this Google account is already connected. Add another site in Search Console, then refresh this list.
      </p>

      <ul v-else class="space-y-2">
        <li
          v-for="property in picker.properties"
          :key="property.siteUrl"
          class="flex items-center gap-3 rounded-lg border border-default px-3 py-2"
          data-testid="gsc-property"
        >
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm text-highlighted">
              {{ property.domain }}
            </div>
            <div v-if="!property.verified" class="text-xs text-warning">
              Not verified for this Google account. Verify it in Search Console, then refresh this list.
            </div>
          </div>
          <UButton
            color="neutral"
            variant="subtle"
            size="sm"
            class="min-h-11 shrink-0"
            label="Connect"
            :aria-label="`Connect ${property.domain}`"
            :loading="submitting === property.domain"
            :disabled="!property.verified || atLimit || !!submitting"
            @click="connect(property.siteUrl, 'list')"
          />
        </li>
      </ul>
    </section>

    <form v-if="showAddressField" class="space-y-2" @submit.prevent="connect(url, 'field')">
      <UFormField label="Site address" help="For a subdomain of one of your properties, type its address." :error="fieldError">
        <div class="flex flex-col gap-2 sm:flex-row">
          <UInput
            v-model="url"
            placeholder="blog.example.com"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
            class="w-full"
            :disabled="atLimit"
          />
          <UButton
            type="submit"
            color="primary"
            size="lg"
            class="min-h-11 shrink-0"
            label="Connect"
            :loading="!!submitting && !!url.trim()"
            :disabled="!url.trim() || !!typedError || atLimit || !!submitting"
          />
        </div>
      </UFormField>
    </form>

    <p v-if="cappedAllowance && !atLimit" class="text-xs text-muted">
      {{ siteAllowanceSummary(cappedAllowance.used, cappedAllowance.allowance) }}
    </p>
  </div>
</template>
