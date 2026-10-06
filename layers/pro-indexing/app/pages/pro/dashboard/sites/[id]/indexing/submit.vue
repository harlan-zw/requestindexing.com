<script lang="ts" setup>
import type { GoogleSubmissionReceiptV1 } from '@gscdump/contracts/v1'

import type { GscdumpV1OperationResponse } from '@gscdump/sdk/v1'
import type { UiTableColumn } from '#layers/design-system/app/shared/table'
import type { GscdumpIndexingUrl } from '#layers/pro-gsc/shared/gscdump-api'
import type { IndexingGrantRefusal, SubmissionAttempt } from '#layers/pro-indexing/app/utils/indexing-grant'
import type { SiteIndexingGrant } from '#layers/pro-indexing/shared/contracts/indexing-grant'
import { GOOGLE_SUBMISSION_SITE_DAILY_LIMIT } from '@gscdump/contracts/v1'
import { nanoid } from 'nanoid'
import { h } from 'vue'
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'
import { UiStatusBadge, UiUrlLabel } from '#components'
import { useProGscdumpIndexingUrls } from '#layers/pro-gsc/app/composables/useProGscdump'
import { useGscdumpQuery } from '#layers/pro-gsc/app/composables/useProGscdump/_internal'
import IndexingChannelsCard from '#layers/pro-indexing/app/internal/components/indexing/IndexingChannelsCard.vue'
import { attemptAfterReceipt, describeReceipt, describeSubmissionRefusal, readIndexingGrantRefusal, readSubmissionRefusal, resolveSubmitAction, submissionAttemptFor } from '#layers/pro-indexing/app/utils/indexing-grant'
import { INDEXING_API_UNAVAILABLE } from '#layers/pro-indexing/shared/indexing-copy'

definePageMeta({
  proTab: { feature: 'indexing', label: 'Submit to Google', icon: 'i-ph-check-circle-duotone', order: 40 },
  title: 'Submit to Google',
  icon: 'i-ph-check-circle-duotone',
})

// The product's namesake action: hand one URL to Google's Indexing API.
// gscdump holds the grant, applies the limits and keeps the receipts
// (gscdump.com ADR-0016); this page explains them.
const { siteId, siteName, gscdumpSiteId, site } = useSite('Submit to Google')
const { isAdmin } = useCaller()
const teamPolicy = useTeamPolicy(() => site.value?.teamId)
const canWrite = computed(() => isAdmin.value || teamPolicy.can('write-data'))

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
    | { _tag: 'Ok', receipt: GoogleSubmissionReceiptV1 }
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

// Submission sends with the Indexing API grant of the account that linked the
// Site, which the Search Console connect never writes. It can differ from the
// caller's own grant, so this reads the Site's. Without it the only action
// that can work is the grant, so it takes the Submit button's place.
const { data: grant, error: grantError } = useFetch<SiteIndexingGrant>(() => `/api/sites/${siteId.value}/indexing/google-grant`, { key: () => `indexing-grant:${siteId.value}` })
// The grant asks the person to read what the API is for before Google asks
// for consent. Overuse can make Google block it for every user.
const intentConfirmed = ref(false)

const engineId = computed(() => gscdumpSiteId.value ?? undefined)
const receipts = useGscdumpQuery<GscdumpV1OperationResponse<'partner.sites.indexing.google.submissions.list'>['data']>(
  () => `google-submissions:${engineId.value ?? ''}`,
  engineId,
  (siteId, client) => client.listSiteGoogleSubmissionReceipts({ params: { siteId }, query: { limit: 20, offset: 0 } }, true),
  [],
)
const receiptRows = computed(() => receipts.data.value?.submissionReceipts ?? [])

// The Pacific day is the one gscdump counts the daily limit in.
const pacificDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' })
const submissionsLeft = computed(() => {
  const today = pacificDay.format(new Date())
  const usedToday = receiptRows.value.filter(receipt => pacificDay.format(new Date(receipt.createdAt)) === today).length
  return Math.max(0, GOOGLE_SUBMISSION_SITE_DAILY_LIMIT - usedToday)
})
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

// A retry of the same URL reuses its key, so gscdump does not count it twice.
let attempt: SubmissionAttempt | undefined

