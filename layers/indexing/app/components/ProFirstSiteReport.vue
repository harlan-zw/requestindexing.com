<script setup lang="ts">
import type { FirstReportHold, FirstReportPreview, FirstReportResult, FirstReportSaved } from '#layers/indexing/shared/first-report'
import { useSessionStorage } from '@vueuse/core'
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'
import { FIRST_REPORT_COPY as copy, formatReportDate, verdictStatus } from '#layers/indexing/shared/first-report'

// The First Site report. It opens on the Site's saved Google verdicts, which
// spend no URL Inspection. gscdump inspects a new Site's sitemap URLs by
// itself, so a Site with no verdict yet shows the engine's URL Inspection
// phase. A fresh URL Inspection is offered only when the engine is not
// inspecting the Site, and only after the reader reviews the URLs and the cost.
const { siteId } = defineProps<{ siteId: string }>()
const { session } = useUserSession()
type Saved = { _tag: 'Loading' | 'Unavailable' } | FirstReportSaved
type Fresh = { _tag: 'Idle' | 'Loading' | 'Unavailable' | 'Changed' } | Exclude<FirstReportPreview | FirstReportResult, FirstReportHold>
type Row = Extract<FirstReportResult, { _tag: 'Results' }>['rows'][number]
const saved = ref<Saved>({ _tag: 'Loading' })
const fresh = ref<Fresh>({ _tag: 'Idle' })
const inspecting = ref(false)
const rereading = ref(false)
let request = 0
onScopeDispose(() => {
  request++
})
// An unknown URL Inspection outcome outlives this component. A Site change
// or a reload must not offer a second approval while that request may still
// finish. After 15 minutes the batch has finished or failed, so the hold ends.
const UNRESOLVED_FOR_MS = 15 * 60 * 1000
const unresolved = useSessionStorage<Record<string, number>>('first-report-unresolved', {})
const ready = computed(() => fresh.value._tag === 'Ready' ? fresh.value : null)
const canPreview = computed(() => ['Idle', 'Ready', 'Empty', 'Incomplete', 'Unavailable', 'Changed', 'Results'].includes(fresh.value._tag))
const rows = computed<Row[]>(() => {
  if (saved.value._tag === 'Verdicts')
    return saved.value.rows.map(evidence => ({ _tag: 'Evidence', evidence }))
  return fresh.value._tag === 'Results' ? fresh.value.rows : []
})
// One status region stays mounted, so a screen reader hears the result
// arrive. Errors keep their own alerts.
const announcement = computed(() => {
  switch (saved.value._tag) {
    case 'Loading': return copy.loadingSaved
    case 'Verdicts': return copy.savedLoaded(saved.value.rows.length)
    case 'Collecting': return copy.phase[saved.value.phase]
    case 'Limited': return copy.limit[saved.value.limit]
    case 'NoVerdicts': return fresh.value._tag === 'Results' ? copy.result : copy.noVerdicts
    default: return ''
  }
})

// A response applies only to the request, Site and Team that sent it.
function claim() {
  const serial = ++request
  const id = siteId
  const team = session.value?.team?.teamId
  return () => serial === request && id === siteId && team === session.value?.team?.teamId
}

// The evidence view counts only after the rows render, for the same claim.
async function recordView(token: string, current: () => boolean) {
  await nextTick()
  if (!current())
    return
  await getAppFetch()<{ recorded: boolean }>(`/api/sites/${siteId}/onboarding/first-report-view`, { method: 'POST', body: { token }, retry: 0 })
    .catch(() => console.warn('First report evidence viewing could not be recorded.'))
}

// `load` starts over, on mount and on a Site or Team change. `again` keeps
// the current state and its button mounted while it reads, so keyboard
// focus stays on Check again. An unknown URL Inspection outcome stays
// unresolved until saved verdicts arrive: that request may still finish and
// spend the Free allowance, so the reader gets no second approval before then.
async function readSaved(read: 'load' | 'again' = 'load') {
  const current = claim()
  rereading.value = read === 'again'
  if (read === 'load') {
    saved.value = { _tag: 'Loading' }
    fresh.value = { _tag: 'Idle' }
  }
  const result = await getAppFetch()<FirstReportSaved>(`/api/sites/${siteId}/onboarding/first-report-saved`, { retry: 0 })
    .catch(() => ({ _tag: 'Unavailable' as const }))
  if (!current())
    return
  rereading.value = false
  saved.value = result
  const since = unresolved.value[siteId]
  const holding = since !== undefined && Date.now() - since < UNRESOLVED_FOR_MS
  if (result._tag === 'Verdicts') {
    fresh.value = { _tag: 'Idle' }
    resolve(siteId)
    await recordView(result.token, current)
  }
  else if (holding) {
    fresh.value = { _tag: 'Uncertain' }
  }
  else if (fresh.value._tag === 'Uncertain') {
    // The hold has run its 15 minutes, so the reader may approve again.
    fresh.value = { _tag: 'Idle' }
    resolve(siteId)
  }
}

