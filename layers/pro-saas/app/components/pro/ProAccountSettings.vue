<script setup lang="ts">
import { useGscdumpIntegration, useGscdumpIntegrationPatch } from '#layers/pro-gsc/app/composables/useGscdumpIntegration'

const props = defineProps<{
  title?: string
  description?: string
}>()

const toast = useToast()
const { integration, status, browserAnalyzerEnabled } = useGscdumpIntegration()
const { patchIntegration } = useGscdumpIntegrationPatch()

const pending = computed(() => status.value === 'pending' && integration.value === null)
const browserAnalyzerOn = computed(() => browserAnalyzerEnabled.value)

const saving = ref(false)

async function onToggleBrowserAnalyzer(next: boolean) {
  if (saving.value)
    return
  saving.value = true
  await patchIntegration({ browserAnalyzerEnabled: next })
    .then(() => {
      toast.add({
        title: next ? 'Browser analyzer enabled' : 'Browser analyzer disabled',
        description: next
          ? 'Eligible Sites will load analytics directly in your browser. Reload other tabs to apply.'
          : 'All analytics will run on the server. Reload other tabs to apply.',
        color: 'success',
      })
    })
    .catch((e) => {
      toast.add({
        title: 'Failed to update setting',
        description: e?.data?.message || e?.message || 'Please try again.',
        color: 'error',
      })
    })
    .finally(() => {
      saving.value = false
    })
}
</script>

<template>
  <ProCard
    variant="subtle"
    :title="props.title || 'Settings'"
    :description="props.description || 'Tune how your dashboard fetches analytics data.'"
  >
    <div v-if="pending" class="flex items-center gap-2 text-sm text-muted">
      <UIcon name="i-lucide-loader-2" class="size-4 animate-spin" />
      Loading…
    </div>
    <div v-else class="flex items-start justify-between gap-4">
      <div class="flex items-start gap-3 min-w-0">
        <ProNavIcon icon="i-lucide-zap" />
        <div class="min-w-0">
          <p class="flex flex-wrap items-center gap-2 font-medium">
            <span>Browser analyzer</span>
            <UBadge color="warning" variant="subtle" size="xs">
              Experimental
            </UBadge>
          </p>
          <p class="text-sm text-muted">
            Run analytics in your browser via DuckDB-WASM for eligible sites.
            Faster after first load; falls back to the server automatically.
          </p>
        </div>
      </div>
      <USwitch
        :model-value="browserAnalyzerOn"
        :loading="saving"
        :disabled="saving"
        aria-label="Enable browser analyzer"
        @update:model-value="onToggleBrowserAnalyzer"
      />
    </div>
  </ProCard>
</template>
