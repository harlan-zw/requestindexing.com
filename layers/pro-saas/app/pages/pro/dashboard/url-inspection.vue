<script setup lang="ts">
import type { PageEvidenceRead, PageInspectionResult } from '#layers/pro-indexing/shared/page-evidence'
import { useClipboard } from '@vueuse/core'
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'
import ProSiteAddForm from '#layers/pro-saas/app/components/pro/ProSiteAddForm.vue'
import { PAGE_SETUP_COPY as copy, PAGE_TASK_ROUTE } from '#layers/pro-saas/shared/page-task'

definePageMeta({ layout: 'pro-onboarding', title: 'URL Inspection' })
useSeoMeta({ title: 'URL Inspection', robots: 'noindex, nofollow' })

const { session, fetch: refreshSession } = useUserSession()
const { data: task, status, error, refresh: refreshTask } = await useFetch('/api/onboarding/page', { watch: false })
const selected = computed(() => task.value?._tag === 'Available' ? task.value : null)
const siteId = computed(() => selected.value?.siteId ?? null)
const connectHref = `/auth/integrations/gsc/connect?scope=read&returnTo=${encodeURIComponent(PAGE_TASK_ROUTE)}`
const needsGoogle = computed(() => !session.value?.gscdumpConnected || ['scope_missing', 'reauth_required', 'refresh_missing', 'disconnected'].includes(session.value?.gscdumpAccountStatus ?? ''))
type Read = PageEvidenceRead | PageInspectionResult | { _tag: 'Loading' }
const read = ref<Read>({ _tag: 'Loading' })
const inspecting = ref(false)
const finishing = ref(false)
const actionError = ref('')
const showDetails = ref(false)
const title = useTemplateRef<HTMLElement>('title')
const { copy: copyText, copied } = useClipboard({ legacy: true })
const copyError = ref(false)
const propertyRequired = computed(() => read.value._tag === 'PropertyRequired' ? read.value : null)
const searchConsoleHref = computed(() => `https://search.google.com/search-console?resource_id=${encodeURIComponent(propertyRequired.value?.alternatives[0] ?? propertyRequired.value?.property ?? '')}`)
let request = 0

async function copySelectedUrl() {
  copyError.value = false
  if (selected.value)
    await copyText(selected.value.url).catch(() => { copyError.value = true })
}

async function loadEvidence() {
  const id = siteId.value
  if (!id)
    return
  const serial = ++request
  read.value = { _tag: 'Loading' }
  const result = await getAppFetch()<PageEvidenceRead>(`/api/sites/${id}/onboarding/page`)
    .catch((): PageEvidenceRead => ({ _tag: 'Unavailable', operation: 'read' }))
  if (result._tag === 'Evidence' && result.evidence.url !== selected.value?.url) {
    await refreshTask()
    return
  }
  if (request === serial && siteId.value === id)
    read.value = result
}

async function inspect() {
  if (!siteId.value || !selected.value?.canInspect || inspecting.value)
    return
  const id = siteId.value
  const serial = ++request
  inspecting.value = true
  const result = await getAppFetch()<PageInspectionResult>(`/api/sites/${id}/onboarding/page`, { method: 'POST', body: { url: selected.value.url } })
    .catch((): PageInspectionResult => ({ _tag: 'Unavailable', operation: 'inspect' }))
  if (request === serial && siteId.value === id)
    read.value = result
  inspecting.value = false
}

async function refreshEvidence() {
  await refreshTask()
  await loadEvidence()
}

async function finish(later = false) {
  if (finishing.value)
    return
  finishing.value = true
  actionError.value = ''
  await getAppFetch()('/api/pro/onboarding/complete', { method: 'POST', body: { skipSites: !siteId.value } })
    .then(async () => {
      await refreshSession()
      if (later)
        await navigateTo('/pro/dashboard')
      else showDetails.value = true
    })
    .catch(() => { actionError.value = 'Could not finish setup' })
  finishing.value = false
}

watch([siteId, () => selected.value?.url], () => {
  request++
  showDetails.value = false
  if (import.meta.client)
    void loadEvidence()
})
watch(() => session.value?.team?.teamId, () => refreshTask())
watch(() => read.value._tag, async (state) => {
  if (state !== 'Evidence')
    return
  await nextTick()
  title.value?.focus()
  if (siteId.value) {
    await getAppFetch()(`/api/sites/${siteId.value}/onboarding/page-view`, { method: 'POST', body: { url: selected.value?.url } })
      .catch(() => console.warn('The saved page view could not be recorded.'))
  }
})
onMounted(async () => {
  await refreshSession()
  await refreshTask()
  await loadEvidence()
})

const evidence = computed(() => read.value._tag === 'Evidence' ? read.value.evidence : null)
const failure = computed(() => {
  if (read.value._tag === 'DailyQuota')
    return copy.dailyQuota
  if (read.value._tag === 'Refused')
    return read.value.message
  if (read.value._tag === 'Failed')
    return copy.inspectFailed
  if (read.value._tag === 'Unavailable')
    return read.value.operation === 'inspect' ? copy.inspectUnavailable : copy.unavailable
  return ''
})
</script>

