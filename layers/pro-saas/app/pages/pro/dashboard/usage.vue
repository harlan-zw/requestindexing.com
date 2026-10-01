<script setup lang="ts">
// The account's Free allowance. gscdump counts it per Billing owner across
// every Site, so it lives beside Account, not on one Site's tabs: a Site page
// that said "Sites 3 of 3" under one domain misread as that Site's number.
// nuxtseo.com shows its account usage from the user menu too ("Billing &
// Usage"); this app has no billing, so the page is Usage alone.
//
// The per-Site "API Usage" tab keeps the local Indexing API Quota.
import type { FreeAllowanceView } from '#layers/pro-gsc/shared/free-allowance'
import { FREE_ALLOWANCE_HEADING, FREE_ALLOWANCE_NONE, FREE_ALLOWANCE_READ_FAILURE, meterRows } from '#layers/pro-gsc/shared/entitlement-copy'

definePageMeta({
  layout: 'user-dashboard',
  title: 'Usage',
  icon: 'i-ph-gauge-duotone',
  description: 'Your Free allowance, counted for your account across every Site.',
})

// The realtime resync re-reads every Nuxt data key a few seconds after load.
// `defer` joins a read already running instead of restarting it, and the
// allowance stays on screen during a re-read. The 2026-10-01 replay once saw
// "Loading your Free allowance" 8 s after a reload.
const { data, status, refresh } = await useAsyncData(
  'pro:usage:free-allowance',
  () => $fetch<{ allowance: FreeAllowanceView }>('/api/pro/usage'),
  { server: false, dedupe: 'defer' },
)

const allowance = computed<FreeAllowanceView | null>(() => data.value?.allowance ?? null)
const meters = computed(() => allowance.value?._tag === 'Metered' ? meterRows(allowance.value.entitlements) : [])
const failed = computed(() => status.value === 'error' || allowance.value?._tag === 'Unavailable')
const pending = computed(() => !data.value && status.value !== 'error')
</script>

<template>
  <div class="max-w-3xl space-y-10">
    <section>
      <ProSectionHeader :title="FREE_ALLOWANCE_HEADING" icon="gauge" />
      <ProCard variant="default">
        <div v-if="pending" class="flex items-center justify-center py-8" aria-live="polite">
          <UIcon name="i-heroicons-arrow-path" class="size-5 animate-spin text-muted" />
          <span class="sr-only">Loading your Free allowance</span>
        </div>
        <div v-else-if="failed" class="flex min-h-24 flex-wrap items-center gap-3 text-sm text-muted" role="alert">
          <span>{{ FREE_ALLOWANCE_READ_FAILURE }}</span>
          <UButton label="Retry" color="neutral" variant="outline" size="sm" @click="refresh()" />
        </div>
        <!-- Exempt, or an account gscdump does not know yet: no Meter applies. -->
        <p v-else-if="!meters.length" class="py-6 text-sm text-muted">
          {{ FREE_ALLOWANCE_NONE }}
        </p>
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
      </ProCard>
    </section>
  </div>
</template>
