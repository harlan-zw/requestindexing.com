<script setup lang="ts">
import type { AgentSetupRoute } from '#layers/pro-gsc/shared/agent-setup'
import {
  AGENT_SETUP_OPTIONS,
  agentSetupSteps,
  buildAgentSetupPrompt,
  CODING_AGENT_COMMANDS,
  AGENT_SETUP_COPY as copy,
} from '#layers/pro-gsc/shared/agent-setup'

// Agent setup: the first onboarding step. The agents sit as rows in one
// panel, as on gscdump and nuxtseo.com. The chosen row opens into numbered
// steps. Every step keeps its number: Request Indexing cannot read a
// connection (`shared/agent-setup.ts`), and a status from a copy or a click
// would be false. Skip agent setup moves on to Connect Google.
const { title, description } = defineProps<{ title: string, description?: string }>()

const emit = defineEmits<{ skip: [], next: [] }>()

const agent = defineModel<AgentSetupRoute | null>('agent', { default: null })

const chosen = computed(() => AGENT_SETUP_OPTIONS.find(option => option.route === agent.value) ?? null)
const setupPrompt = computed(() => agent.value ? buildAgentSetupPrompt(agent.value) : '')
const steps = computed(() => agent.value ? agentSetupSteps(agent.value) : [])

// One solid button: the first step's action. Continue stays secondary,
// because no read can confirm that the agent connected.
const primaryStep = computed(() => steps.value.find(step => step.action)?.key ?? null)
</script>

<template>
  <div data-testid="onboarding-step-agent" class="min-w-0 space-y-5">
    <UiAuthHeading size="md" :title="title" :description="description" />

    <!-- In dark mode the default border is the elevated surface's colour, so
         the panel takes the accented border to keep its edge and rules. -->
    <div
      role="group"
      :aria-label="copy.groupLabel"
      class="divide-y divide-default overflow-hidden rounded-(--ui-radius) border border-default bg-elevated shadow-(--elevation-raised) dark:divide-accented dark:border-accented"
    >
      <div v-for="option in AGENT_SETUP_OPTIONS" :key="option.route">
        <button
          type="button"
          :aria-pressed="agent === option.route"
          :data-agent-route="option.route"
          class="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-100 hover:bg-accented/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          @click="agent = option.route"
        >
          <UIcon :name="option.icon" class="size-5 shrink-0 text-highlighted" :class="{ 'dark:invert': option.invertDark }" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span class="block text-base font-medium text-highlighted">{{ option.label }}</span>
            <!-- The Coding agent row names its agents by their marks, as gscdump.com does. -->
            <span v-if="option.detail._tag === 'Marks'" class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span v-for="mark in option.detail.marks" :key="mark.label" class="inline-flex items-center gap-1.5">
                <UIcon :name="mark.icon" class="size-4 shrink-0" :class="{ 'dark:invert': mark.invertDark }" aria-hidden="true" />
                {{ mark.label }}
              </span>
              <span>{{ option.detail.more }}</span>
            </span>
            <span v-else class="block text-sm text-muted">{{ option.detail.text }}</span>
          </span>
          <span
            class="size-4 shrink-0 rounded-full border transition-[border-width,border-color] duration-100"
            :class="agent === option.route ? 'border-[5px] border-primary' : 'border-accented'"
            aria-hidden="true"
          />
        </button>

        <div v-if="agent === option.route" data-agent-setup="route" class="px-4 pb-4">
          <ol>
            <li
              v-for="(step, index) in steps"
              :key="step.key"
              :data-agent-setup-step="step.key"
              class="flex items-start gap-3 py-2.5"
            >
              <span
                class="mt-px inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-accented text-xs font-medium tabular-nums text-muted"
                aria-hidden="true"
              >{{ index + 1 }}</span>
              <div class="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-highlighted">
                    {{ step.title }}
                  </p>
                  <p class="text-sm text-muted">
                    {{ step.detail }}
                  </p>
                  <div v-if="step.paste" class="mt-1.5 flex min-w-0 items-center gap-1">
                    <code class="min-w-0 break-all rounded-md bg-muted px-2 py-1 font-mono text-sm text-default">{{ step.paste }}</code>
                    <UiCopyButton :text="step.paste" :aria-label="copy.copyServerUrl" purpose="quiet" size="xs" class="shrink-0" />
                  </div>
                </div>
                <UiButton
                  v-if="step.action?._tag === 'Link'"
                  :to="step.action.to"
                  external
                  target="_blank"
                  rel="noopener"
                  :purpose="primaryStep === step.key ? 'cta' : 'secondary'"
                  size="sm"
                  class="min-h-11 shrink-0 self-start sm:min-h-9 sm:self-auto"
                  trailing-icon="external"
                  :label="step.action.label"
                />
                <UiCopyButton
                  v-else-if="step.action?._tag === 'CopyPrompt'"
                  :text="setupPrompt"
                  :label="copy.copyPrompt"
                  :copied-label="copy.promptCopied"
                  :purpose="primaryStep === step.key ? 'cta' : 'secondary'"
                  size="sm"
                  class="min-h-11 shrink-0 self-start sm:min-h-9 sm:self-auto"
                />
              </div>
            </li>
          </ol>

          <details v-if="option.route === 'coding-agent'" class="group min-w-0 pl-8">
            <summary class="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-sm text-sm text-muted transition-colors duration-100 hover:text-default focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
              <UIcon name="chevron-right" class="size-4 transition-transform duration-100 group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
              {{ copy.runCommands }}
            </summary>
            <!-- `contain: inline-size` keeps a long command from widening the
                 panel, which would clip it and the copy button on a phone.
                 The commands scroll beside the copy button instead. -->
            <div class="flex items-start rounded-lg border border-default bg-muted [contain:inline-size]">
              <pre class="min-w-0 flex-1 overflow-x-auto py-2.5 pl-3 pr-2 font-mono text-sm leading-6 text-default"><code>{{ CODING_AGENT_COMMANDS }}</code></pre>
              <div class="shrink-0 p-1">
                <UiCopyButton :text="CODING_AGENT_COMMANDS" :aria-label="copy.copyCommands" purpose="quiet" size="xs" />
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>

    <p v-if="chosen" class="text-sm text-muted">
      {{ copy.next }}
    </p>

    <UiWizardNav
      :skip-label="copy.skip"
      :show-next="!!chosen"
      :next-label="copy.continue"
      next-purpose="secondary"
      @skip="emit('skip')"
      @next="emit('next')"
    />
  </div>
</template>
