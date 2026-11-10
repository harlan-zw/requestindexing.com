<script setup lang="ts">
import type { GscdumpV1OperationResponse } from '@gscdump/sdk/v1'
import { WATCHED_URL_CADENCE_DAYS, WATCHED_URL_LIMIT, watchedUrlsChangeRequestSchema } from '@gscdump/contracts'
import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import { parseGscdumpError } from '#layers/pro-gsc/app/composables/_gscdump-error'
import { useGscdumpQuery } from '#layers/pro-gsc/app/composables/useProGscdump/_internal'
import { useProGscdump } from '#layers/pro-gsc/app/composables/useProGscdump/useProGscdump'

definePageMeta({ title: 'Watched URLs', proTab: { feature: 'indexing', label: 'Watched URLs', icon: 'clock', order: 37 } })

const { gscdumpSiteId, site } = useSite('Watched URLs')
const { session } = useUserSession()
const recordScope = computed(() => JSON.stringify([gscdumpSiteId.value, session.value?.user?.id]))
const { isAdmin } = useCaller()
const policy = useTeamPolicy(() => site.value?.teamId)
const canWrite = computed(() => isAdmin.value || policy.can('write-data'))
const gscdump = useProGscdump()
type WatchedRecord = GscdumpV1OperationResponse<'partner.sites.indexing.watched.list'>['data']
// Nuxt clears AsyncData on errors. Keep successful evidence within its Site and user scope.
const observation = shallowRef<{ _tag: 'Empty' } | { _tag: 'Observed', scope: string, record: WatchedRecord }>({ _tag: 'Empty' })
let readSequence = 0
let active = true
const query = useGscdumpQuery<GscdumpV1OperationResponse<'partner.sites.indexing.watched.list'>['data']>(
  () => `gscdump:watched:${recordScope.value}`,
  () => session.value?.user ? gscdumpSiteId.value ?? undefined : undefined,
  async (id) => {
    const sequence = ++readSequence
    const scope = recordScope.value
    const record = await gscdump.listSiteWatchedUrls({ params: { siteId: id } }, true)
    if (active && sequence === readSequence && scope === recordScope.value)
      observation.value = { _tag: 'Observed', scope, record }
    return record
  },
  [],
)
const urls = ref('')
const consent = ref(false)
const pending = ref(false)
const removeUrl = ref<string | null>(null)
const message = ref('')
const failure = ref('')
let generation = 0
watch(recordScope, () => {
  generation++
  readSequence++
  observation.value = { _tag: 'Empty' }
  urls.value = ''
  consent.value = false
  removeUrl.value = null
  pending.value = false
  message.value = ''
  failure.value = ''
}, { flush: 'sync' })
onScopeDispose(() => {
  generation++
  readSequence++
  active = false
})
watch(query.error, (error) => {
  if (error && !parseGscdumpError(error).retry) {
    readSequence++
    observation.value = { _tag: 'Empty' }
  }
}, { flush: 'sync' })
const record = computed(() => observation.value._tag === 'Observed' && observation.value.scope === recordScope.value
  ? observation.value.record
  : null)
const cadence = computed(() => record.value?.cadenceDays ?? WATCHED_URL_CADENCE_DAYS)
const limit = computed(() => record.value?.limit ?? WATCHED_URL_LIMIT)
const skippedReasons = {
  domain_mismatch: 'The URL must use this Site host.',
  fragment: 'Remove the URL fragment.',
  limit_reached: 'The Site has reached its Watched URLs limit.',
  inspection_disabled: 'URL Inspection is disabled for this Site.',
} as const

async function change(kind: 'add' | 'remove') {
  const id = gscdumpSiteId.value
  if (!id || !canWrite.value || pending.value || (kind === 'add' && !consent.value))
    return
  const parsed = watchedUrlsChangeRequestSchema.safeParse({
    urls: kind === 'remove' ? [removeUrl.value] : [...new Set(urls.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean))],
  })
  failure.value = ''
  message.value = ''
  if (!parsed.success) {
    failure.value = `Enter 1 to ${WATCHED_URL_LIMIT} complete URLs, one per line.`
    return
  }
  pending.value = true
  const serial = generation
  const input = { params: { siteId: id }, body: parsed.data }
  const result = await (kind === 'add' ? gscdump.addSiteWatchedUrls(input, true) : gscdump.removeSiteWatchedUrls(input, true))
    .then(value => ({ _tag: 'Ok' as const, value }))
    .catch((error: unknown) => ({ _tag: 'Err' as const, error }))
  if (serial !== generation)
    return
  pending.value = false
  if (result._tag === 'Err') {
    failure.value = parseGscdumpError(result.error).message
    return
  }
  const value = result.value
  message.value = `${value.changed.length} ${value.changed.length === 1 ? 'URL' : 'URLs'} ${kind === 'add' ? 'added' : 'removed'}. ${value.unchanged.length} unchanged.`
  if (value.skipped.length) {
    failure.value = value.skipped.map(row => `${row.url}: ${skippedReasons[row.reason]}`).join('\n')
    urls.value = value.skipped.map(row => row.url).join('\n')
  }
  else if (kind === 'add') {
    urls.value = ''
    consent.value = false
  }
  removeUrl.value = null
  await query.refresh()
}
</script>