function resolve(id: string) {
  if (unresolved.value[id] === undefined)
    return
  const { [id]: _resolved, ...rest } = unresolved.value
  unresolved.value = rest
}

// gscdump can start inspecting, or reach a limit, after the report loads.
// The server then refuses the preview or the approval with that state, and
// the report shows it in place of the fresh URL Inspection flow.
function isHold(result: { _tag: string }): result is FirstReportHold {
  return result._tag === 'Collecting' || result._tag === 'Limited' || result._tag === 'Blocked'
}

function settle(result: Fresh | FirstReportHold) {
  if (isHold(result)) {
    saved.value = result
    fresh.value = { _tag: 'Idle' }
    return
  }
  fresh.value = result
}

async function preview() {
  const current = claim()
  fresh.value = { _tag: 'Loading' }
  const result = await getAppFetch()<FirstReportPreview>(`/api/sites/${siteId}/onboarding/first-report`, { retry: 0 })
    .catch(() => ({ _tag: 'Unavailable' as const }))
  if (current())
    settle(result)
}

async function inspect() {
  if (!ready.value?.canInspect || inspecting.value)
    return
  const current = claim()
  const id = siteId
  const token = ready.value.token
  inspecting.value = true
  // The hold starts before the request, so a reload or a Site change while
  // it runs still offers no second approval. A known outcome ends it.
  unresolved.value = { ...unresolved.value, [id]: Date.now() }
  const result = await getAppFetch()<FirstReportResult>(`/api/sites/${siteId}/onboarding/first-report`, { method: 'POST', body: { token }, retry: 0 })
    .catch((error: { statusCode?: number }) => ({ _tag: error.statusCode === 409 ? 'Changed' as const : 'Uncertain' as const }))
  if (result._tag !== 'Uncertain')
    resolve(id)
  if (current()) {
    settle(result)
    if (result._tag === 'Results' && result.rows.some(row => row._tag === 'Evidence'))
      await recordView(token, current)
  }
  inspecting.value = false
}

onMounted(() => readSaved())
watch([() => siteId, () => session.value?.team?.teamId], () => {
  void readSaved()
})
</script>

