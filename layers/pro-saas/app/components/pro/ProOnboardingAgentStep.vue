<script setup lang="ts">
import type { AgentSetupRoute } from '#layers/pro-gsc/shared/agent-setup'
import {
  AGENT_SETUP_OPTIONS,
  buildAgentSetupPrompt,
  CODING_AGENT_COMMANDS,
  AGENT_SETUP_COPY as copy,
  HOSTED_AGENT_ADD,
} from '#layers/pro-gsc/shared/agent-setup'

// Agent setup: the first onboarding step. The reader picks an agent, copies
// its Setup prompt, and approves the gscdump sign-in, or skips to Connect
// Google. It shows no connection status: Request Indexing cannot read one
// (`shared/agent-setup.ts`), and a status from the copy click would be false.
const { title, description } = defineProps<{ title: string, description?: string }>()

const emit = defineEmits<{ skip: [], next: [] }>()

const agent = defineModel<AgentSetupRoute | null>('agent', { default: null })

const chosen = computed(() => AGENT_SETUP_OPTIONS.find(option => option.route === agent.value) ?? null)
const setupPrompt = computed(() => agent.value ? buildAgentSetupPrompt(agent.value) : '')
const hostedAdd = computed(() => agent.value && agent.value !== 'coding-agent' ? HOSTED_AGENT_ADD[agent.value] : null)
</script>

<template>
  <div class="space-y-5">
    <UiAuthHeading size="md" :title="title" :description="description" />

    <div role="group" :aria-label="copy.groupLabel" class="grid gap-2 sm:grid-cols-3">
      <button
        v-for="option in AGENT_SETUP_OPTIONS"
        :key="option.route"
        type="button"
        :aria-pressed="agent === option.route"
        :data-agent-route="option.route"
        class="flex min-h-11 items-start gap-3 rounded-lg border p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        :class="agent === option.route ? 'border-primary bg-primary/5' : 'border-default hover:bg-elevated'"
        @click="agent = option.route"
      >
        <UIcon :name="option.icon" class="mt-0.5 size-5 shrink-0 text-highlighted" aria-hidden="true" />
        <span class="min-w-0">
          <span class="block text-sm font-medium text-highlighted">{{ option.label }}</span>
          <span class="mt-0.5 block text-xs text-muted">{{ option.detail }}</span>
        </span>
      </button>
    </div>

    <section v-if="chosen" data-agent-setup="route" class="space-y-4">
      <!-- A coding agent runs the setup itself, so its Setup prompt comes first. -->
      <template v-if="chosen.route === 'coding-agent'">
        <div class="space-y-2">
          <UiCopyButton :text="setupPrompt" :label="copy.copyPrompt" :copied-label="copy.promptCopied" purpose="cta" size="md" class="min-h-11" />
          <p class="text-xs text-muted">
            {{ copy.codingAgentHelp }}
          </p>
        </div>
        <details class="text-sm">
          <summary class="list-item min-h-11 cursor-pointer content-center text-muted">
            {{ copy.commandsSummary }}
          </summary>
          <ol class="mt-1 list-decimal space-y-1 pl-5 text-muted">
            <li v-for="step in CODING_AGENT_COMMANDS" :key="step.command">
              <code class="wrap-anywhere">{{ step.command }}</code>
              <span v-if="step.note" class="block text-xs">{{ step.note }}</span>
            </li>
          </ol>
        </details>
      </template>

      <!-- Claude and ChatGPT cannot add gscdump themselves. The reader adds
           it and approves the sign-in, then pastes the Setup prompt. -->
      <ol v-else-if="hostedAdd" class="list-decimal space-y-3 pl-5 text-sm text-default">
        <li class="space-y-2">
          <span class="block">{{ hostedAdd.step }}</span>
          <UiButton
            :to="hostedAdd.to"
            external
            target="_blank"
            rel="noopener"
            purpose="secondary"
            size="sm"
            class="min-h-11"
            trailing-icon="external"
            :label="hostedAdd.label"
          />
        </li>
        <li>{{ copy.signIn }}</li>
        <li class="space-y-2">
          <span class="block">{{ copy.pastePrompt(chosen.label) }}</span>
          <UiCopyButton :text="setupPrompt" :label="copy.copyPrompt" :copied-label="copy.promptCopied" purpose="secondary" size="sm" class="min-h-11" />
        </li>
      </ol>

      <p class="text-sm text-muted">
        {{ copy.next }}
      </p>
    </section>
  </div>

  <UiWizardNav
    :skip-label="copy.skip"
    :show-next="!!chosen"
    :next-label="copy.continue"
    @skip="emit('skip')"
    @next="emit('next')"
  />
</template>
