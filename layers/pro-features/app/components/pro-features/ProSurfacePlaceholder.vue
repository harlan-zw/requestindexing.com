<script setup lang="ts">
// Stand-in body for a nav row whose page has not been built yet.
//
// The manifest is the whole IA, so a row it declares has to lead somewhere. A
// row that 404s teaches the reader the sidebar lies. This says the surface is
// coming and names the phase that brings it, and every use of it is deleted by
// the phase that builds the real page.
import { computed } from 'vue'
import { UiEmptyState } from '#components'
import { findProSiteFeatureEntry } from '../../../shared/manifest'

const { feature, description } = defineProps<{
  /** Manifest id of the row this page serves. */
  feature: string
  description: string
}>()

const entry = computed(() => findProSiteFeatureEntry(feature))
</script>

<template>
  <div class="flex flex-col gap-5" data-testid="surface-placeholder">
    <h1 class="text-xl font-semibold text-highlighted">
      {{ entry?.label ?? feature }}
    </h1>
    <UiEmptyState
      :icon="entry?.icon ?? 'hourglass'"
      title="Not built yet"
      :description="description"
      :animated="false"
    />
  </div>
</template>
