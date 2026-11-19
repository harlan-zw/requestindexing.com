<script setup lang="ts">
import type { GscConnectReturn } from '#layers/pro-gsc/shared/gsc-grant'
import { GSC_CONNECT_COPY as copy } from '#layers/pro-saas/shared/gsc-connect-copy'

// The message for a Google round trip that came back with no grant: the reader
// pressed Cancel on Google's screen, or Google or the callback failed. Before
// this, both ended in silence on the step they started from, or on an error
// page whose Try again repeated the failure.
//
// `retryTo` renders the retry control in the alert. The onboarding connect step
// omits it, because its own "Connect Google Search Console" button sits right
// below and is the retry.
const { result, retryTo } = defineProps<{
  result: GscConnectReturn
  /** Where Google returns the reader after the retry. Omit to hide the retry. */
  retryTo?: string
}>()

const message = computed(() => result._tag === 'Cancelled' ? copy.cancelled : copy.failed)
</script>

<template>
  <ProAlert
    :color="result._tag === 'Cancelled' ? 'info' : 'warning'"
    icon="i-lucide-shield-alert"
    :title="message.title"
    :description="message.description"
    :data-testid="result._tag === 'Cancelled' ? 'gsc-connect-cancelled' : 'gsc-connect-failed'"
  >
    <template v-if="retryTo" #action>
      <ConnectSearchConsoleButton :return-to="retryTo" />
    </template>
  </ProAlert>
</template>
