<script lang="ts" setup>
import type { AgentSetupRoute } from '#layers/pro-gsc/shared/agent-setup'
import type { CreatedDeveloperApiKey, DeveloperApiKey, DeveloperApiKeysState } from '#layers/pro-gsc/shared/developer-api-keys'
import { fetchSites } from '~~/layers/core/app/composables/fetch'
import ProAgentSetupPanel from '~~/layers/pro-saas/app/components/pro/ProAgentSetupPanel.vue'
import ProOnboardingStepGuide from '~~/layers/pro-saas/app/components/pro/ProOnboardingStepGuide.vue'
import { agentPromptGate } from '#layers/pro-gsc/shared/agent-prompt-site'
import { parseAgentSetupRoute } from '#layers/pro-gsc/shared/agent-setup'
import { DEVELOPER_API_KEY_LABEL_MAX } from '#layers/pro-gsc/shared/developer-api-keys'
import { buildApiExample, GSCDUMP_API_GUIDE_URL, presentApiKey } from '#layers/pro-gsc/shared/developer-setup'
import ProNoPropertyNotice from '#layers/pro-saas/app/components/pro/ProNoPropertyNotice.vue'
import { useNoSearchConsoleProperty } from '#layers/pro-saas/app/composables/useNoSearchConsoleProperty'
import { DEVELOPERS_COPY as copy, DEVELOPERS_AGENT_GUIDE } from '#layers/pro-saas/shared/developers-copy'
import { CONNECT_SITE_ROUTE } from '#layers/pro-saas/shared/onboarding'

// Agent setup after onboarding (GLOSSARY.md, Agent setup: one concept, two
// places), then the API keys. The agent panel is onboarding's own
// (`ProAgentSetupPanel`), so the two places never drift apart. A row shows
// Connect, which opens the same numbered steps in place. No row shows a
// status: gscdump reports no agent sign-in to this app (`agent-setup.ts`).
// The Agent setup guide hangs beside the panel. Ported from gscdump.com's
// Developers page (harlan-zw/gscdump.com#1402).
//
// The API keys are gscdump user keys that this app issues through the partner
// API. gscdump stores them; this page holds a new raw key in memory only,
// until the reader leaves the page.
definePageMeta({
  layout: 'pro-dashboard',
  title: 'Developers',
  icon: 'i-heroicons-command-line',
})

const route = useRoute()

// ── Agents ──────────────────────────────────────────────────────────────
// `?agent=` opens that row, and `?setup=cli` opens the Coding agent. The open
// row stays local: this app's router scrolls to the top on every query
// change (`layers/core/app/router.options.ts`), which would move the page
// away from the row the reader just opened.
function routeFromQuery(): AgentSetupRoute | null {
  return parseAgentSetupRoute(route.query.agent) ?? (route.query.setup === 'cli' ? 'coding-agent' : null)
}
const openRoute = ref<AgentSetupRoute | null>(routeFromQuery())
watch(() => [route.query.agent, route.query.setup], () => {
  openRoute.value = routeFromQuery()
})
function toggleRow(next: AgentSetupRoute) {
  openRoute.value = openRoute.value === next ? null : next
}

const { data: sitesData } = await fetchSites()
// The step that comes first, named above the agents: an agent reads the Sites
// this account syncs, so without one it can only come back empty.
const { session } = useUserSession()
const promptGate = computed(() => agentPromptGate({
  gscConnected: !!session.value?.gscConnected,
  sites: sitesData.value?.sites ?? [],
}))

// No Site, and a Google account with no Search Console property: an agent
// waits on a Site that cannot connect yet, so the page names the cause
// instead of Connect a Site (2026-10-01 replay, N6).
const noProperty = useNoSearchConsoleProperty(() => promptGate.value._tag === 'SiteRequired' && !sitesData.value?.sites.length)

// ── API keys ────────────────────────────────────────────────────────────
const proFetch = useProFetch()
const toast = useToast()
const { data: keysState, status: keysStatus, error: keysError, refresh: refreshKeys } = await useFetch<DeveloperApiKeysState>('/api/pro/developer/api-keys', {
  $fetch: proFetch,
  server: false,
})

const keys = computed<DeveloperApiKey[]>(() => keysState.value?._tag === 'Ready' ? keysState.value.keys : [])

// The newest raw key this visit created. It lives only in this ref, and the
// HTTP example reads it, so the example works as copied (UX replay A14).
const createdKey = ref<CreatedDeveloperApiKey | null>(null)
const createdKeyPresentation = computed(() => presentApiKey(createdKey.value?.apiKey ?? null))
const apiExample = computed(() => buildApiExample(
  createdKey.value?.apiKey ?? null,
  promptGate.value._tag === 'Ready' ? promptGate.value.site.gscdumpSiteId : null,
))

