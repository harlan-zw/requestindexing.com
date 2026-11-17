<script setup lang="ts">
import { useSiteSubmissions } from '#layers/indexing/app/composables/useSiteSubmissions'
import SubmissionsAfterwardsCard from '#layers/indexing/app/internal/components/submissions/SubmissionsAfterwardsCard.vue'
import SubmissionsSentCard from '#layers/indexing/app/internal/components/submissions/SubmissionsSentCard.vue'
import { resolveSitemapEmptyState } from '#layers/indexing/app/utils/sitemap-empty-state'
import { viewAutomaticSending } from '#layers/indexing/shared/submissions'
import { describeAutomaticSending, googleLastSubmission, SUBMISSIONS_COPY } from '#layers/indexing/shared/submissions-copy'
import { expandProSiteRoute, proSiteFeatureManifest } from '#layers/pro-features/shared/manifest'
import { useProGscdumpSitemapSubmission } from '#layers/pro-gsc/app/composables/useProGscdump'

definePageMeta({
  proTab: { feature: 'indexing', label: 'Submissions', icon: 'i-ph-paper-plane-tilt-duotone', order: 5 },
  title: 'Submissions',
})

// Every Submission of one Site, on every channel, and its sitemap submission.
// It leads with the value: what was sent, what each search engine answered,
// and what Google reported afterwards. The two channel pages hold the actions.
const { siteId, gscdumpSiteId, site } = useSite('Submissions')
const engineId = computed(() => gscdumpSiteId.value ?? undefined)
const { isAdmin } = useCaller()
const teamPolicy = useTeamPolicy(() => site.value?.teamId)
const canWrite = computed(() => isAdmin.value || teamPolicy.can('write-data'))

const submissions = useSiteSubmissions(engineId)
const { sent, afterwards, latest, indexNowConnection, googleReceipts } = submissions
const sitemapSubmission = useProGscdumpSitemapSubmission(engineId)

const route = (id: keyof typeof proSiteFeatureManifest) => computed(() => expandProSiteRoute(proSiteFeatureManifest[id].route, siteId.value))
const googleRoute = route('indexing.submit')
const indexNowRoute = route('indexing.indexnow')
const sitemapsRoute = route('indexing.sitemaps')
const urlsRoute = route('indexing.urls')

const lastGoogleSubmission = computed(() => googleReceipts.data.value?.submissionReceipts[0]?.createdAt ?? null)

const indexNowState = computed(() => {
  const connection = indexNowConnection.data.value
  if (!connection)
    return null
  if (connection._tag === 'disconnected')
    return { key: SUBMISSIONS_COPY.indexNowNoKey, verified: false, automatic: [] as string[] }
  return {
    key: connection._tag === 'connected' ? SUBMISSIONS_COPY.indexNowVerified : SUBMISSIONS_COPY.indexNowVerify,
    verified: connection._tag === 'connected',
    automatic: describeAutomaticSending(viewAutomaticSending(connection)),
  }
})

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
      <SubmissionsSentCard v-else :state="sent" @retry="submissions.refresh()" />
    </ProPageZone>

    <ProPageZone v-if="engineId" tier="secondary">
      <SubmissionsAfterwardsCard :state="afterwards" :total="latest.total" :urls-route="urlsRoute" @retry="submissions.refresh()" />
    </ProPageZone>

    <ProPageZone tier="secondary">
      <div class="grid gap-4 lg:grid-cols-3">
        <UiCard :title="SUBMISSIONS_COPY.channelHeadings.google" variant="subtle" size="sm">
          <div class="flex h-full flex-col gap-2 text-sm">
            <p class="text-muted">
              Google documents it for job posting and livestream pages only.
            </p>
            <p v-if="engineId && googleReceipts.data.value" class="text-default">
              {{ lastGoogleSubmission ? googleLastSubmission(lastGoogleSubmission) : SUBMISSIONS_COPY.googleNone }}
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
            <UiSkeleton v-if="engineId && !indexNowState && !indexNowConnection.error.value" :lines="2" :base="160" :range="60" />
            <template v-else-if="indexNowState">
              <UBadge v-if="indexNowState.verified" color="success" variant="subtle" class="self-start">
                {{ indexNowState.key }}
              </UBadge>
              <p v-else class="text-default">
                {{ indexNowState.key }}
              </p>
              <p v-for="line in indexNowState.automatic" :key="line" class="text-muted">
                {{ line }}
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
