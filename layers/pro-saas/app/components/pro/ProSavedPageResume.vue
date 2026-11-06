<script setup lang="ts">
import { PAGE_SETUP_COPY, PAGE_TASK_ROUTE } from '#layers/pro-saas/shared/page-task'

const { data } = await useFetch('/api/onboarding/page', { server: false, lazy: true })
</script>

<template>
  <aside v-if="data?._tag === 'Available'" class="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-default p-4">
    <div class="min-w-0 space-y-1">
      <p class="font-medium">
        {{ PAGE_SETUP_COPY.target }}
      </p>
      <p class="break-all text-sm text-muted">
        {{ data.url }}
      </p>
    </div>
    <UButton :to="PAGE_TASK_ROUTE" :label="PAGE_SETUP_COPY.resume" color="primary" class="min-h-11" />
  </aside>
</template>
