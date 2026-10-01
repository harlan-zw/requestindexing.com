<script lang="ts" setup>
import type { UiTableColumn } from '#layers/design-system/app/shared/table'
import type { GscdumpIndexingUrl } from '#layers/pro-gsc/shared/gscdump-api'
import type { IndexingGrantRefusal } from '#layers/pro-indexing/app/utils/indexing-grant'
import type { IndexingGrant } from '#layers/pro-indexing/shared/contracts/indexing-grant'
import { h } from 'vue'
import { UiStatusBadge, UiUrlLabel } from '#components'
import { useProGscdumpIndexingUrls } from '#layers/pro-gsc/app/composables/useProGscdump'
import IndexingChannelsCard from '#layers/pro-indexing/app/internal/components/indexing/IndexingChannelsCard.vue'
import { readIndexingGrantRefusal, resolveSubmitAction } from '#layers/pro-indexing/app/utils/indexing-grant'

definePageMeta({
  proTab: { feature: 'indexing', label: 'Submit to Google', icon: 'i-ph-check-circle-duotone', order: 40 },
  title: 'Submit to Google',
  icon: 'i-ph-check-circle-duotone',
})

// The product's namesake action: hand a URL to Google's Indexing API through
// this account's pooled OAuth client. gscdump has no equivalent, so the server
// contract stays exactly as it was; only the page around it follows the
// indexing page conventions.
const { siteId, siteName, gscdumpSiteId } = useSite('Submit to Google')

const toast = useToast()
const route = useRoute()

// `sites.gscdumpSiteId` is nullable. Rendering the history table without it
// leaves a box that can never fill, so say so once instead.
const hasSyncedSite = computed(() => Boolean(gscdumpSiteId.value))

// Start the input on this site, so the common case is one path away.
const url = ref('')
watchEffect(() => {
  if (!url.value && siteName.value && siteName.value !== 'Site')
    url.value = `https://${siteName.value}/`
})
const submitting = ref(false)

type SubmitState
  = | { _tag: 'Idle' }
    | { _tag: 'Ok', url: string, status: string }
    | { _tag: 'Err', message: string }

const lastSubmit = ref<SubmitState>({ _tag: 'Idle' })

function parseAbsoluteUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed : null
  }
  catch {
    return null
  }
}

// Submission sends with the account's own Indexing API grant, which the
// Search Console connect never writes. Without it the only action that can
// work is the grant, so it takes the Submit button's place.
const { data: grant, error: grantError } = useFetch<IndexingGrant>('/api/indexing/auth', { key: 'indexing-grant' })
const grantRefusal = ref<IndexingGrantRefusal | null>(null)
const submitAction = computed(() => resolveSubmitAction({
  grant: grant.value ?? null,
  grantUnavailable: !!grantError.value,
  refusal: grantRefusal.value,
  returnTo: route.fullPath,
}))

function errorMessage(error: unknown): string {
  const e = error as { statusMessage?: string, data?: { statusMessage?: string, message?: string }, message?: string }
  return e?.data?.statusMessage || e?.statusMessage || e?.data?.message || e?.message || 'The URL was not submitted. Try again in a few minutes.'
}

// Submission history: the URLs Google has inspected most recently, so a reader
// can see whether a request has landed yet.
const { data: historyData, status: historyStatus, error: historyError, refresh: refreshHistory } = useProGscdumpIndexingUrls(
  computed(() => gscdumpSiteId.value ?? ''),
  { limit: 10 },
)
const historyRows = computed(() => historyData.value?.urls ?? [])

async function submitForIndexing() {
  const target = parseAbsoluteUrl(url.value)
  if (!target) {
    lastSubmit.value = { _tag: 'Err', message: 'Enter a full URL, including https:// and the page path.' }
    return
  }

  submitting.value = true
  const result = await $fetch<{ status: string, url: string }>(`/api/indexing/${encodeURIComponent(target.toString())}`, {
    method: 'POST',
    query: { siteId: siteId.value },
  })
    .then(response => ({ _tag: 'Ok' as const, response }))
    .catch((error: unknown) => ({ _tag: 'Err' as const, error }))
  submitting.value = false

  if (result._tag === 'Err') {
    // A grant refusal gets the grant action beside the field, not a dead end.
    const refusal = readIndexingGrantRefusal(result.error)
    if (refusal) {
      grantRefusal.value = refusal
      lastSubmit.value = { _tag: 'Idle' }
      return
    }
    const message = errorMessage(result.error)
    lastSubmit.value = { _tag: 'Err', message }
    toast.add({ title: 'Submission failed', description: message, color: 'error' })
    return
  }

  const notice = result.response.status === 'already-submitted'
    ? { title: 'Already submitted', status: 'Google was already told about this URL in the last 48 hours.' }
    : { title: 'URL submitted', status: 'Google was told this URL changed. Indexing can still take a few days.' }
  lastSubmit.value = { _tag: 'Ok', url: target.toString(), status: notice.status }
  toast.add({ title: notice.title, description: notice.status, color: 'success' })
  void refreshHistory()
}

const dateFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium' })

function formatDate(value: string | null | undefined): string {
  if (!value)
    return 'Never'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Unknown' : dateFormatter.format(date)
}

function verdictStatus(verdict: string | null) {
  if (verdict === 'PASS')
    return 'success' as const
  if (verdict === 'FAIL')
    return 'error' as const
  if (verdict === 'PARTIAL')
    return 'warning' as const
  return 'neutral' as const
}

function headerCell(label: string) {
  return () => h('span', { class: 'text-[11px] font-semibold uppercase tracking-[0.1em] text-muted' }, label)
}

