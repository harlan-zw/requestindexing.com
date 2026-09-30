<script setup lang="ts">
// The Site's sitemap as Bing lists it, and the one submit gscdump allows.
//
// gscdump decides when a submit is owed: `missing` offers one, `awaiting-bing`
// covers a submit in the last 72 hours that Bing does not list yet, and
// `unknown` never prompts one. This component renders the tag it receives.
import type { BingSitemapSubmitOutcome } from '#layers/pro-gsc/app/utils/bing-integration-view'
import { UiAlert, UiButton, UiRelativeTime, UiSectionHeader, UiSkeleton, UiTableShell, UiTableTd, UiTableTh } from '#components'
import { useProBingSiteSitemap } from '#layers/pro-gsc/app/composables/useProGscdump'
import { bingSitemapSubmitMessage } from '#layers/pro-gsc/app/utils/bing-integration-view'

const { siteId, teamId, siteName } = defineProps<{
  /** The Site's gscdump id. */
  siteId: string
  teamId: number | null | undefined
  siteName: string
}>()

const bing = useProBingSiteSitemap(() => siteId, () => teamId)
const sitemap = computed(() => bing.sitemap.value)
const outcome = ref<ReturnType<typeof bingSitemapSubmitMessage> | null>(null)

// A submit Bing took re-reads the state above, which then says it. Only a
// refusal or a missing answer needs its own line.
async function submit() {
  outcome.value = null
  const result: BingSitemapSubmitOutcome | null = await bing.submit()
  if (result && result._tag !== 'submitted')
    outcome.value = bingSitemapSubmitMessage(result, siteName)
}

function sitemapPath(url: string): string {
  return URL.parse(url)?.pathname ?? url
}
</script>

<template>
  <section>
    <UiSectionHeader
      title="Sitemap"
      tooltip="Bing finds new URLs faster when it has your sitemap. Bing decides whether to index each URL."
    />

    <div v-if="bing.status.value === 'pending' && !sitemap" class="mt-3" aria-busy="true">
      <UiSkeleton type="block" class="h-10 w-full" />
    </div>

    <UiAlert
      v-else-if="bing.error.value"
      class="mt-3"
      status="error"
      title="Bing sitemap state could not be read"
      description="Retry the check. Bing data for this Site is unchanged."
    >
      <template #action>
        <UiButton purpose="secondary" size="xs" icon="refresh" label="Retry" class="min-h-11 sm:min-h-0" @click="() => bing.refresh()" />
      </template>
    </UiAlert>

    <template v-else-if="sitemap">
      <div v-if="sitemap._tag === 'missing'" class="mt-3 flex flex-col gap-3 rounded-lg border border-default p-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-muted">
          Bing lists no sitemap for this Site. Submit one so Bing finds your new pages.
        </p>
        <UiButton
          v-if="bing.canSubmit.value"
          purpose="secondary"
          size="sm"
          label="Submit sitemap"
          class="min-h-11 shrink-0 sm:min-h-0"
          :loading="bing.submitting.value"
          @click="submit"
        />
        <p v-else class="text-sm text-muted">
          Your Team role allows viewing only.
        </p>
      </div>

      <p v-else-if="sitemap._tag === 'awaiting-bing'" class="mt-3 text-sm text-muted">
        A sitemap was submitted <UiRelativeTime :date="sitemap.lastSubmittedAt" />. Bing does not list it yet.
        Bing lags after it accepts a sitemap, so do not submit it again.
      </p>

      <p v-else-if="sitemap._tag === 'unknown'" class="mt-3 text-sm text-muted">
        Bing sitemaps are not checked yet. The check runs with the next daily sync.
      </p>

      <UiTableShell v-else class="mt-3" bordered size="sm" label="Sitemaps Bing lists">
        <template #head>
          <UiTableTh>Sitemap</UiTableTh>
          <UiTableTh>Bing status</UiTableTh>
          <UiTableTh numeric visible-from="sm">
            URLs
          </UiTableTh>
          <UiTableTh visible-from="md">
            Last crawl
          </UiTableTh>
        </template>
        <tr v-for="entry in sitemap.sitemaps" :key="entry.url">
          <UiTableTd row-header class="max-w-0 w-full">
            <a :href="entry.url" target="_blank" rel="noopener noreferrer" class="block truncate text-default hover:text-highlighted transition-colors" :title="entry.url">
              {{ sitemapPath(entry.url) }}
            </a>
          </UiTableTd>
          <UiTableTd class="whitespace-nowrap text-muted">
            {{ entry.status }}
          </UiTableTd>
          <UiTableTd numeric visible-from="sm" class="text-muted">
            {{ entry.urlCount?.toLocaleString('en-US') ?? 'Unknown' }}
          </UiTableTd>
          <UiTableTd visible-from="md" class="whitespace-nowrap text-muted">
            <UiRelativeTime :date="entry.lastCrawledAt" fallback="Not yet" />
          </UiTableTd>
        </tr>
      </UiTableShell>

      <UiAlert
        v-if="outcome"
        class="mt-3"
        :status="outcome.tone"
        :title="outcome.text"
        dismissible
        @dismiss="outcome = null"
      />
    </template>
  </section>
</template>
