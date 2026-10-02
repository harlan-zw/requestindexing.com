<script setup lang="ts">
import type { IndexNowConnectionV1, IndexNowSubmissionReceiptV1 } from '@gscdump/contracts/v1/http'
import type { GscdumpV1OperationResponse } from '@gscdump/sdk/v1'
import { indexNowConfigureV1Schema, indexNowKeyV1Schema, indexNowSubmitV1Schema } from '@gscdump/contracts/v1/http'
import { isGscdumpV1Error } from '@gscdump/sdk/v1'
import { useMounted } from '@vueuse/core'
import { customAlphabet, nanoid } from 'nanoid'
import { useGscdumpQuery } from '#layers/pro-gsc/app/composables/useProGscdump/_internal'
import { useProGscdump } from '#layers/pro-gsc/app/composables/useProGscdump/useProGscdump'
import IndexingChannelsCard from '#layers/pro-indexing/app/internal/components/indexing/IndexingChannelsCard.vue'

definePageMeta({
  proTab: { feature: 'indexing', label: 'IndexNow', icon: 'i-ph-paper-plane-tilt-duotone', order: 45 },
  title: 'IndexNow',
})

const { siteId, gscdumpSiteId, site } = useSite('IndexNow')
const engineId = computed(() => gscdumpSiteId.value ?? undefined)
const gscdump = useProGscdump()
const { isAdmin } = useCaller()
const teamPolicy = useTeamPolicy(() => site.value?.teamId)
const canWrite = computed(() => isAdmin.value || teamPolicy.can('write-data'))
const key = ref('')
const savedKey = ref('')
const createKey = customAlphabet('0123456789abcdef', 32)
const downloadableKey = computed(() => {
  const draft = key.value.trim()
  if (!draft)
    return savedKey.value
  return indexNowKeyV1Schema.safeParse(draft).success ? draft : ''
})
const keyFileUrl = computed(() => downloadableKey.value ? `data:text/plain;charset=utf-8,${encodeURIComponent(downloadableKey.value)}` : '')
const keyLocation = ref('')
const urlInput = ref('')
const urls = computed(() => [...new Set(urlInput.value.split(/\r?\n/).map(url => url.trim()).filter(Boolean))])
const receiptOffset = ref(0)
const mounted = useMounted()

const connection = useGscdumpQuery<IndexNowConnectionV1>(
  () => `indexnow:connection:${engineId.value ?? ''}`,
  engineId,
  (siteId, client) => client.getSiteIndexNowConnection({ params: { siteId } }, true),
  [],
)
const receipts = useGscdumpQuery<GscdumpV1OperationResponse<'partner.sites.indexing.indexnow.submissions.list'>['data']>(
  () => `indexnow:receipts:${engineId.value ?? ''}:${receiptOffset.value}`,
  engineId,
  (siteId, client) => client.listSiteIndexNowSubmissionReceipts({ params: { siteId }, query: { limit: 20, offset: receiptOffset.value } }, true),
  [receiptOffset],
)
const setup = computed(() => connection.data.value)
const defaultKeyLocation = computed(() => setup.value && key.value.trim()
  ? `https://${setup.value.host}/${key.value.trim()}.txt`
  : '')
const publishedKeyLocation = computed(() => setup.value && setup.value._tag !== 'disconnected' ? setup.value.keyLocation : null)
const setupChanged = computed(() => Boolean(key.value.trim()) || (Boolean(keyLocation.value.trim()) && keyLocation.value.trim() !== publishedKeyLocation.value))
const canSubmit = computed(() => canWrite.value && setup.value?._tag === 'connected' && !connection.error.value && !setupChanged.value && urls.value.length > 0 && urls.value.length <= 1000)

// A repeated attempt for the same batch keeps its key after a network failure.
// Editing the batch produces a fresh key, so the engine can deduplicate retries.
let batch: { fingerprint: string, idempotencyKey: string } | undefined

type ActionState
  = | { _tag: 'idle' }
    | { _tag: 'busy', action: 'save' | 'verify' | 'submit' }
    | { _tag: 'error', message: string }
    | { _tag: 'message', message: string }
const action = ref<ActionState>({ _tag: 'idle' })
const busy = computed(() => action.value._tag === 'busy')

function generateKey() {
  if (!canWrite.value || busy.value)
    return
  key.value = createKey()
  action.value = { _tag: 'idle' }
}

