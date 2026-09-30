<script lang="ts" setup>
// The one place a failed Search Console read is explained to the reader.
//
// Ported from nuxtseo.com's `ProGscReadError.vue`. Every route that charts
// gscdump data used to treat "no data" and "could not read the data" as the
// same screen: zeros on the overview, a blank region on the query and page
// deep dives. A reader whose credential had gone stale was told the site had
// no traffic. Centralised so every surface says the same true thing.
//
// `ProGscdumpError.vue` stays the full-panel empty-state variant. This one is
// an inline banner, so a page can keep its chart below the message.

import type { GscdumpErrorCode } from '../../composables/_gscdump-error'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { UiAlert, UiButton } from '#components'
import { parseGscdumpError } from '../../composables/_gscdump-error'

const { error } = defineProps<{
  /** Raw read failure. Null or undefined renders nothing. */
  error?: unknown
}>()

const failure = computed(() => (error ? parseGscdumpError(error) : null))

const route = useRoute()
// The OAuth connect flow, not the settings page. Its callback re-mints the
// gscdump credential, so this is the only link that repairs an AUTH failure.
const reconnectHref = computed(
  () => `/auth/integrations/gsc/connect?returnTo=${encodeURIComponent(route.fullPath)}`,
)

const READ_ACTION = {
  AUTH: 'reconnect',
  PERMISSION: 'none',
  NOT_FOUND: 'none',
  PROVISIONING: 'none',
  RATE_LIMIT: 'none',
  REFUSED: 'none',
  SERVER: 'none',
  NETWORK: 'none',
  VALIDATION: 'none',
  UNKNOWN: 'none',
} as const satisfies Record<GscdumpErrorCode, 'reconnect' | 'none'>

const action = computed(() => failure.value ? READ_ACTION[failure.value.code] : 'none')
</script>

<template>
  <UiAlert
    v-if="failure"
    status="error"
    :title="failure.message"
    description="Nothing has been lost. Search Console figures cannot be read right now, so they are shown as unavailable rather than zero."
  >
    <template v-if="action === 'reconnect'" #action>
      <UiButton size="xs" purpose="secondary" :to="reconnectHref" external>
        Reconnect Search Console
      </UiButton>
    </template>
  </UiAlert>
</template>
