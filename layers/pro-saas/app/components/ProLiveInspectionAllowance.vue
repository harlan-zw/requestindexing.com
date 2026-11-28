<script setup lang="ts">
import type { FreeAllowanceView } from '#layers/pro-gsc/shared/free-allowance'
import { computed } from 'vue'
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'
import { meterRows } from '#layers/pro-gsc/shared/entitlement-copy'

const { user } = useUserSession()
const { data } = useAsyncData(
  () => `live-inspection-allowance:${user.value?.id}:${user.value?.currentTeamId}`,
  () => getAppFetch()<{ allowance: FreeAllowanceView }>('/api/pro/usage'),
  { server: false, dedupe: 'defer' },
)
const meter = computed(() => data.value?.allowance._tag === 'Metered'
  ? meterRows(data.value.allowance.entitlements).find(row => row.key === 'url_inspections')
  : null)
</script>

<template>
  <div class="border-t border-default px-4 py-3 text-sm">
    <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <span>Free allowance<span v-if="meter" class="ms-2 tabular-nums">{{ meter.value }}</span></span>
      <NuxtLink to="/pro/dashboard/usage" class="text-primary hover:underline">
        Usage
      </NuxtLink>
    </div>
    <UProgress v-if="meter?.percent != null" class="mt-2" :model-value="meter.percent" :aria-label="meter.label" :color="meter.full ? 'warning' : 'primary'" size="xs" />
    <p v-if="meter" class="mt-1 text-xs text-muted">
      {{ meter.label }} · {{ meter.detail }}
    </p>
  </div>
</template>