type HistoryRow = GscdumpIndexingUrl & { id: string }

const columns: UiTableColumn<HistoryRow>[] = [
  {
    accessorKey: 'url',
    header: headerCell('URL'),
    cell: ({ row }) => h(UiUrlLabel, { url: row.original.url, class: 'max-w-md' }),
  },
  {
    accessorKey: 'verdict',
    header: headerCell('Verdict'),
    cell: ({ row }) => h(UiStatusBadge, {
      status: verdictStatus(row.original.verdict),
      label: row.original.verdict ?? 'Unknown',
      size: 'sm',
    }),
  },
  {
    accessorKey: 'lastCrawlTime',
    header: headerCell('Last crawl'),
    align: 'right',
    cell: ({ row }) => h('span', { class: 'text-sm tabular-nums text-muted' }, formatDate(row.original.lastCrawlTime)),
  },
]

const tableData = computed(() => historyRows.value.map((row, index) => ({
  ...row,
  id: row.url || String(index),
})))

const urlsRoute = computed(() => `/pro/dashboard/sites/${siteId.value}/indexing/urls`)
</script>

<template>
  <ProPageStates>
    <ProPageZone tier="primary" first>
      <UiCard emphasis size="lg">
        <div class="min-w-0">
          <h2 class="text-2xl font-strong text-default">
            Tell Google a page changed
          </h2>
          <p class="mt-2 max-w-2xl text-sm text-muted">
            This sends one URL to Google's Indexing API. Google decides whether
            to crawl it, and when.
          </p>
          <!-- A warning, never a gate: the person decides which URLs to send.
               Evidence: GOOGLE-01 in VERIFIED-CLAIMS.md. -->
          <p class="mt-3 flex max-w-2xl gap-2 text-sm text-default">
            <UiIcon name="warning" class="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <span>
              Google documents the Indexing API for job posting and livestream
              pages only. Check your page type before you submit.
            </span>
          </p>
        </div>

        <form class="mt-5 flex flex-wrap items-end gap-3 border-t border-default pt-5" @submit.prevent="submitForIndexing">
          <UFormField label="Page URL" class="min-w-0 grow">
            <UiInput
              v-model="url"
              class="w-full"
              type="url"
              autocomplete="off"
              placeholder="https://example.com/blog/my-post"
            />
          </UFormField>
          <UiButton
            v-if="submitAction._tag === 'GrantAccess'"
            :to="submitAction.to"
            external
            purpose="cta"
            icon="key"
            class="min-h-11"
          >
            Grant Indexing API access
          </UiButton>
          <UiButton
            v-else
            type="submit"
            purpose="cta"
            :loading="submitting"
            :disabled="!url.trim() || submitAction._tag === 'Checking'"
            class="min-h-11"
          >
            Submit URL
          </UiButton>
        </form>

        <p v-if="submitAction._tag === 'GrantAccess' && submitAction.cause === 'rejected'" class="mt-3 text-sm text-error">
          Google no longer accepts this app's Indexing API access. This app did not send the URL. Grant access again, then submit the URL.
        </p>
        <p v-else-if="submitAction._tag === 'GrantAccess'" class="mt-3 text-sm text-muted">
          To submit a URL, this app needs Indexing API access from your Google account. After you grant access, you return to this page.
        </p>
        <p v-else-if="lastSubmit._tag === 'Err'" class="mt-3 text-sm text-error">
          {{ lastSubmit.message }}
        </p>
        <p v-else-if="lastSubmit._tag === 'Ok'" class="mt-3 text-sm text-muted">
          {{ lastSubmit.status }}
        </p>
      </UiCard>
    </ProPageZone>

    <ProPageZone tier="secondary">
      <ProSecondaryGrid layout="wide-narrow">
        <UiCard title="Recently inspected URLs" size="sm">
          <UiEmptyState
            v-if="!hasSyncedSite"
            compact
            icon="link"
            title="No indexing history yet"
            description="Connect this Site to Search Console to see whether Google crawled a URL you submitted."
          />
          <UiEmptyState
            v-else-if="historyError"
            compact
            icon="caution"
            title="Indexing history unavailable"
            description="Retry to load the latest inspection results."
          >
            <UiButton purpose="secondary" class="!min-h-11" @click="refreshHistory()">
              Retry
            </UiButton>
          </UiEmptyState>
          <UiSkeleton v-else-if="historyStatus === 'pending' && !historyRows.length" :lines="4" :base="240" :range="80" />
          <UiEmptyState
            v-else-if="!historyRows.length"
            compact
            icon="link"
            title="No inspected URLs yet"
            description="Inspection results appear after the first indexing sync finishes."
          />
          <template v-else>
            <UiTable
              :data="tableData"
              :columns="columns"
              label="Recently inspected URLs"
            />
            <UiButton :to="urlsRoute" purpose="link" trailing-icon="next" class="mt-3 min-h-11">
              View every inspected URL
            </UiButton>
          </template>
        </UiCard>

        <UiCard title="How this works" variant="subtle" size="sm">
          <div class="space-y-2 text-sm text-muted">
            <p>A Submission tells Google that the page is new or changed. Google decides whether to index it.</p>
            <p>Indexing status comes from the Search Console URL Inspection API, re-checked on a schedule.</p>
            <p>If you submit the same URL twice within 48 hours, Google gets only the first notification.</p>
          </div>
        </UiCard>
      </ProSecondaryGrid>
    </ProPageZone>

    <ProPageZone tier="secondary">
      <IndexingChannelsCard current="google" :site-id="siteId" />
    </ProPageZone>
  </ProPageStates>
</template>
