<script setup lang="ts">
import type { FirstReportPreview, FirstReportResult } from '#layers/indexing/shared/first-report'
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'
import { FIRST_REPORT_COPY as copy } from '#layers/indexing/shared/first-report'
import { PAGE_SETUP_COPY } from '#layers/pro-saas/shared/page-task'

const { siteId } = defineProps<{ siteId: string }>()
const { session } = useUserSession()
type State = { _tag: 'Idle' | 'Loading' | 'Unavailable' | 'Changed' } | FirstReportPreview | FirstReportResult
const state = ref<State>({ _tag: 'Idle' })
const inspecting = ref(false)
let request = 0
onScopeDispose(() => {
  request++
})
const ready = computed(() => state.value._tag === 'Ready' ? state.value : null)
const results = computed(() => state.value._tag === 'Results' ? state.value.rows : [])

async function preview() {
  const id = siteId
  const team = session.value?.team?.teamId
  const serial = ++request
  state.value = { _tag: 'Loading' }
  const result = await getAppFetch()<FirstReportPreview>(`/api/sites/${id}/onboarding/first-report`, { retry: 0 })
    .catch(() => ({ _tag: 'Unavailable' as const }))
  if (serial === request && id === siteId && team === session.value?.team?.teamId)
    state.value = result
}

async function inspect() {
  if (!ready.value?.canInspect || inspecting.value)
    return
  const id = siteId
  const team = session.value?.team?.teamId
  const serial = ++request
  const token = ready.value.token
  inspecting.value = true
  const result = await getAppFetch()<FirstReportResult>(`/api/sites/${id}/onboarding/first-report`, { method: 'POST', body: { token }, retry: 0 })
    .catch((error: { statusCode?: number }) => ({ _tag: error.statusCode === 409 ? 'Changed' as const : 'Uncertain' as const }))
  if (serial === request && id === siteId && team === session.value?.team?.teamId) {
    state.value = result
    if (result._tag === 'Results' && result.rows.some(row => row._tag === 'Evidence')) {
      await nextTick()
      if (serial === request && id === siteId && team === session.value?.team?.teamId) {
        await getAppFetch()<{ recorded: boolean }>(`/api/sites/${id}/onboarding/first-report-view`, { method: 'POST', body: { token }, retry: 0 })
          .catch(() => console.warn('First report evidence viewing could not be recorded.'))
      }
    }
  }
  inspecting.value = false
}

watch([() => siteId, () => session.value?.team?.teamId], () => {
  request++
  state.value = { _tag: 'Idle' }
})
</script>

<template>
  <section class="space-y-4 border-y border-default py-5" aria-labelledby="first-report-heading" data-testid="first-site-report">
    <h2 id="first-report-heading" class="text-lg font-semibold text-highlighted">
      {{ state._tag === 'Results' ? copy.result : copy.heading }}
    </h2>
    <p>{{ copy.help }}</p>
    <p v-if="state._tag === 'Loading'" role="status">
      {{ copy.loading }}
    </p>
    <template v-if="ready">
      <p class="text-sm text-muted">
        {{ copy.source }} · <time :datetime="ready.observedAt">{{ ready.observedAt }}</time>
      </p>
      <ol class="list-decimal space-y-2 pl-5 text-sm">
        <li v-for="url in ready.urls" :key="url" class="break-all font-mono">
          {{ url }}
        </li>
      </ol>
      <p class="text-sm">
        {{ copy.selected(ready.urls.length) }} {{ copy.cost }}
      </p>
      <p class="text-sm text-muted">
        {{ copy.limit }}
      </p>
      <UButton v-if="ready.canInspect" color="primary" :label="copy.inspect" :loading="inspecting" class="min-h-11" @click="inspect" />
      <p v-if="inspecting" class="text-sm text-muted" role="status">
        {{ copy.pending }}
      </p>
      <p v-if="!ready.canInspect" class="text-sm text-muted">
        {{ copy.viewOnly }}
      </p>
    </template>
    <div v-if="state._tag === 'Results'" class="space-y-5" aria-live="polite">
      <div v-for="row in results" :key="row._tag === 'Evidence' ? row.evidence.url : row.url" class="space-y-2">
        <p class="break-all font-mono text-sm">
          {{ row._tag === 'Evidence' ? row.evidence.url : row.url }}
        </p>
        <template v-if="row._tag === 'Evidence'">
          <p>{{ row.evidence.coverage ?? row.evidence.verdict ?? PAGE_SETUP_COPY.notReported }}</p>
          <p class="text-sm text-muted">
            {{ PAGE_SETUP_COPY.source }} · {{ PAGE_SETUP_COPY.captured }} <time :datetime="row.evidence.capturedAt">{{ row.evidence.capturedAt }}</time>
          </p>
        </template>
        <p v-else-if="row._tag === 'NoResult'" class="text-sm text-muted">
          {{ copy.noResult }}
        </p>
        <p v-else class="text-sm text-muted">
          {{ row._tag === 'Error' ? copy.error : copy.skipped }}: {{ row.reason }}
        </p>
      </div>
      <p class="text-sm text-muted">
        {{ copy.limit }}
      </p>
    </div>
    <p v-if="state._tag === 'Empty'" role="status">
      {{ copy.empty }}
    </p>
    <p v-if="state._tag === 'Incomplete'" role="status">
      {{ copy.incomplete }}
    </p>
    <p v-if="state._tag === 'Unavailable'" role="alert">
      {{ copy.unavailable }}
    </p>
    <p v-if="state._tag === 'Changed'" role="alert">
      {{ copy.changed }}
    </p>
    <p v-if="state._tag === 'DailyQuota'" role="alert">
      {{ PAGE_SETUP_COPY.dailyQuota }}
    </p>
    <p v-if="state._tag === 'Refused'" role="alert">
      {{ state.message }}
    </p>
    <p v-if="state._tag === 'Uncertain'" role="alert">
      {{ copy.uncertain }}
    </p>
    <UButton v-if="state._tag === 'Uncertain'" :to="`/pro/dashboard/sites/${siteId}/indexing/urls`" color="primary" :label="copy.saved" class="min-h-11" />
    <UButton v-if="!['Loading', 'Uncertain', 'DailyQuota', 'Refused'].includes(state._tag)" :label="state._tag === 'Idle' ? copy.preview : copy.refresh" :disabled="inspecting" color="neutral" variant="outline" class="min-h-11" @click="preview" />
  </section>
</template>
