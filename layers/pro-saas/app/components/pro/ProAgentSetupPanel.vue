<script setup lang="ts">
import type { AgentSetupOption, AgentSetupPlace, AgentSetupRoute } from '#layers/pro-gsc/shared/agent-setup'
import {
  AGENT_SETUP_OPTIONS,
  agentSetupSteps,
  buildAgentSetupPrompt,
  CODING_AGENT_COMMANDS,
  AGENT_SETUP_COPY as copy,
} from '#layers/pro-gsc/shared/agent-setup'

// The agent panel that onboarding Agent setup and Developers share, as on
// gscdump.com: one row per agent with its real mark, and the open row's
// numbered steps. Every step keeps its number: Request Indexing cannot read a
// connection (`shared/agent-setup.ts`), and a status from a copy or a click
// would be false. The caller owns the open row, so this component only emits.
// Onboarding draws a choice mark in each row. Developers draws each row's
// action through the `actions` slot.
const { route = null, place } = defineProps<{
  /** The open row, or null while none is open. */
  route?: AgentSetupRoute | null
  place: AgentSetupPlace
}>()

const emit = defineEmits<{ choose: [route: AgentSetupRoute] }>()

defineSlots<{
  /** Developers only: the row's action, beside the row and outside its button. */
  actions?: (props: { option: AgentSetupOption, open: boolean }) => unknown
}>()

const setupPrompt = computed(() => route ? buildAgentSetupPrompt(route, place) : '')
const steps = computed(() => route ? agentSetupSteps(route) : [])

// One solid button: the first step's action. Onboarding's Continue stays
// secondary, because no read can confirm that the agent connected.
const primaryStep = computed(() => steps.value.find(step => step.action)?.key ?? null)
</script>

<template>
  <!-- In dark mode the default border is the elevated surface's colour, so
       the panel takes the accented border to keep its edge and rules. On
       onboarding the panel takes the onboarding card surface; on Developers it
       takes the dashboard card's fill, the elevated tone at 35% over the page,
       as ProCard does. The panel's own width decides where Developers puts a
       row's action, because the page sets it beside a guide card. -->
  <div
    role="group"
    :aria-label="copy.groupLabel"
    class="@container divide-y divide-default overflow-hidden rounded-(--ui-radius) border border-default shadow-(--elevation-raised) dark:divide-accented dark:border-accented"
    :class="place === 'developers' ? 'bg-[color-mix(in_oklab,var(--ui-bg-elevated)_35%,var(--ui-bg))]' : 'bg-elevated'"
  >
    <div
      v-for="option in AGENT_SETUP_OPTIONS"
      :key="option.route"
      :data-agent-row="option.route"
      :class="{ 'bg-muted/50 dark:bg-accented/20': place === 'developers' && route === option.route }"
    >
      <!-- On a narrow panel, Developers puts the action under the agent's
           name, so the detail keeps its width. -->
      <div :class="place === 'developers' ? 'grid @lg:grid-cols-[minmax(0,1fr)_auto] @lg:items-center @lg:gap-3 @lg:pr-4' : 'flex items-center'">
        <button
          type="button"
          :aria-pressed="route === option.route"
          :data-agent-route="option.route"
          class="flex min-h-14 w-full min-w-0 items-center gap-3 py-3 pl-4 text-left transition-colors duration-100 hover:bg-accented/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
          :class="place === 'developers' ? 'pr-4 @lg:pr-1' : 'pr-4'"
          @click="emit('choose', option.route)"
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
            v-if="place === 'onboarding'"
            class="size-4 shrink-0 rounded-full border transition-[border-width,border-color] duration-100"
            :class="route === option.route ? 'border-[5px] border-primary' : 'border-accented'"
            aria-hidden="true"
          />
        </button>
        <div v-if="place === 'developers' && $slots.actions" class="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 pb-3 pl-12 pr-4 empty:hidden @lg:p-0">
          <slot name="actions" :option="option" :open="route === option.route" />
        </div>
      </div>

      <div v-if="route === option.route" data-agent-setup="route" class="px-4 pb-4">
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
</template>
