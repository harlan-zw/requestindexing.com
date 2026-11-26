<script setup lang="ts">
import type { AgentSetupRoute } from '#layers/pro-gsc/shared/agent-setup'
import ProAgentSetupPanel from '~~/layers/pro-saas/app/components/pro/ProAgentSetupPanel.vue'
import { AGENT_SETUP_COPY as copy } from '#layers/pro-gsc/shared/agent-setup'

// Agent setup: the first onboarding step. The agent panel is the one the
// Developers page shows (`ProAgentSetupPanel`); this step adds the skip line,
// the next step note, and the wizard nav. Skip agent setup moves on to
// Connect Google.
const { title, description } = defineProps<{ title: string, description?: string }>()

const emit = defineEmits<{ skip: [], next: [] }>()

const agent = defineModel<AgentSetupRoute | null>('agent', { default: null })
</script>

<template>
  <div data-testid="onboarding-step-agent" class="min-w-0 space-y-5">
    <UiAuthHeading size="md" :title="title" :description="description" />

    <!-- Skip leads the step on its own quiet line, as on gscdump.com, so a
         reader without an agent finds the web steps before the choices. It
         stacks on a phone. -->
    <div class="flex flex-col gap-1 rounded-(--ui-radius) border border-default bg-muted/60 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <p class="text-sm text-muted">
        {{ copy.skipLead }}
      </p>
      <UiButton
        purpose="link"
        size="sm"
        class="-ml-2.5 min-h-11 shrink-0 self-start font-medium text-default sm:ml-0 sm:min-h-9 sm:self-auto"
        :label="copy.skip"
        data-testid="step-skip"
        @click="emit('skip')"
      >
        <!-- @nuxtseo/design-system 0.1.12 passes `trailing-icon` to UButton
             without resolving the icon role, so the icon goes in the slot. -->
        <template #trailing>
          <UiIcon name="next" class="size-3.5" aria-hidden="true" />
        </template>
      </UiButton>
    </div>

    <ProAgentSetupPanel place="onboarding" :route="agent" @choose="agent = $event" />

    <p v-if="agent" class="text-sm text-muted">
      {{ copy.next }}
    </p>

    <!-- Skip agent setup sits under the heading, so the footer shows only
         Continue, once the reader chooses an agent. -->
    <UiWizardNav
      v-if="agent"
      show-next
      :next-label="copy.continue"
      next-purpose="secondary"
      @next="emit('next')"
    />
  </div>
</template>
