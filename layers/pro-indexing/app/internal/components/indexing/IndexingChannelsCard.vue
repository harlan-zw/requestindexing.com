<script setup lang="ts">
import { computed } from 'vue'
import { expandProSiteRoute, proSiteFeatureManifest } from '#layers/pro-shell/shared/manifest'

// The two channels a Site can notify, side by side. The Submit to Google page
// and the IndexNow page both render this card, so a person reads the same
// comparison on either page and links across to the other one. The strings
// are COPY.md's "Indexing channel assets"; the evidence for each is in its
// truth rules. Nothing here blocks a channel: the person decides.
const { current, siteId } = defineProps<{
  /** The channel of the page that renders the card. It gets no link. */
  current: 'google' | 'indexnow'
  /** The app Site id from the route. Never `gscdumpSiteId`: this builds a route. */
  siteId: string
}>()

const channels = computed(() => [
  {
    id: 'google' as const,
    name: 'Google Indexing API',
    facts: [
      { label: 'Search engines', value: 'Google only.' },
      { label: 'Pages', value: 'Google documents it for job posting and livestream pages only.' },
      { label: 'Setup', value: 'Indexing API access from your Google account.' },
    ],
    link: { label: 'Submit to Google', to: expandProSiteRoute(proSiteFeatureManifest['indexing.submit'].route, siteId) },
  },
  {
    id: 'indexnow' as const,
    name: 'IndexNow',
    facts: [
      { label: 'Search engines', value: 'Bing and other participating search engines. Google is not one of them.' },
      { label: 'Pages', value: 'Any page type on this host.' },
      { label: 'Setup', value: 'A key file on your site.' },
    ],
    link: { label: 'Submit with IndexNow', to: expandProSiteRoute(proSiteFeatureManifest['indexing.indexnow'].route, siteId) },
  },
])
</script>

<template>
  <UiCard title="Google Indexing API or IndexNow" variant="subtle" size="sm">
    <div class="grid gap-6 sm:grid-cols-2">
      <section v-for="channel in channels" :key="channel.id" :aria-labelledby="`indexing-channel-${channel.id}`">
        <h4 :id="`indexing-channel-${channel.id}`" class="text-sm font-strong text-default">
          {{ channel.name }}
        </h4>
        <dl class="mt-2 space-y-2 text-sm">
          <div v-for="fact in channel.facts" :key="fact.label">
            <dt class="text-muted">
              {{ fact.label }}
            </dt>
            <dd class="text-default">
              {{ fact.value }}
            </dd>
          </div>
        </dl>
        <UiButton v-if="channel.id !== current" :to="channel.link.to" purpose="link" trailing-icon="next" class="mt-3 min-h-11">
          {{ channel.link.label }}
        </UiButton>
      </section>
    </div>
  </UiCard>
</template>
