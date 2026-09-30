<script lang="ts" setup>
import type { SitesPreview } from '~~/layers/core/app/types'

definePageMeta({
  layout: 'pro-dashboard',
  title: 'Team settings',
  // Not the members glyph: Sites, Members and Settings all used to share it.
  icon: 'i-heroicons-cog-6-tooth',
  description: 'Manage your team settings.',
})

const onSessionExpired = createSessionExpiredHandler()

// A bare `$fetch` forwards no cookies during the server render, so this read
// answered 401 on EVERY server render. The page then tried to sign the user out
// and navigate to login from a Nuxt context the top-level await had already
// left, and the whole document came back 500 (D2). `useRequestFetch` sends the
// incoming request's own cookies, so the server render sees the same session
// the browser does.
const requestFetch = useRequestFetch()
const { data: preview } = await useAsyncData(
  'pro-saas:team-settings:sites-preview',
  () => readSessionScoped(() => requestFetch<{ sites: SitesPreview }>('/api/sites/preview')),
)

// Leaving for the login page is a client move. During a server render the auth
// middleware already owns that decision, and `navigateTo` from here cannot
// reach the Nuxt instance anyway.
onMounted(async () => {
  if (preview.value?._tag === 'SessionExpired')
    await onSessionExpired()
})

const sites = computed<SitesPreview>(() => preview.value?._tag === 'Ready' ? preview.value.value.sites : [])
</script>

<template>
  <div class="max-w-3xl space-y-6">
    <!-- A read-only summary. Manage Sites connects and removes Sites. -->
    <div>
      <h2 class="mb-2 text-sm font-medium text-highlighted">
        Tracked sites
      </h2>
      <ul v-if="sites.length" class="divide-y divide-default rounded-md ring ring-default">
        <li v-for="site in sites" :key="site.siteId" class="flex items-center gap-2 px-3 py-2">
          <SiteFavicon :site="site" />
          <span class="truncate text-sm">{{ siteLabel(site) }}</span>
        </li>
      </ul>
      <p v-else class="text-sm text-muted">
        This team tracks no sites yet.
      </p>
    </div>
    <p class="text-sm text-muted">
      To change which sites this team tracks, go to
      <NuxtLink to="/pro/dashboard/sites" class="text-primary underline">
        Manage Sites
      </NuxtLink>.
    </p>
  </div>
</template>