async function submitForIndexing() {
  if (submitAction.value._tag !== 'Submit')
    return
  const target = parseAbsoluteUrl(url.value)
  if (!target) {
    lastSubmit.value = { _tag: 'Err', message: 'Enter a full URL, including https:// and the page path.' }
    return
  }

  const current = submissionAttemptFor(attempt, target.toString(), nanoid)
  attempt = current
  submitting.value = true
  const result = await getAppFetch()<GoogleSubmissionReceiptV1>(`/api/sites/${siteId.value}/indexing/google-submissions`, {
    method: 'POST',
    body: { url: current.url, idempotencyKey: current.idempotencyKey },
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
    const refused = readSubmissionRefusal(result.error)
    const message = refused ? describeSubmissionRefusal(refused) : errorMessage(result.error)
    lastSubmit.value = { _tag: 'Err', message }
    toast.add({ title: 'URL not submitted', description: message, color: 'error' })
    return
  }

  const receipt = result.response
  attempt = attemptAfterReceipt(current, receipt)
  if (receipt._tag === 'rejected' && receipt.reason === 'reauthorization-required')
    grantRefusal.value = 'rejected'
  lastSubmit.value = { _tag: 'Ok', receipt }
  toast.add({ title: receipt._tag === 'accepted' ? 'Notification accepted' : 'URL not accepted', description: describeReceipt(receipt), color: receipt._tag === 'accepted' ? 'success' : 'error' })
  void receipts.refresh()
}

const receiptLabels: Record<GoogleSubmissionReceiptV1['_tag'], string> = { accepted: 'Accepted', rejected: 'Refused', failed: 'No answer' }
function receiptStatus(receipt: GoogleSubmissionReceiptV1) {
  return receipt._tag === 'accepted' ? 'success' as const : 'error' as const
}
const timeFormatter = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' })

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
              pages only. For other pages, Google may ignore the notification.
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
            :to="intentConfirmed ? submitAction.to : undefined"
            external
            purpose="cta"
            icon="key"
            class="min-h-11"
            :disabled="!intentConfirmed"
          >
            Grant Indexing API access
          </UiButton>
          <UiButton
            v-else
            type="submit"
            purpose="cta"
            :loading="submitting"
            :disabled="!url.trim() || submitAction._tag !== 'Submit' || !canWrite || submissionsLeft === 0"
            class="min-h-11"
          >
            Submit URL
          </UiButton>
        </form>

        <div v-if="submitAction._tag === 'GrantAccess'" class="mt-4 max-w-2xl space-y-3 rounded-md border border-default p-4 text-sm">
          <p class="text-default">
            Submit a page only when it is new or changed and is not indexed yet.
            If people overuse the Indexing API, Google can block it for every
            Request Indexing user.
          </p>
          <UCheckbox v-model="intentConfirmed" label="I will submit only pages I own that are new or changed." />
        </div>
        <UiAlert v-else-if="submitAction._tag === 'Unavailable'" status="info" :title="INDEXING_API_UNAVAILABLE" class="mt-4">
          <template #action>
            <UiButton purpose="secondary" :to="`/pro/dashboard/sites/${siteId}/indexing/indexnow`">
              Submit with IndexNow
            </UiButton>
          </template>
        </UiAlert>
        <p v-else-if="engineId && canWrite" class="mt-3 text-sm text-muted">
          {{ submissionsLeft }} of {{ GOOGLE_SUBMISSION_SITE_DAILY_LIMIT }} Google Submissions left today for this Site.
        </p>
        <p v-else-if="engineId" class="mt-3 text-sm text-muted">
          Your Team role allows viewing only.
        </p>

        <p v-if="submitAction._tag === 'GrantAccess' && submitAction.cause === 'rejected'" class="mt-3 text-sm text-error">
          Google no longer accepts the Indexing API access this Site uses. This app did not send the URL. The Google account that linked this Site must grant access again.
        </p>
        <p v-else-if="submitAction._tag === 'GrantAccess'" class="mt-3 text-sm text-muted">
          Submissions for this Site use the Indexing API access of the Google account that linked it to Search Console. If that is your account, grant access, then you return to this page.
        </p>
        <p v-else-if="lastSubmit._tag === 'Err'" class="mt-3 text-sm text-error">
          {{ lastSubmit.message }}
        </p>
        <p v-else-if="lastSubmit._tag === 'Ok'" class="mt-3 text-sm" :class="lastSubmit.receipt._tag === 'accepted' ? 'text-muted' : 'text-error'">
          {{ describeReceipt(lastSubmit.receipt) }}
        </p>
      </UiCard>
    </ProPageZone>

    <ProPageZone v-if="engineId" tier="secondary">
      <UiCard title="Your Submissions" size="sm">
        <p v-if="receipts.error.value" class="text-sm text-error">
          Your Submissions could not load. Retry to read the latest outcomes.
        </p>
        <UiSkeleton v-else-if="(receipts.status.value === 'idle' || receipts.status.value === 'pending') && !receipts.data.value" :lines="3" :base="240" :range="80" />
        <p v-else-if="!receiptRows.length" class="text-sm text-muted">
          No Submissions yet. Each URL you submit appears here with Google's answer.
        </p>
        <ul v-else class="divide-y divide-default">
          <li v-for="receipt in receiptRows" :key="receipt.id" class="py-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <UiUrlLabel :url="receipt.url" class="max-w-md" />
              <div class="flex items-center gap-3">
                <UiStatusBadge :status="receiptStatus(receipt)" :label="receiptLabels[receipt._tag]" size="sm" />
                <time :datetime="receipt.createdAt" class="text-sm tabular-nums text-muted">{{ timeFormatter.format(new Date(receipt.createdAt)) }}</time>
              </div>
            </div>
            <p v-if="receipt._tag !== 'accepted'" class="mt-1 text-sm text-muted">
              {{ describeReceipt(receipt) }}
            </p>
          </li>
        </ul>
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
          <UiSkeleton v-else-if="(historyStatus === 'idle' || historyStatus === 'pending') && !historyRows.length" :lines="4" :base="240" :range="80" />
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
            <p>Each Site can send {{ GOOGLE_SUBMISSION_SITE_DAILY_LIMIT }} Submissions a day. After Google accepts a URL, you can submit it again after 7 days.</p>
          </div>
        </UiCard>
      </ProSecondaryGrid>
    </ProPageZone>

    <ProPageZone tier="secondary">
      <IndexingChannelsCard current="google" :site-id="siteId" />
    </ProPageZone>
  </ProPageStates>
</template>
