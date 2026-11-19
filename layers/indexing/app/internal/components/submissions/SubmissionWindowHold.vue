<script setup lang="ts">
import type { IndexingSite } from '@nuxtseo/pro-indexing/shared/source'
import { useSubmissionSummary } from '#layers/indexing/app/composables/useSiteSubmissions'

// Keeps a Site's receipt window read while mounted. Renders nothing.
const { site } = defineProps<{ site: IndexingSite | null }>()
useSubmissionSummary(() => site)
</script>

<template>
  <template v-if="false" />
</template>
