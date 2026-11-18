<script setup lang="ts">
import { NO_PROPERTY_DETAIL, NO_PROPERTY_DETAIL_OUTSIDE_LIST, noPropertyTitle } from '#layers/pro-gsc/shared/no-property-copy'
import ProNoPropertyActions from './ProNoPropertyActions.vue'

// The no-property state: the reader's Google account holds no Search Console
// property, so no Site can connect yet. Connect a Site, the Integrations row,
// and each page that offers Connect a Site with no Site connected render this
// one block, so every surface says the same thing (2026-10-01 replay, N6).
// The caller places the frame.
const { email, gscReturnTo, inList = false, headingTag = 'p' } = defineProps<{
  /** The Google account of the Search Console grant. */
  email: string | null
  /** The page the Google grant returns to. */
  gscReturnTo: string
  /** Under the property list, where Refresh list reads the properties again. */
  inList?: boolean
  headingTag?: 'p' | 'h2' | 'h3'
}>()
</script>

<template>
  <div class="space-y-3" data-testid="gsc-no-property">
    <div class="space-y-1">
      <component :is="headingTag" class="text-sm font-medium text-highlighted break-words">
        {{ noPropertyTitle(email) }}
      </component>
      <p class="text-sm text-muted">
        {{ inList ? NO_PROPERTY_DETAIL : NO_PROPERTY_DETAIL_OUTSIDE_LIST }}
      </p>
    </div>
    <ProNoPropertyActions :gsc-return-to="gscReturnTo" />
  </div>
</template>
