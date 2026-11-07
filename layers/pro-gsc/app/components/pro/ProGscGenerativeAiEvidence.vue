<script setup lang="ts">
import type { GenerativeAiReportReadV1 } from '@gscdump/contracts/v1/http'
import type { GenerativeAiUploadResult } from '#layers/pro-gsc/shared/generative-ai-evidence'
import { parseGenerativeAiReportExport } from '@gscdump/sdk/generative-ai-report'
import { useFileDialog } from '@vueuse/core'
import { useGscdumpQuery } from '#layers/pro-gsc/app/composables/useProGscdump/_internal'
import { useProGscdump } from '#layers/pro-gsc/app/composables/useProGscdump/useProGscdump'
import { GENERATIVE_AI_COPY as copy, describeGenerativeAiEvidence, uploadGenerativeAiReport } from '#layers/pro-gsc/shared/generative-ai-evidence'
import { connectedSiteDomain } from '#layers/pro-saas/shared/site-url'

// One evidence line for one URL: its Generative AI impressions in the last
// upload, tied to indexing. COPY.md "Generative AI impressions assets".
// No report, total, ratio, or trend: VISION.md rejects an AI-visibility tool.

const { siteId, gscdumpSiteId, pageUrl, site } = defineProps<{
  siteId: string
  gscdumpSiteId: string | null | undefined
  pageUrl: string
  site: { teamId?: number, domain?: string | null, property?: string, gscdumpSiteUrl?: string | null } | null | undefined
}>()

const engineId = computed(() => gscdumpSiteId ?? undefined)
const gscdump = useProGscdump()
const { isAdmin } = useCaller()
const teamPolicy = useTeamPolicy(() => site?.teamId)
// `uploads.create` is a write; the proxy refuses it for a view-only role.
const canWrite = computed(() => isAdmin.value || teamPolicy.can('write-data'))
const registeredHost = computed(() => site ? connectedSiteDomain({ domain: site.domain ?? null, property: site.property ?? null, gscdumpSiteUrl: site.gscdumpSiteUrl }) : null)

const read = useGscdumpQuery<GenerativeAiReportReadV1>(
  () => `generative-ai:${engineId.value ?? ''}:${pageUrl}`,
  engineId,
  (id, client) => client.getSiteGenerativeAiReport({ params: { siteId: id }, query: { pageUrl } }, true),
  [() => pageUrl],
)
const view = computed(() => read.data.value ? describeGenerativeAiEvidence(read.data.value) : null)
const indexingHref = computed(() => `/pro/dashboard/sites/${siteId}/indexing/urls?search=${encodeURIComponent(pageUrl)}`)

const uploading = ref(false)
const outcome = ref<GenerativeAiUploadResult | null>(null)
const { open, onChange, reset } = useFileDialog({ accept: '.zip,application/zip', multiple: false })

onChange(async (files) => {
  const file = files?.[0]
  const id = engineId.value
  const host = registeredHost.value
  reset()
  if (!file || !id || !host || uploading.value)
    return
  uploading.value = true
  outcome.value = await uploadGenerativeAiReport({
    file: { bytes: new Uint8Array(await file.arrayBuffer()), filename: file.name },
    site: { registeredHost: host, gscProperty: site?.property ?? null },
    now: new Date(),
    parse: parseGenerativeAiReportExport,
    create: body => gscdump.createSiteGenerativeAiReportUpload({ params: { siteId: id }, body }, true),
  }).catch((): GenerativeAiUploadResult => ({ _tag: 'refused', message: copy.refusal.other }))
  uploading.value = false
  if (outcome.value._tag === 'saved')
    await read.refresh()
})
</script>

<template>
  <UiCard v-if="engineId" :title="copy.heading" size="lg" data-testid="generative-ai-evidence">
    <template v-if="read.error.value">
      <p class="text-base text-error">
        {{ copy.readFailure }}
      </p>
      <UiButton purpose="secondary" class="mt-3 min-h-11" @click="read.refresh()">
        {{ copy.retry }}
      </UiButton>
    </template>
    <UiSkeleton v-else-if="!view" :lines="2" :base="240" :range="80" />
    <template v-else-if="view._tag === 'no-upload'">
      <p class="text-base text-default">
        {{ view.message }}
      </p>
      <p class="mt-2 text-base text-muted">
        {{ view.steps }}
      </p>
    </template>
    <template v-else>
      <p class="text-base text-default">
        {{ view.line }}
      </p>
      <p class="mt-2 text-base text-muted">
        {{ view.requirement }}
        <ULink :to="indexingHref" class="text-primary underline">
          {{ copy.indexingLink }}
        </ULink>
      </p>
      <p class="mt-2 text-sm text-muted">
        {{ view.asOf }}
      </p>
      <p v-for="note in view.notes" :key="note" class="mt-1 text-sm text-muted">
        {{ note }}
      </p>
    </template>

    <div v-if="view && !read.error.value" class="mt-4 flex flex-wrap items-center gap-3 border-t border-default pt-3">
      <UiButton
        purpose="secondary"
        size="sm"
        icon="upload"
        class="min-h-11 sm:min-h-0"
        :loading="uploading"
        :disabled="!canWrite || !registeredHost || uploading"
        :label="uploading ? copy.uploadBusy : copy.uploadAction"
        @click="open()"
      />
      <p v-if="!canWrite" class="text-sm text-muted">
        Your Team role allows viewing only.
      </p>
    </div>
    <div v-if="outcome" class="mt-2" role="status">
      <p class="text-sm" :class="outcome._tag === 'saved' ? 'text-default' : 'text-error'">
        {{ outcome.message }}
      </p>
      <p v-for="warning in outcome._tag === 'saved' ? outcome.warnings : []" :key="warning" class="mt-1 text-sm text-warning">
        {{ warning }}
      </p>
    </div>
  </UiCard>
</template>
