<script setup lang="ts">
import type { IndexNowConnectionV1 } from '@gscdump/contracts/v1'
import { computed, ref } from 'vue'
import { viewAutomaticSending } from '#layers/indexing/shared/submissions'
import { AUTOMATIC_SENDING_COPY, describeAutomaticSending } from '#layers/indexing/shared/submissions-copy'
import { useProGscdump } from '#layers/pro-gsc/app/composables/useProGscdump/useProGscdump'

// The automatic sending switch (gscdump.com ADR-0031). gscdump owns the state;
// this reads it from the connection and writes it with one PATCH. The verify
// action on the IndexNow page turns it on, so a reader only uses this switch
// to turn it off, or back on.
const { connection, engineSiteId, canWrite, bare = false, preventTurnOn = false, preventTurnOnReason = null } = defineProps<{
  connection: IndexNowConnectionV1
  /** `sites.gscdumpSiteId`: this calls the engine. */
  engineSiteId: string
  canWrite: boolean
  /**
   * The switch alone, named for assistive technology only. The shared
   * Submissions card draws the label and the state beside it.
   */
  bare?: boolean
  /** Block enabling automatic sending (e.g. unconfirmed staging/preview host), while still allowing turning it off. */
  preventTurnOn?: boolean
  preventTurnOnReason?: string | null
}>()

const emit = defineEmits<{ updated: [connection: IndexNowConnectionV1] }>()

const gscdump = useProGscdump()
const busy = ref(false)
const failed = ref(false)

const view = computed(() => viewAutomaticSending(connection))
const isOn = computed(() => connection._tag !== 'disconnected' && connection.automaticSending._tag === 'on')
const switchDisabled = computed(() => !canWrite || busy.value || connection._tag === 'disconnected' || (!isOn.value && preventTurnOn))
const lines = computed(() => describeAutomaticSending(view.value))

async function change(value: boolean) {
  if (!canWrite || busy.value || connection._tag === 'disconnected' || (value && preventTurnOn))
    return
  const siteId = engineSiteId
  busy.value = true
  failed.value = false
  const result = await gscdump.updateSiteIndexNowAutomaticSending({ params: { siteId }, body: { automaticSending: value ? 'on' : 'off' } }, true)
    .then(data => ({ _tag: 'ok' as const, data }))
    .catch((error: unknown) => ({ _tag: 'error' as const, error }))
  busy.value = false
  if (siteId !== engineSiteId)
    return
  if (result._tag === 'error') {
    failed.value = true
    return
  }
  emit('updated', result.data)
}
</script>

<template>
  <div v-if="bare" class="flex flex-col items-start gap-1 sm:items-end">
    <USwitch
      :model-value="isOn"
      :aria-label="AUTOMATIC_SENDING_COPY.label"
      :disabled="switchDisabled"
      :loading="busy"
      @update:model-value="change($event === true)"
    />
    <p v-if="failed" role="status" class="text-sm text-error">
      {{ AUTOMATIC_SENDING_COPY.changeFailed }}
    </p>
  </div>
  <div v-else class="space-y-3">
    <USwitch
      :model-value="isOn"
      :label="AUTOMATIC_SENDING_COPY.label"
      :description="AUTOMATIC_SENDING_COPY.description"
      :disabled="switchDisabled"
      :loading="busy"
      :ui="{ label: 'text-base', description: 'text-base text-muted' }"
      @update:model-value="change($event === true)"
    />
    <p v-if="!isOn && preventTurnOn && preventTurnOnReason" class="text-sm text-warning">
      {{ preventTurnOnReason }}
    </p>
    <p v-for="line in lines" :key="line" class="text-base text-muted">
      {{ line }}
    </p>
    <p v-if="failed" role="status" class="text-base text-error">
      {{ AUTOMATIC_SENDING_COPY.changeFailed }}
    </p>
  </div>
</template>