<template>
  <ProPageStates>
    <div class="max-w-4xl space-y-6">
      <p class="text-sm text-muted">
        Keep scheduled URL Inspection evidence for pages you choose. This does not request indexing.
      </p>
      <div v-if="query.error.value" role="alert" class="space-y-2">
        <p>{{ record ? 'The latest refresh failed. The last saved record stays visible.' : 'Watched URLs could not load. Retry to read the saved record.' }}</p>
        <UiButton purpose="secondary" class="min-h-11" @click="query.refresh()">
          Retry loading
        </UiButton>
      </div>
      <p v-if="query.status.value === 'pending' && !record" role="status">
        Loading Watched URLs
      </p>
      <form v-if="canWrite && record" class="space-y-3" @submit.prevent="change('add')">
        <UFormField label="URLs, one per line" name="urls">
          <UTextarea v-model="urls" :rows="3" class="w-full" :disabled="pending" />
        </UFormField>
        <p class="text-sm text-muted">
          {{ record.watched.length }} of {{ limit }} Watched URLs. New URLs are due for inspection immediately.
          Scheduled checks run every {{ cadence }} days, subject to available allowance and quota.
        </p>
        <label class="flex min-h-11 items-start gap-2 text-sm">
          <input v-model="consent" type="checkbox" class="mt-1" :disabled="pending">
          <span>Each scheduled URL Inspection uses my Free allowance and Google's daily quota.</span>
        </label>
        <UiButton purpose="cta" type="submit" class="min-h-11" :disabled="!consent || !urls.trim() || pending" :loading="pending">
          Watch URLs
        </UiButton>
      </form>
      <p v-else-if="!canWrite" class="text-sm text-muted">
        Your Team role allows viewing only.
      </p>
      <p v-if="message" role="status">
        {{ message }}
      </p>
      <p v-if="failure" role="alert" class="whitespace-pre-line text-sm">
        {{ failure }}
      </p>
      <p v-if="record && !record.watched.length" class="text-sm text-muted">
        No Watched URLs yet. Choose pages to keep a record of Google's reported index state.
      </p>
      <div v-for="row in record?.watched ?? []" :key="row.url" class="space-y-3 border-t border-default pt-4">
        <p class="break-all text-sm font-medium">
          {{ row.url }}
        </p>
        <p class="text-sm text-muted">
          Next scheduled check: <time :datetime="row.dueAt">{{ row.dueAt }}</time>
        </p>
        <p v-if="!row.checkpoints.length" class="text-sm text-muted">
          No scheduled URL Inspection recorded yet.
        </p>
        <details v-else>
          <summary class="min-h-11 cursor-pointer text-sm">
            {{ row.checkpoints.length }} {{ row.checkpoints.length === 1 ? 'Checkpoint' : 'Checkpoints' }}
          </summary>
          <ul class="space-y-2 text-sm">
            <li v-for="checkpoint in row.checkpoints" :key="checkpoint.checkedAt">
              <time :datetime="checkpoint.checkedAt">{{ checkpoint.checkedAt }}</time>:
              {{ checkpoint.googleCoverageState ?? checkpoint.coverageState }}
              <span class="text-muted"> · stored Google URL Inspection</span>
            </li>
          </ul>
        </details>
        <template v-if="canWrite">
          <div v-if="removeUrl === row.url" class="space-y-2">
            <p class="text-sm">
              This removes the URL and its Checkpoints. Stored URL Inspection results stay.
            </p>
            <UiButton purpose="secondary" class="min-h-11" :disabled="pending" @click="change('remove')">
              Confirm stop watching
            </UiButton>
            <UiButton purpose="secondary" class="min-h-11" :disabled="pending" @click="removeUrl = null">
              Cancel
            </UiButton>
          </div>
          <UiButton v-else purpose="secondary" class="min-h-11" :disabled="pending" @click="removeUrl = row.url">
            Stop watching
          </UiButton>
        </template>
      </div>
      <UiButton v-if="record" purpose="secondary" class="min-h-11" :disabled="pending || query.status.value === 'pending'" @click="query.refresh()">
        Refresh saved record
      </UiButton>
    </div>
  </ProPageStates>
</template>
