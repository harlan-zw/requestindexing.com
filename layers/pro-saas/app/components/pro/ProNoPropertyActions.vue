<script setup lang="ts">
import { computed } from 'vue'
import { NO_PROPERTY_ACTIONS, SEARCH_CONSOLE_URL, VERIFY_SITE_HELP_URL } from '#layers/pro-gsc/shared/no-property-copy'

// "No property, actions" from COPY.md: the three ways out of a Google account
// with no Search Console property. Every surface that shows the no-property
// state renders these, so no surface offers a fourth label for the same step.
const { gscReturnTo, align = 'start' } = defineProps<{
  /** The page the Google grant returns to. */
  gscReturnTo: string
  align?: 'start' | 'center'
}>()

const gscConnectUrl = computed(() => `/auth/integrations/gsc/connect?returnTo=${encodeURIComponent(gscReturnTo)}`)
</script>

<template>
  <div class="flex flex-wrap gap-2" :class="align === 'center' ? 'justify-center' : ''">
    <UButton
      :to="SEARCH_CONSOLE_URL"
      target="_blank"
      rel="noopener"
      external
      color="neutral"
      variant="subtle"
      trailing-icon="i-heroicons-arrow-top-right-on-square"
      class="min-h-11"
      :label="NO_PROPERTY_ACTIONS.openSearchConsole"
    />
    <UButton :to="gscConnectUrl" external color="neutral" variant="ghost" class="min-h-11" :label="NO_PROPERTY_ACTIONS.connectAnotherAccount" />
  </div>
  <ULink
    :to="VERIFY_SITE_HELP_URL"
    target="_blank"
    rel="noopener"
    class="inline-flex min-h-11 items-center gap-1 text-sm text-muted underline"
  >
    {{ NO_PROPERTY_ACTIONS.howToVerify }}
  </ULink>
</template>