// A Pro API error carries its reader-facing message in the envelope.
function apiErrorMessage(error: unknown, fallback: string): string {
  const body = (error as { data?: { data?: { message?: unknown } } } | null)?.data
  const message = body?.data?.message
  return typeof message === 'string' && message ? message : fallback
}

const label = ref('')
const creating = ref(false)
const createError = ref<string | null>(null)

async function createKey() {
  if (creating.value)
    return
  const trimmed = label.value.trim()
  if (!trimmed) {
    createError.value = 'Enter a name for the key.'
    return
  }
  creating.value = true
  createError.value = null
  const result = await proFetch<CreatedDeveloperApiKey>('/api/pro/developer/api-keys', { method: 'POST', body: { label: trimmed } })
    .then(value => ({ _tag: 'Ok' as const, value }))
    .catch((error: unknown) => ({ _tag: 'Err' as const, error }))
  creating.value = false

  if (result._tag === 'Err') {
    createError.value = apiErrorMessage(result.error, 'The API key could not be created. Try again.')
    return
  }
  createdKey.value = result.value
  label.value = ''
  await refreshKeys()
}

const keyToRevoke = ref<DeveloperApiKey | null>(null)
const revoking = ref(false)
const revokeOpen = computed({
  get: () => keyToRevoke.value !== null,
  set: (open: boolean) => {
    if (!open && !revoking.value)
      keyToRevoke.value = null
  },
})

async function revokeKey() {
  const key = keyToRevoke.value
  if (!key)
    return
  revoking.value = true
  const result = await proFetch(`/api/pro/developer/api-keys/${encodeURIComponent(key.keyId)}`, { method: 'DELETE' })
    .then(() => ({ _tag: 'Ok' as const }))
    .catch((error: unknown) => ({ _tag: 'Err' as const, error }))
  revoking.value = false

  if (result._tag === 'Err') {
    toast.add({
      title: 'The API key could not be revoked',
      description: apiErrorMessage(result.error, 'Try again in a moment.'),
      color: 'error',
    })
    return
  }
  keyToRevoke.value = null
  if (createdKey.value?.keyId === key.keyId)
    createdKey.value = null
  toast.add({ title: 'API key revoked', description: `${key.label} no longer works.`, color: 'success' })
  await refreshKeys()
}

// ── Deep links ──────────────────────────────────────────────────────────
// `?setup=mcp` scrolls to the agents and `?setup=api` to the API keys. The
// router scrolls to `#api-keys` by itself.
onMounted(() => {
  const target = route.query.setup === 'api' ? 'api-keys' : route.query.setup === 'mcp' ? 'agents' : null
  if (target)
    document.getElementById(target)?.scrollIntoView?.({ block: 'start' })
})
</script>