const reasonMessages: Record<string, string> = {
  'invalid-key-location': 'The key location must use HTTPS on this host. Check its address, then save the key.',
  'key-file-unavailable': 'The key file is unavailable. Publish it at the key location, then verify again.',
  'key-file-empty': 'The key file is empty. Add your key to the file, then verify again.',
  'key-file-too-large': 'The key file contains too much data. Keep only your key, then verify again.',
  'key-file-mismatch': 'The key file does not match your saved key. Replace its contents, then verify again.',
  'key-file-unreachable': 'The key file could not be reached. Check its public access, then verify again.',
  'key-unavailable': 'The saved key could not be read. Save your key again, then verify it.',
  'connection-changed': 'The key changed after submission. Verify your current key before submitting again.',
  'retry-budget-exhausted': 'IndexNow could not accept the notification after several attempts. Check your setup before submitting again.',
  'invalid-key': 'IndexNow rejected the key. Check the key file, then verify it again.',
  'invalid-request': 'IndexNow rejected the notification. Check the submitted URLs and key location.',
  'rate-limited': 'IndexNow limited this submission. Check the receipt outcome before submitting again.',
  'service-unavailable': 'IndexNow is unavailable. Check the receipt outcome before submitting again.',
  'network-error': 'The engine could not reach IndexNow. Check the receipt outcome before submitting again.',
  'unexpected-response': 'IndexNow returned an unexpected response. Check the receipt outcome before submitting again.',
  'key-validation-pending': 'IndexNow is checking the key. Refresh receipts later.',
}

function reasonMessage(reason: string) {
  return reasonMessages[reason] ?? 'IndexNow could not finish this action. Check your setup, then retry.'
}

function errorMessage(error: unknown): string {
  return isGscdumpV1Error(error) ? (reasonMessages[error.message] ?? error.message) : 'IndexNow could not respond. Retry the action.'
}

const receiptLabels: Record<IndexNowSubmissionReceiptV1['_tag'], string> = {
  queued: 'Queued',
  accepted: 'Notification accepted',
  pending: 'Key validation pending',
  rejected: 'Rejected',
  retrying: 'Retry scheduled',
  failed: 'Failed',
}

async function saveKey() {
  const siteId = engineId.value
  if (!siteId || !canWrite.value || busy.value || !key.value.trim())
    return
  const draft = { key: key.value, keyLocation: keyLocation.value }
  const parsed = indexNowConfigureV1Schema.safeParse({ key: key.value.trim(), ...(keyLocation.value.trim() ? { keyLocation: keyLocation.value.trim() } : {}) })
  if (!parsed.success) {
    action.value = { _tag: 'error', message: parsed.error.issues.some(issue => issue.path[0] === 'key')
      ? 'Use 8 to 128 letters, numbers, or hyphens for the key.'
      : 'The key location must use HTTPS. Check its address before saving.' }
    return
  }
  action.value = { _tag: 'busy', action: 'save' }
  const result = await gscdump.configureSiteIndexNowConnection({
    params: { siteId },
    body: parsed.data,
  }, true).then(data => ({ _tag: 'ok' as const, data })).catch((error: unknown) => ({ _tag: 'error' as const, error }))
  if (engineId.value !== siteId)
    return
  if (result._tag === 'error') {
    action.value = { _tag: 'error', message: errorMessage(result.error) }
    return
  }
  connection.data.value = result.data
  savedKey.value = parsed.data.key
  if (key.value === draft.key && keyLocation.value === draft.keyLocation) {
    key.value = ''
    keyLocation.value = result.data._tag === 'disconnected' ? '' : result.data.keyLocation
  }
  action.value = { _tag: 'message', message: 'Key saved. Publish the key file, then verify it.' }
}

async function verifyKey() {
  const siteId = engineId.value
  if (!siteId || !canWrite.value || busy.value || !publishedKeyLocation.value || setupChanged.value)
    return
  action.value = { _tag: 'busy', action: 'verify' }
  const result = await gscdump.verifySiteIndexNowConnection({ params: { siteId } }, true)
    .then(data => ({ _tag: 'ok' as const, data }))
    .catch((error: unknown) => ({ _tag: 'error' as const, error }))
  if (engineId.value !== siteId)
    return
  if (result._tag === 'error') {
    action.value = { _tag: 'error', message: errorMessage(result.error) }
    return
  }
  connection.data.value = result.data
  action.value = result.data._tag === 'connected'
    ? { _tag: 'message', message: 'Key verified. You can submit URLs.' }
    : { _tag: 'error', message: result.data._tag === 'verification-required' && result.data.reason ? reasonMessage(result.data.reason) : 'Key verification failed. Check the published file, then verify it again.' }
}

