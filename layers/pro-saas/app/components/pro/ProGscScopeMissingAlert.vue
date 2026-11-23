<script setup lang="ts">
import { GSC_CONNECT_COPY } from '#layers/pro-saas/shared/gsc-connect-copy'

// The message for a Google grant with no Search Console scope. The OAuth
// callback returns `?error=gsc_scope_missing` when the user unticked that box
// on Google's consent screen; without this the round trip ended in silence and
// the first sign of trouble was a failed read pages later.
//
// `retryTo` renders the retry control in the alert. The onboarding connect step
// omits it, because its own "Connect Google Search Console" button sits right
// below and is the retry.
const { retryTo } = defineProps<{
  /** Where Google returns the reader after the retry. Omit to hide the retry. */
  retryTo?: string
}>()
</script>

<template>
  <ProAlert
    color="warning"
    icon="i-lucide-shield-alert"
    title="Search Console access was not granted"
    :description="GSC_CONNECT_COPY.connectMissingScope"
    data-testid="gsc-scope-missing"
  >
    <template v-if="retryTo" #action>
      <ConnectSearchConsoleButton :return-to="retryTo" />
    </template>
  </ProAlert>
</template>