<template>
  <!-- The body of the First Site report panel. Saved verdicts are rows under
       the Site header. Every other state is one block with its next action. -->
  <div data-testid="first-site-report">
    <p class="sr-only" role="status">
      {{ announcement }}
    </p>
    <div class="divide-y divide-default dark:divide-accented">
      <div v-if="saved._tag !== 'Verdicts'" class="space-y-3 p-4">
        <p v-if="saved._tag === 'Loading'" class="text-sm text-muted">
          {{ copy.loadingSaved }}
        </p>

        <template v-else-if="saved._tag === 'Collecting'">
          <p class="flex items-center gap-2 text-sm font-medium text-highlighted">
            <span
              class="size-1.5 shrink-0 rounded-full"
              :class="saved.phase === 'waiting_for_sitemaps' ? 'bg-warning' : 'bg-primary motion-safe:animate-pulse'"
              aria-hidden="true"
            />
            {{ copy.phase[saved.phase] }}
          </p>
          <p class="text-sm text-muted">
            {{ copy.collecting }}
          </p>
        </template>

        <p v-else-if="saved._tag === 'Limited'" class="text-sm">
          {{ copy.limit[saved.limit] }}
        </p>

        <p v-else-if="saved._tag === 'Blocked'" role="alert" class="text-sm">
          {{ copy.blocked[saved.reason] }}
        </p>

        <p v-else-if="saved._tag === 'Unavailable' || saved._tag === 'Unknown'" role="alert" class="text-sm">
          {{ copy.savedUnavailable }}
        </p>

        <!-- No saved verdict, and the engine is not inspecting: the reader may
           review up to ten Sitemap URLs, then approve one fresh URL Inspection. -->
        <template v-else-if="saved._tag === 'NoVerdicts'">
          <p v-if="fresh._tag !== 'Results'" class="text-sm font-medium text-highlighted">
            {{ copy.noVerdicts }}
          </p>
          <p v-if="fresh._tag === 'Idle'" class="text-sm text-muted">
            {{ copy.help }}
          </p>
          <p v-if="fresh._tag === 'Loading'" role="status" class="text-sm text-muted">
            {{ copy.loading }}
          </p>
          <template v-if="ready">
            <p class="text-sm text-muted">
              {{ copy.sitemapDate }} <time :datetime="ready.observedAt">{{ formatReportDate(ready.observedAt) }}</time>
            </p>
            <ol class="space-y-1.5 rounded-lg border border-default bg-muted px-3 py-2.5">
              <li v-for="url in ready.urls" :key="url" class="font-mono text-sm wrap-anywhere">
                {{ url }}
              </li>
            </ol>
            <p class="text-sm text-muted">
              {{ copy.sampleLimit }}
            </p>
            <p v-if="ready.canInspect" class="text-sm">
              {{ copy.selected(ready.urls.length) }} {{ copy.cost }}
            </p>
            <p v-else class="text-sm text-muted">
              {{ copy.viewOnly }}
            </p>
          </template>
          <h2 v-if="fresh._tag === 'Results'" class="text-sm font-medium text-highlighted">
            {{ copy.result }}
          </h2>
          <p v-if="fresh._tag === 'Empty'" role="status" class="text-sm">
            {{ copy.empty }}
          </p>
          <p v-if="fresh._tag === 'Incomplete'" role="status" class="text-sm">
            {{ copy.incomplete }}
          </p>
          <p v-if="fresh._tag === 'Unavailable'" role="alert" class="text-sm">
            {{ copy.unavailable }}
          </p>
          <p v-if="fresh._tag === 'Changed'" role="alert" class="text-sm">
            {{ copy.changed }}
          </p>
          <p v-if="fresh._tag === 'DailyQuota'" role="alert" class="text-sm">
            {{ copy.limit.daily }}
          </p>
          <p v-if="fresh._tag === 'Refused'" role="alert" class="text-sm">
            {{ fresh.message }}
          </p>
          <template v-if="fresh._tag === 'Uncertain'">
            <p role="alert" class="text-sm">
              {{ copy.uncertain }}
            </p>
            <UButton color="neutral" variant="outline" :label="copy.saved" :loading="rereading" class="min-h-11" @click="readSaved('again')" />
          </template>
          <!-- The approval leads, under the cost line it answers. -->
          <div v-if="ready?.canInspect || canPreview" class="flex flex-wrap items-center gap-2">
            <UButton v-if="ready?.canInspect" color="primary" :label="copy.inspect" :loading="inspecting" class="min-h-11" @click="inspect" />
            <UButton
              v-if="canPreview"
              :label="fresh._tag === 'Idle' ? copy.preview : copy.refresh"
              :disabled="inspecting"
              color="neutral"
              variant="outline"
              class="min-h-11"
              @click="preview"
            />
          </div>
          <p v-if="inspecting" class="text-sm text-muted" role="status">
            {{ copy.pending }}
          </p>
        </template>

        <!-- One Check again for both states, so keyboard focus survives a read
             that turns collecting into an error or back. -->
        <UButton
          v-if="saved._tag === 'Collecting' || saved._tag === 'Unavailable' || saved._tag === 'Unknown'"
          color="neutral"
          variant="outline"
          :label="copy.retry"
          :loading="rereading"
          class="min-h-11"
          @click="readSaved('again')"
        />
      </div>

      <ul v-if="rows.length" class="divide-y divide-default dark:divide-accented">
        <li v-for="row in rows" :key="row._tag === 'Evidence' ? row.evidence.url : row.url" class="space-y-1 px-4 py-3">
          <p class="font-mono text-sm text-default wrap-anywhere">
            {{ row._tag === 'Evidence' ? row.evidence.url : row.url }}
          </p>
          <div v-if="row._tag === 'Evidence'" class="flex flex-wrap items-center gap-x-4 gap-y-1">
            <UiStatusBadge :status="verdictStatus(row.evidence.verdict)" readable>
              <span class="whitespace-normal">{{ row.evidence.coverage ?? row.evidence.verdict ?? copy.notReported }}</span>
            </UiStatusBadge>
            <span class="text-sm text-muted">
              {{ copy.captured }} <time :datetime="row.evidence.capturedAt">{{ formatReportDate(row.evidence.capturedAt) }}</time>
            </span>
          </div>
          <p v-else-if="row._tag === 'NoResult'" class="text-sm text-muted">
            {{ copy.noResult }}
          </p>
          <p v-else class="text-sm text-muted">
            {{ row._tag === 'Error' ? copy.error : copy.skipped }}: {{ row.reason }}
          </p>
        </li>
      </ul>
      <p v-if="rows.length" class="bg-muted/60 px-4 py-2.5 text-sm text-muted">
        {{ copy.sampleLimit }}
      </p>
    </div>
  </div>
</template>