<template>
  <div class="space-y-6" data-testid="saved-page-setup">
    <h1 ref="title" tabindex="-1" class="text-2xl font-semibold text-highlighted">
      {{ evidence ? copy.resultHeading : copy.heading }}
    </h1>
    <p v-if="status === 'pending'" role="status" aria-live="polite">
      Loading your account
    </p>
    <template v-else-if="error">
      <p role="alert">
        {{ copy.unavailable }}
      </p>
      <UButton :label="copy.retry" color="primary" class="min-h-11" @click="refreshTask()" />
    </template>
    <template v-else-if="!selected">
      <p>{{ task?._tag === 'Expired' ? copy.expired : copy.missing }}</p>
      <UButton to="/tools/google-indexing-checker" color="primary" label="Google Index Checker" class="min-h-11" />
    </template>
    <template v-else>
      <div class="space-y-1">
        <p class="text-sm text-muted">
          {{ copy.target }}
        </p>
        <p class="break-all font-mono text-sm" data-testid="saved-page-url">
          {{ selected.url }}
        </p>
      </div>
      <p v-if="session?.gscEmail" class="break-all text-sm text-muted">
        Google Search Console: {{ session.gscEmail }}
      </p>
      <template v-if="needsGoogle">
        <p>{{ copy.readAccess }}</p>
        <UButton :to="connectHref" external color="primary" label="Connect Google Search Console" class="min-h-11" />
      </template>
      <template v-else-if="!siteId">
        <p>{{ copy.introduction }}</p>
        <ProSiteAddForm :gsc-return-to="PAGE_TASK_ROUTE" :target-url="selected.url" @connected="refreshTask()" />
      </template>
      <template v-else-if="read._tag === 'Loading' || read._tag === 'Pending'">
        <p role="status" aria-live="polite">
          {{ copy.pending }}
        </p>
        <UButton :label="copy.retry" color="primary" class="min-h-11" @click="refreshEvidence" />
      </template>
      <div v-else-if="propertyRequired" class="space-y-4" data-testid="saved-page-property-required">
        <p role="alert">
          {{ copy.propertyLimit }}
        </p>
        <dl class="space-y-1 text-sm">
          <dt>{{ copy.connectedProperty }}</dt>
          <dd class="break-all font-mono">
            {{ propertyRequired.property ?? 'Unavailable right now' }}
          </dd>
        </dl>
        <template v-if="propertyRequired.alternatives.length">
          <p>{{ copy.otherProperties }}</p>
          <ul class="list-disc space-y-1 pl-5">
            <li v-for="property in propertyRequired.alternatives" :key="property" class="break-all font-mono text-sm">
              {{ property }}
            </li>
          </ul>
        </template>
        <p>{{ copy.propertyRecovery }}</p>
        <div class="flex flex-wrap gap-3">
          <UButton :to="searchConsoleHref" target="_blank" rel="noopener" external color="primary" label="Open Search Console" class="min-h-11" />
          <UButton :label="copied ? copy.copiedUrl : copy.copyUrl" color="neutral" variant="outline" class="min-h-11" @click="copySelectedUrl" />
          <UButton :label="copy.retry" color="neutral" variant="outline" class="min-h-11" @click="refreshEvidence" />
        </div>
        <p v-if="copied" role="status">
          {{ copy.copiedUrl }}
        </p>
        <p v-if="copyError" role="alert">
          {{ copy.copyFailed }}
        </p>
      </div>
      <template v-else-if="evidence">
        <dl class="grid gap-x-5 gap-y-2 text-sm sm:grid-cols-[auto_1fr]" data-testid="page-inspection-evidence">
          <dt>Source</dt><dd>{{ copy.source }}</dd>
          <dt>{{ copy.coverage }}</dt><dd>{{ evidence.coverage ?? evidence.verdict ?? 'Unavailable right now' }}</dd>
          <dt>{{ copy.captured }}</dt><dd><time :datetime="evidence.capturedAt">{{ evidence.capturedAt }}</time></dd>
        </dl>
        <UButton v-if="!showDetails" :label="copy.details" :loading="finishing" color="primary" class="min-h-11" @click="finish()" />
        <div v-if="showDetails" class="space-y-4" aria-live="polite" data-testid="page-inspection-details">
          <dl class="grid gap-x-5 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            <dt>Last crawl</dt><dd>{{ evidence.lastCrawlAt ?? copy.notReported }}</dd>
            <dt>Google canonical</dt><dd class="break-all">
              {{ evidence.googleCanonical ?? copy.notReported }}
            </dd>
            <dt>User canonical</dt><dd class="break-all">
              {{ evidence.userCanonical ?? copy.notReported }}
            </dd>
          </dl>
          <div class="flex flex-wrap gap-3">
            <UButton :to="`/pro/dashboard/sites/${siteId}/indexing/sitemaps`" color="neutral" variant="outline" label="Sitemaps" class="min-h-11" />
            <UButton :to="`/pro/dashboard/sites/${siteId}/indexing/submit`" color="neutral" variant="outline" label="Submit to Google" class="min-h-11" />
          </div>
        </div>
      </template>
      <template v-else>
        <p v-if="failure" role="alert">
          {{ failure }}
        </p>
        <h2 class="text-lg font-semibold">
          {{ copy.inspectHeading }}
        </h2>
        <p v-if="read._tag === 'Missing'">
          {{ copy.noEvidence }}
        </p>
        <p>{{ copy.inspectHelp }}</p>
        <p class="text-sm text-muted">
          {{ copy.inspectCost }}
        </p>
        <UButton v-if="selected.canInspect && read._tag !== 'DailyQuota' && read._tag !== 'Refused' && read._tag !== 'Unavailable'" :label="copy.inspect" :loading="inspecting" color="primary" class="min-h-11" @click="inspect" />
        <p v-if="!selected.canInspect" class="text-sm text-muted">
          Your Team role allows viewing only.
        </p>
        <UButton v-if="read._tag !== 'Missing'" :label="copy.retry" color="neutral" variant="outline" class="min-h-11" @click="refreshEvidence" />
      </template>
      <p v-if="actionError" role="alert">
        {{ actionError }}
      </p>
      <UButton :label="copy.skip" :loading="finishing" color="neutral" variant="link" class="min-h-11" @click="finish(true)" />
    </template>
  </div>
</template>
