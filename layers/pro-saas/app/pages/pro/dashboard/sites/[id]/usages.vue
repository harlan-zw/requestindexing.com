<script lang="ts" setup>
definePageMeta({
  proTab: { feature: 'settings', label: 'API Usage', icon: 'i-ph-gauge-duotone', order: 95 },
  title: 'API Usages',
  // U4: this page counts API calls, not stored rows.
  icon: 'i-ph-gauge-duotone',
})

const { site, siteId, siteName } = useSite('API Usage')

// The endpoint returns a bare array of `{ key, usage }` summed for the current
// calendar month. It is not period-scoped, so this page carries no date range.
const { data, status, error, refresh } = await useAsyncData(
  () => `usages:${siteId.value}`,
  () => $fetch<Array<{ key: string, usage: number }>>(`/api/sites/${siteId.value}/usages`),
  { server: false },
)

const labels: Record<string, string> = {
  indexingApi: 'Google Indexing API',
  gsc: 'Google Search Console',
  googleAds: 'Google Ads',
}

const rows = computed(() => (data.value ?? []).map(row => ({
  key: row.key,
  label: labels[row.key] ?? row.key,
  usage: row.usage,
})))
</script>

<template>
  <div class="space-y-7">
    <div>
      <h2 class="text-sm font-semibold">
        {{ siteName }}
      </h2>
      <p class="text-xs text-muted">
        Search Console property {{ site?.property }}
      </p>
    </div>

    <!-- U2: the shell already titles this page "API Usages". -->
    <UCard>
      <div class="mb-4 text-sm text-muted">
        API calls this site has made so far this month.
      </div>

      <div v-if="status === 'pending'" class="flex items-center justify-center py-8" aria-live="polite">
        <UIcon name="i-heroicons-arrow-path" class="size-5 animate-spin text-muted" />
        <span class="sr-only">Loading API usage</span>
      </div>
      <div v-else-if="error" class="flex min-h-24 flex-wrap items-center gap-3 text-sm text-muted" role="alert">
        <span>API usage could not load.</span>
        <UButton label="Retry" color="neutral" variant="outline" size="sm" @click="refresh()" />
      </div>
      <!-- U1: an empty array used to render an empty bordered box. -->
      <div v-else-if="!rows.length" class="py-6 text-sm text-muted">
        No API calls yet this month. Requesting indexing for a URL from Web Indexing will show up here.
      </div>
      <dl v-else class="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div v-for="row in rows" :key="row.key">
          <dt class="text-sm text-muted">
            {{ row.label }}
          </dt>
          <!-- No denominator. The old UI showed `/100`, which matched nothing:
               the endpoint sums the current calendar month, `usageLimitPerUser`
               in runtime config is wired to nothing, and the only real guard is
               a rate limit. Naming the period is honest; inventing a quota is
               not. -->
          <dd class="font-mono text-3xl">
            {{ useHumanFriendlyNumber(row.usage) }}
            <span class="font-sans text-sm text-muted">calls this month</span>
          </dd>
        </div>
      </dl>
    </UCard>
  </div>
</template>
