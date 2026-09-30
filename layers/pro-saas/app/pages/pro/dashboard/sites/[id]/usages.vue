<script lang="ts" setup>
import type { FreeAllowanceView } from '#layers/pro-gsc/shared/free-allowance'
import { FREE_ALLOWANCE_HEADING, FREE_ALLOWANCE_READ_FAILURE, meterRows } from '#layers/pro-gsc/shared/entitlement-copy'

definePageMeta({
  proTab: { feature: 'settings', label: 'Usage', icon: 'i-ph-gauge-duotone', order: 95 },
  title: 'Usage',
  icon: 'i-ph-gauge-duotone',
})

const { site, siteId, siteName } = useSite('Usage')

// The Free allowance is gscdump's, per account, and gscdump counts it. While
// the partner is exempt the view is `Hidden` and this page shows only the
// Indexing API counter below, as it did before metering.
const { data: allowanceData, status: allowanceStatus, refresh: refreshAllowance } = await useAsyncData(
  'pro:usage:free-allowance',
  () => $fetch<{ allowance: FreeAllowanceView }>('/api/pro/usage'),
  { server: false },
)
const allowance = computed<FreeAllowanceView | null>(() => allowanceData.value?.allowance ?? null)
const meters = computed(() => allowance.value?._tag === 'Metered' ? meterRows(allowance.value.entitlements) : [])
const allowanceFailed = computed(() => allowanceStatus.value === 'error' || allowance.value?._tag === 'Unavailable')

// The Indexing API Quota stays local: this app sends those notifications
// itself. The endpoint returns `{ key, usage }` rows summed for the current
// calendar month, so this section carries no date range.
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

    <UCard v-if="meters.length || allowanceFailed">
      <template #header>
        <h3 class="text-sm font-semibold text-highlighted">
          {{ FREE_ALLOWANCE_HEADING }}
        </h3>
      </template>
      <div v-if="allowanceFailed" class="flex min-h-24 flex-wrap items-center gap-3 text-sm text-muted" role="alert">
        <span>{{ FREE_ALLOWANCE_READ_FAILURE }}</span>
        <UButton label="Retry" color="neutral" variant="outline" size="sm" @click="refreshAllowance()" />
      </div>
      <dl v-else class="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div v-for="meter in meters" :key="meter.key" class="min-w-0">
          <dt class="text-sm text-muted">
            {{ meter.label }}
          </dt>
          <dd class="mt-1 space-y-2">
            <div class="font-mono text-2xl tabular-nums text-highlighted">
              {{ meter.value }}
            </div>
            <UProgress
              v-if="meter.percent !== null"
              :model-value="meter.percent"
              :color="meter.full ? 'warning' : 'primary'"
              size="sm"
              :aria-label="`${meter.label}: ${meter.value}`"
            />
            <p class="text-xs text-muted">
              {{ meter.detail }}
            </p>
          </dd>
        </div>
      </dl>
    </UCard>

    <!-- U2: the shell already titles this page. -->
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
