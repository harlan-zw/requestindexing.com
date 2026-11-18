<script setup lang="ts">
import type { IndexNowConnectionV1 } from '@gscdump/contracts/v1'
import type { IndexingSite } from '@nuxtseo/pro-indexing/shared/source'
import IndexingSubmissionsCard from '@nuxtseo/pro-indexing/app/components/IndexingSubmissionsCard.vue'
import { useIndexNowConnection, useSubmissionWindowRefresh } from '#layers/indexing/app/composables/useSiteSubmissions'
import IndexNowAutomaticSending from '#layers/indexing/app/internal/components/indexing/IndexNowAutomaticSending.vue'
import { resolveSitemapEmptyState } from '#layers/indexing/app/utils/sitemap-empty-state'
import { SUBMISSIONS_COPY } from '#layers/indexing/shared/submissions-copy'
import { expandProSiteRoute, proSiteFeatureManifest } from '#layers/pro-features/shared/manifest'
import { useProGscdumpSitemapSubmission } from '#layers/pro-gsc/app/composables/useProGscdump'

definePageMeta({
  proTab: { feature: 'indexing', label: 'Submissions', icon: 'i-ph-paper-plane-tilt-duotone', order: 5 },
  title: 'Submissions',
})

// Every Submission of one Site, on every channel, and its sitemap submission.
// The shared Submissions card (`@nuxtseo/pro-indexing`) leads: what was sent,
// what each engine's receipt says, and what Google reported afterwards. The
// two channel pages below hold the actions. Each URL's own timeline is on the
// URLs page, in the URL's detail.
const { siteId, siteName, gscdumpSiteId, site } = useSite('Submissions')
const engineId = computed(() => gscdumpSiteId.value ?? undefined)
const { isAdmin } = useCaller()
const teamPolicy = useTeamPolicy(() => site.value?.teamId)
const canWrite = computed(() => isAdmin.value || teamPolicy.can('write-data'))

const indexingSite = computed<IndexingSite | null>(() => siteId.value
  ? { id: siteId.value, ref: siteId.value, label: siteName.value, url: site.value?.url ?? null, dataId: gscdumpSiteId.value ?? null }
  : null)

const indexNowConnection = useIndexNowConnection(engineId)
const refreshSubmissionWindow = useSubmissionWindowRefresh(indexingSite)
const sitemapSubmission = useProGscdumpSitemapSubmission(engineId)

const route = (id: keyof typeof proSiteFeatureManifest) => computed(() => expandProSiteRoute(proSiteFeatureManifest[id].route, siteId.value))
const googleRoute = route('indexing.submit')
const indexNowRoute = route('indexing.indexnow')
const sitemapsRoute = route('indexing.sitemaps')

const indexNowKey = computed(() => {
  const connection = indexNowConnection.data.value
  if (!connection)
    return null
  if (connection._tag === 'disconnected')
    return { label: SUBMISSIONS_COPY.indexNowNoKey, verified: false }
  return connection._tag === 'connected'
    ? { label: SUBMISSIONS_COPY.indexNowVerified, verified: true }
    : { label: SUBMISSIONS_COPY.indexNowVerify, verified: false }
})

// The switch writes the connection; the card's summary reads it through the
// Site's receipt window, so that read refreshes too.
async function onAutomaticChanged(connection: IndexNowConnectionV1) {
  indexNowConnection.data.value = connection
  await refreshSubmissionWindow()
}

const sitemapState = computed(() => resolveSitemapEmptyState({
  submission: sitemapSubmission.data.value ?? null,
  result: null,
  pending: !sitemapSubmission.data.value && !sitemapSubmission.error.value,
  unavailable: !!sitemapSubmission.error.value,
  canSubmit: canWrite.value,
  discovery: 'settled',
}))
</script>

<template>
  <ProPageStates>
    <ProPageZone tier="primary" first>
      <p class="mb-4 max-w-2xl text-base text-muted">
        {{ SUBMISSIONS_COPY.intro }}
      </p>
      <UiCard v-if="!engineId" size="lg">
        <p class="text-base text-muted">
          {{ SUBMISSIONS_COPY.missingSite }}
        </p>
      </UiCard>
      <IndexingSubmissionsCard v-else :site="indexingSite">
        <template #automatic>
          <IndexNowAutomaticSending
            v-if="indexNowConnection.data.value && indexNowConnection.data.value._tag !== 'disconnected'"
            bare
            :connection="indexNowConnection.data.value"
            :engine-site-id="engineId"
            :can-write="canWrite"
            @updated="onAutomaticChanged"
          />
        </template>
      </IndexingSubmissionsCard>
    </ProPageZone>

    <ProPageZone tier="secondary">
      <div class="grid gap-4 lg:grid-cols-3">
        <UiCard :title="SUBMISSIONS_COPY.channelHeadings.google" variant="subtle" size="sm">
          <div class="flex h-full flex-col gap-2 text-sm">
            <p class="text-muted">
              Google documents it for job posting and livestream pages only.
            </p>
            <UiButton :to="googleRoute" purpose="link" trailing-icon="next" class="mt-auto min-h-11 self-start">
              {{ SUBMISSIONS_COPY.googleLink }}
            </UiButton>
          </div>
        </UiCard>

        <UiCard :title="SUBMISSIONS_COPY.channelHeadings.indexnow" variant="subtle" size="sm">
          <div class="flex h-full flex-col gap-2 text-sm">
            <p class="text-muted">
              Bing and other participating search engines. Google is not one of them.
            </p>
            <template v-if="engineId && indexNowConnection.error.value">
              <p class="text-error">
                {{ SUBMISSIONS_COPY.indexNowReadFailure }}
              </p>
              <UiButton purpose="secondary" class="min-h-11 self-start" @click="indexNowConnection.refresh()">
                {{ SUBMISSIONS_COPY.retry }}
              </UiButton>
            </template>
            <UiSkeleton v-else-if="engineId && !indexNowKey" :lines="1" :base="160" :range="60" />
            <template v-else-if="indexNowKey">
              <UBadge v-if="indexNowKey.verified" color="success" variant="subtle" class="self-start">
                {{ indexNowKey.label }}
              </UBadge>
              <p v-else class="text-default">
                {{ indexNowKey.label }}
              </p>
            </template>
            <UiButton :to="indexNowRoute" purpose="link" trailing-icon="next" class="mt-auto min-h-11 self-start">
              {{ SUBMISSIONS_COPY.indexNowLink }}
            </UiButton>
          </div>
        </UiCard>

        <UiCard :title="SUBMISSIONS_COPY.channelHeadings.sitemap" variant="subtle" size="sm">
          <div class="flex h-full flex-col gap-2 text-sm">
            <UiSkeleton v-if="engineId && sitemapState._tag === 'checking'" :lines="2" :base="160" :range="60" />
            <template v-else-if="engineId && sitemapState._tag !== 'checking'">
              <p class="text-default">
                {{ sitemapState.title }}
              </p>
              <p class="text-muted">
                {{ sitemapState.description }}
              </p>
            </template>
            <UiButton :to="sitemapsRoute" purpose="link" trailing-icon="next" class="mt-auto min-h-11 self-start">
              {{ SUBMISSIONS_COPY.sitemapLink }}
            </UiButton>
          </div>
        </UiCard>
      </div>
    </ProPageZone>
  </ProPageStates>
</template>