async function submitUrls() {
  const siteId = engineId.value
  if (!siteId || !canWrite.value || busy.value || !canSubmit.value)
    return
  const draft = urlInput.value
  const fingerprint = JSON.stringify(urls.value)
  if (batch?.fingerprint !== fingerprint)
    batch = { fingerprint, idempotencyKey: nanoid() }
  const parsed = indexNowSubmitV1Schema.safeParse({ urls: urls.value, idempotencyKey: batch.idempotencyKey })
  if (!parsed.success) {
    action.value = { _tag: 'error', message: 'Each URL must include its full address. Check the URLs before submitting.' }
    return
  }
  action.value = { _tag: 'busy', action: 'submit' }
  const result = await gscdump.submitSiteIndexNow({ params: { siteId }, body: parsed.data }, true)
    .then(data => ({ _tag: 'ok' as const, data }))
    .catch((error: unknown) => ({ _tag: 'error' as const, error }))
  if (engineId.value !== siteId)
    return
  if (result._tag === 'error') {
    action.value = { _tag: 'error', message: errorMessage(result.error) }
    return
  }
  action.value = { _tag: 'message', message: `Submission recorded: ${receiptLabels[result.data.submissionReceipt._tag]}.` }
  if (urlInput.value === draft)
    urlInput.value = ''
  batch = undefined
  receiptOffset.value = 0
  await refreshIndexNow()
}

async function refreshIndexNow() {
  await Promise.all([connection.refresh(), receipts.refresh()])
}

watch(engineId, () => {
  key.value = ''
  keyLocation.value = ''
  urlInput.value = ''
  batch = undefined
  receiptOffset.value = 0
  action.value = { _tag: 'idle' }
})