<template>
  <div class="space-y-8">
    <!-- The step that comes first. Its strings predate this layout. -->
    <section
      v-if="promptGate._tag === 'SearchConsoleRequired'"
      aria-labelledby="developers-first-step"
      class="flex flex-col items-start gap-3 rounded-(--ui-radius) border border-default bg-[color-mix(in_oklab,var(--ui-bg-elevated)_35%,var(--ui-bg))] p-4 shadow-(--elevation-raised) sm:flex-row sm:items-center sm:justify-between sm:gap-6 dark:border-accented"
    >
      <div class="min-w-0 space-y-0.5">
        <h2 id="developers-first-step" class="text-sm font-medium text-highlighted">
          Connect Search Console first
        </h2>
        <p class="text-sm text-muted">
          The prompt reads the data that Request Indexing syncs from Search Console. Connect Search Console, then connect a Site.
        </p>
      </div>
      <ConnectSearchConsoleButton class="shrink-0" />
    </section>
    <section
      v-else-if="noProperty"
      aria-label="No Search Console property"
      class="rounded-(--ui-radius) border border-default bg-[color-mix(in_oklab,var(--ui-bg-elevated)_35%,var(--ui-bg))] p-4 shadow-(--elevation-raised) dark:border-accented"
    >
      <ProNoPropertyNotice :email="session?.gscEmail ?? null" gsc-return-to="/pro/dashboard/developers" heading-tag="h2" />
    </section>
    <section
      v-else-if="promptGate._tag === 'SiteRequired'"
      aria-labelledby="developers-first-step"
      class="flex flex-col items-start gap-3 rounded-(--ui-radius) border border-default bg-[color-mix(in_oklab,var(--ui-bg-elevated)_35%,var(--ui-bg))] p-4 shadow-(--elevation-raised) sm:flex-row sm:items-center sm:justify-between sm:gap-6 dark:border-accented"
    >
      <div class="min-w-0 space-y-0.5">
        <h2 id="developers-first-step" class="text-sm font-medium text-highlighted">
          Connect a Site first
        </h2>
        <p class="text-sm text-muted">
          The prompt reads the indexing record of a linked Site. You have no linked Site yet.
        </p>
      </div>
      <UiButton :to="CONNECT_SITE_ROUTE" purpose="cta" icon="add" class="min-h-11 shrink-0">
        Connect a Site
      </UiButton>
    </section>

    <!-- The main column, then the guide card: beside it from xl, after it
         below. At lg the sidebar leaves the column narrower than the card. -->
    <div class="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
      <div class="min-w-0 space-y-10">
        <section id="agents" aria-labelledby="agents-heading" class="scroll-mt-20 space-y-3" data-testid="developers-agents">
          <h2 id="agents-heading" class="sr-only">
            {{ copy.agentsHeading }}
          </h2>
          <p class="rounded-(--ui-radius) border border-default bg-muted/60 px-4 py-2.5 text-sm text-muted dark:border-accented">
            {{ copy.lead }}
          </p>
          <ProAgentSetupPanel place="developers" :route="openRoute" @choose="toggleRow">
            <template #actions="{ option, open }">
              <UiButton
                v-if="!open"
                purpose="secondary"
                size="sm"
                class="min-h-11 shrink-0 sm:min-h-9"
                :label="copy.connect"
                :aria-label="`${copy.connect} ${option.label}`"
                :data-testid="`developers-connect-${option.route}`"
                @click="toggleRow(option.route)"
              />
            </template>
          </ProAgentSetupPanel>
        </section>

        <section id="api-keys" aria-labelledby="api-keys-heading" class="scroll-mt-20 space-y-3">
          <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="api-keys-heading" class="text-base font-medium text-highlighted">
              {{ copy.apiKeysHeading }}
            </h2>
            <p class="text-sm text-muted">
              {{ copy.apiKeysHint }}
            </p>
          </div>

          <UiAlert
            v-if="keysError"
            status="error"
            icon="caution"
            title="Your API keys could not be loaded"
          >
            <template #action>
              <UiButton size="xs" purpose="secondary" @click="refreshKeys()">
                Retry
              </UiButton>
            </template>
          </UiAlert>

          <div v-else-if="keysStatus === 'pending' && !keysState" class="space-y-2" aria-label="Loading API keys">
            <UiSkeleton class="h-11 w-full rounded-lg" />
            <UiSkeleton class="h-14 w-full rounded-lg" />
          </div>

          <UiEmptyState
            v-else-if="keysState?._tag === 'SearchConsoleRequired'"
            icon="key"
            title="Connect Search Console first"
            description="API keys read the data that Request Indexing syncs from Search Console. Connect Search Console, then create a key."
            compact
          >
            <ConnectSearchConsoleButton />
          </UiEmptyState>

          <!-- One panel, as the agents are: the form, the new key, the keys,
               then the HTTP example, split by hairlines with no box inside. -->
          <div
            v-else-if="keysState?._tag === 'Ready'"
            class="divide-y divide-default overflow-hidden rounded-(--ui-radius) border border-default bg-[color-mix(in_oklab,var(--ui-bg-elevated)_35%,var(--ui-bg))] shadow-(--elevation-raised) dark:divide-accented dark:border-accented"
          >
            <form class="p-4" @submit.prevent="createKey()">
              <UFormField label="Key name" :error="createError || undefined" help="Use a name that tells you where the key is used.">
                <div class="flex flex-col gap-2 sm:flex-row">
                  <UiInput
                    :model-value="label" class="min-w-0 grow"
                    :placeholder="copy.keyNamePlaceholder"
                    autocomplete="off"
                    :maxlength="DEVELOPER_API_KEY_LABEL_MAX"
                    :disabled="creating"
                    @update:model-value="label = $event ?? ''"
                  />
                  <UiButton type="submit" purpose="secondary" icon="key" class="min-h-11 shrink-0 self-start sm:self-auto" :loading="creating">
                    Create API key
                  </UiButton>
                </div>
              </UFormField>
            </form>

            <div v-if="createdKey" class="space-y-2 bg-primary/5 p-4" role="status" data-testid="developers-created-key">
              <div>
                <p class="text-sm font-medium text-highlighted">
                  Copy {{ createdKey.label }} now
                </p>
                <p class="text-sm text-muted">
                  This page does not show the key again. If you lose it, revoke it and create a new key.
                </p>
              </div>
              <div class="flex min-h-11 items-center gap-2 rounded-lg border border-default bg-default py-1 pl-3 pr-1 dark:border-accented">
                <code class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-sm text-default">{{ createdKeyPresentation.display }}</code>
                <UiCopyButton :text="createdKeyPresentation.copy" label="Copy key" purpose="secondary" size="sm" class="min-h-11 shrink-0 sm:min-h-9" />
              </div>
              <p class="flex items-center gap-1.5 text-sm text-muted">
                <UiIcon name="check" class="size-4 shrink-0 text-primary" aria-hidden="true" />
                {{ copy.keyInExample }}
              </p>
            </div>

            <p v-if="!keys.length" class="px-4 py-3 text-sm text-muted">
              You have no API keys.
            </p>
            <ul v-else class="divide-y divide-default dark:divide-accented" aria-label="Your API keys">
              <!-- On a phone the name and preview take the first line, so neither
                   wraps; the dates and Revoke follow on the second. -->
              <li v-for="key in keys" :key="key.keyId" class="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <div class="min-w-0 basis-full sm:basis-0 sm:flex-1">
                  <p class="truncate text-sm font-medium text-highlighted">
                    {{ key.label }}
                  </p>
                  <p class="mt-0.5 truncate font-mono text-sm text-muted">
                    {{ key.preview }}
                  </p>
                </div>
                <dl class="flex flex-1 gap-4 text-sm text-muted sm:flex-none">
                  <div>
                    <dt class="text-xs text-dimmed">
                      Created
                    </dt>
                    <dd><UiRelativeTime :date="new Date(key.createdAt)" /></dd>
                  </div>
                  <div>
                    <dt class="text-xs text-dimmed">
                      Last used
                    </dt>
                    <dd>
                      <UiRelativeTime v-if="key.lastUsedAt !== null" :date="new Date(key.lastUsedAt)" />
                      <span v-else>Never</span>
                    </dd>
                  </div>
                </dl>
                <UiButton
                  purpose="quiet"
                  size="sm"
                  class="min-h-11 shrink-0 sm:min-h-9"
                  :aria-label="`Revoke ${key.label}`"
                  @click="keyToRevoke = key"
                >
                  Revoke
                </UiButton>
              </li>
            </ul>

            <details class="group px-4" data-testid="developers-http-example">
              <summary class="flex min-h-12 cursor-pointer list-none items-center gap-1.5 text-sm text-muted transition-colors duration-100 hover:text-default focus-visible:outline-2 focus-visible:outline-primary [&::-webkit-details-marker]:hidden">
                <UIcon name="chevron-right" class="size-4 transition-transform duration-100 group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
                {{ copy.httpExample }}
              </summary>
              <div class="space-y-2 pb-4">
                <p class="text-sm text-muted">
                  {{ apiExample.description }}
                </p>
                <!-- `contain: inline-size` keeps the command from widening
                     the panel on a phone. It scrolls beside the copy button. -->
                <div class="flex items-start rounded-lg border border-default bg-muted [contain:inline-size] dark:border-accented">
                  <pre class="min-w-0 flex-1 overflow-x-auto py-2.5 pl-3 pr-2 font-mono text-sm leading-6 text-default"><code>{{ apiExample.display }}</code></pre>
                  <div class="shrink-0 p-1">
                    <UiCopyButton :text="apiExample.copy" aria-label="Copy HTTP example" purpose="quiet" size="xs" />
                  </div>
                </div>
                <NuxtLink
                  :to="GSCDUMP_API_GUIDE_URL"
                  external
                  target="_blank"
                  class="inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline"
                >
                  {{ copy.apiGuide }}
                  <UiIcon name="external" class="size-3.5" aria-hidden="true" />
                </NuxtLink>
              </div>
            </details>
          </div>
        </section>
      </div>

      <!-- The Agent setup guide: what the reader can ask, and how agents sign in. -->
      <div class="xl:sticky xl:top-20">
        <ProOnboardingStepGuide :guide="DEVELOPERS_AGENT_GUIDE" name="developers" />
      </div>
    </div>

    <UModal
      v-model:open="revokeOpen"
      title="Revoke this API key?"
      :description="`${keyToRevoke?.label ?? 'This key'} stops working at once.`"
    >
      <template #body>
        <p class="text-sm text-muted">
          Every CLI, MCP client, or script that uses this key loses access. You cannot undo this. Create a new key to connect again.
        </p>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-3">
          <UiButton purpose="quiet" :disabled="revoking" @click="revokeOpen = false">
            Cancel
          </UiButton>
          <UiButton purpose="danger" :loading="revoking" @click="revokeKey()">
            Revoke key
          </UiButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
