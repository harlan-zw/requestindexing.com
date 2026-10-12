<script lang="ts" setup>
const props = defineProps<{
  siteId: string
}>()

// `useProGscStatus` polls while a sync runs and stops on purpose for a held
// Site, so the bar reads no status on a timer of its own.
const { data, refresh, isProcessing, isFullySynced } = useProGscStatus(() => props.siteId)

const progressPercent = computed(() => data.value?.syncProgress?.percent || 0)
const progressText = computed(() => {
  if (!data.value?.syncProgress)
    return 'Preparing Search Console data…'
  return `Preparing Search Console data: ${data.value.syncProgress.percent}%`
})
</script>

<template>
  <ProAlert
    v-if="isProcessing && !isFullySynced"
    color="info"
    icon="i-lucide-refresh-cw"
    :description="progressText"
  >
    <template #action>
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-refresh-cw"
        aria-label="Refresh Search Console status"
        @click="refresh"
      />
    </template>
    <template #progress>
      <div class="h-1 bg-info/10">
        <div
          class="h-full bg-info transition-[width] duration-500"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
    </template>
  </ProAlert>
</template>