function receiptColor(receipt: IndexNowSubmissionReceiptV1) {
  if (receipt._tag === 'accepted')
    return 'success' as const
  if (receipt._tag === 'rejected' || receipt._tag === 'failed')
    return 'error' as const
  return 'neutral' as const
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
</script>

<template>
  <ProPageStates>
    <ProPageZone tier="primary" first>
      <!-- Evidence: INDEXNOW-01 and INDEXNOW-02 in VERIFIED-CLAIMS.md. -->
      <p class="mb-4 max-w-2xl text-base text-muted">
        IndexNow notifies Bing and other participating search engines about new or changed URLs. Google is not one of them.
      </p>
      <UiCard v-if="!engineId" size="lg">
        <p class="text-base text-muted">
          Connect this Site before setting up IndexNow.
        </p>
      </UiCard>
      <UiCard v-else-if="connection.error.value" size="lg">
        <p class="text-base text-error">
          IndexNow setup could not load. Retry to read the engine state.
        </p>
        <UiButton purpose="secondary" class="mt-3 min-h-11" @click="connection.refresh()">
          Retry loading
        </UiButton>
      </UiCard>
      <UiSkeleton v-else-if="!setup" :lines="4" :base="240" :range="80" />
      <UiCard v-else title="Verify your IndexNow key" size="lg">
        <p v-if="!canWrite" class="mb-3 text-base text-muted">
          Your Team role allows viewing only.
        </p>
        <p class="text-base text-muted">
          Publish a UTF-8 text file containing only your key at the key location.
        </p>
        <p class="mt-2 break-all text-base text-default">
          {{ setup.host }}
        </p>
        <form class="mt-5 space-y-4" @submit.prevent="saveKey">
          <div class="grid gap-4 md:grid-cols-2">
            <UFormField label="IndexNow key" description="Use 8 to 128 letters, numbers, or hyphens. Generate a key if you do not have one.">
              <UiInput v-model="key" autocomplete="off" class="w-full" :ui="{ base: 'min-h-11 text-base' }" />
            </UFormField>
            <UFormField label="Key location" hint="Optional" :description="defaultKeyLocation || undefined" :ui="{ description: 'text-muted' }">
              <UiInput v-model="keyLocation" type="url" class="w-full" :placeholder="defaultKeyLocation || publishedKeyLocation || undefined" :ui="{ base: 'min-h-11 text-base' }" />
            </UFormField>
          </div>
          <div class="flex flex-wrap gap-3">
            <UiButton purpose="secondary" class="min-h-11" :disabled="!canWrite || busy" @click="generateKey">
              Generate key
            </UiButton>
            <UiButton v-if="downloadableKey" purpose="secondary" class="min-h-11" :to="keyFileUrl" :download="`${downloadableKey}.txt`" external>
              Download key file
            </UiButton>
            <UiButton type="submit" purpose="cta" class="min-h-11" :disabled="!canWrite || busy || !key.trim()" :loading="action._tag === 'busy' && action.action === 'save'">
              Save key
            </UiButton>
            <UiButton purpose="secondary" class="min-h-11" :disabled="!canWrite || busy || !publishedKeyLocation || setupChanged" :loading="action._tag === 'busy' && action.action === 'verify'" @click="verifyKey">
              Verify key
            </UiButton>
            <UBadge v-if="setup._tag === 'connected'" color="success" variant="subtle">
              Key verified
            </UBadge>
          </div>
        </form>
        <p v-if="downloadableKey" class="mt-3 text-base text-muted">
          Download the key file, publish it at the key location, then save and verify the key.
        </p>
        <p v-if="publishedKeyLocation" class="mt-4 break-all text-base text-muted">
          Key location: {{ publishedKeyLocation }}
        </p>
        <p v-if="setup._tag === 'verification-required' && setup.reason" class="mt-3 text-base text-error">
          {{ reasonMessage(setup.reason) }}
        </p>
      </UiCard>
      <p v-if="action._tag === 'error' || action._tag === 'message'" role="status" class="mt-3 text-base" :class="action._tag === 'error' ? 'text-error' : 'text-muted'">
        {{ action.message }}
      </p>
    </ProPageZone>

    <ProPageZone v-if="engineId && setup" tier="secondary">
      <UiCard size="lg">
        <form class="space-y-4" @submit.prevent="submitUrls">
          <UFormField label="URLs, one per line" description="Submit up to 1,000 new or changed URLs on this host." :ui="{ description: 'text-muted' }">
            <UTextarea v-model="urlInput" :rows="6" class="w-full" :ui="{ base: 'text-base' }" />
          </UFormField>
          <p v-if="setup._tag !== 'connected' || setupChanged" class="text-base text-muted">
            Verify your key before submitting URLs.
          </p>
          <p v-if="urls.length > 1000" class="text-base text-error">
            This batch exceeds 1,000 URLs. Split it before submitting.
          </p>
          <UiButton type="submit" purpose="cta" class="min-h-11" :disabled="busy || !canSubmit" :loading="action._tag === 'busy' && action.action === 'submit'">
            Submit URLs<span v-if="urls.length"> ({{ urls.length }})</span>
          </UiButton>
        </form>
      </UiCard>
    </ProPageZone>

    <ProPageZone v-if="engineId" tier="secondary">
      <UiCard title="Submission receipts" size="lg">
        <p class="mb-4 text-base text-muted">
          A receipt records the notification outcome. Search engines decide whether to index each URL.
        </p>
        <UiButton purpose="secondary" class="mb-4 min-h-11" :loading="mounted && (connection.status.value === 'pending' || receipts.status.value === 'pending')" @click="refreshIndexNow()">
          Refresh receipts
        </UiButton>
        <p v-if="receipts.error.value" class="text-base text-error">
          Submission receipts could not load. Retry to read the latest outcomes.
        </p>
        <UiSkeleton v-else-if="(receipts.status.value === 'idle' || receipts.status.value === 'pending') && !receipts.data.value" :lines="3" :base="240" :range="80" />
        <div v-else-if="!receipts.data.value?.submissionReceipts.length">
          <p class="text-base text-default">
            No submission receipts yet
          </p>
          <p class="mt-2 text-base text-muted">
            Verify your key, then submit your new or changed URLs.
          </p>
        </div>
        <ul v-else class="divide-y divide-default">
          <li v-for="receipt in receipts.data.value.submissionReceipts" :key="receipt.id" class="py-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <UBadge :color="receiptColor(receipt)" variant="subtle">
                {{ receiptLabels[receipt._tag] }}
              </UBadge>
              <time :datetime="receipt.createdAt" class="text-sm tabular-nums text-muted">{{ formatDate(receipt.createdAt) }}</time>
            </div>
            <p v-if="receipt.reason" class="mt-2 text-base text-muted">
              {{ reasonMessage(receipt.reason) }}
            </p>
            <p v-if="receipt.retryAt" class="mt-2 text-base text-muted">
              Next attempt: {{ formatDate(receipt.retryAt) }}
            </p>
            <details class="mt-2">
              <summary class="flex min-h-11 cursor-pointer items-center text-base text-default focus-visible:outline-2 focus-visible:outline-primary">
                {{ receipt.urls.length }} URLs
              </summary>
              <ul class="space-y-2 text-sm text-muted">
                <li v-for="url in receipt.urls" :key="url" class="break-all">
                  {{ url }}
                </li>
              </ul>
            </details>
          </li>
        </ul>
        <div class="mt-4 flex flex-wrap gap-3">
          <UiButton v-if="receiptOffset > 0" purpose="secondary" class="min-h-11" :disabled="receipts.status.value === 'pending'" @click="receiptOffset -= 20">
            Newer receipts
          </UiButton>
          <UiButton v-if="receipts.data.value?.pagination.hasMore" purpose="secondary" class="min-h-11" :disabled="receipts.status.value === 'pending'" @click="receiptOffset += 20">
            Older receipts
          </UiButton>
        </div>
      </UiCard>
    </ProPageZone>

    <ProPageZone tier="secondary">
      <IndexingChannelsCard current="indexnow" :site-id="siteId" />
    </ProPageZone>
  </ProPageStates>
</template>
