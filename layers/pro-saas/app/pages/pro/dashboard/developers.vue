<script lang="ts" setup>
import type { CreatedDeveloperApiKey, DeveloperApiKey, DeveloperApiKeysState } from '#layers/pro-gsc/shared/developer-api-keys'
import type { SetupMethod } from '#layers/pro-gsc/shared/developer-setup'
import { useClipboard } from '@vueuse/core'
import { fetchSites } from '~~/layers/core/app/composables/fetch'
import { agentPromptSite } from '#layers/pro-gsc/shared/agent-prompt-site'
import { DEVELOPER_API_KEY_LABEL_MAX } from '#layers/pro-gsc/shared/developer-api-keys'
import { buildAgentSetupPrompt, buildSetupSteps, presentApiKey } from '#layers/pro-gsc/shared/developer-setup'
import { CONNECT_SITE_ROUTE } from '#layers/pro-saas/shared/onboarding'

// Ported from nuxtseo.com's `developers/index.vue` and `DevApiTokenCreate.vue`.
// This app has no API of its own: its data plane is gscdump (VISION.md), so
// every setup method points at gscdump. The API keys are gscdump user keys
// that this app issues through the partner API. gscdump stores them; this page
// holds a new raw key in memory only, until the reader leaves the page.
definePageMeta({
  layout: 'pro-dashboard',
  title: 'Developers',
  icon: 'i-heroicons-command-line',
})

interface ClientIcon { label: string, icon: string }
interface SetupMethodOption {
  id: SetupMethod
  label: string
  hint: string
  description: string
  clients: ClientIcon[]
}

const setupMethods: SetupMethodOption[] = [
  {
    id: 'cli',
    label: 'CLI',
    hint: 'Recommended',
    description: 'Use it in a terminal or from a coding agent.',
    clients: [
      { label: 'Claude Code', icon: 'i-simple-icons-anthropic' },
      { label: 'Cursor', icon: 'i-simple-icons-cursor' },
      { label: 'Codex CLI', icon: 'i-simple-icons-openai' },
    ],
  },
  {
    id: 'mcp',
    label: 'MCP',
    hint: 'No terminal',
    description: 'Connect a hosted AI client.',
    clients: [
      { label: 'Claude', icon: 'i-simple-icons-anthropic' },
      { label: 'ChatGPT', icon: 'i-simple-icons-openai' },
      { label: 'Cursor', icon: 'i-simple-icons-cursor' },
    ],
  },
  {
    id: 'api',
    label: 'API',
    hint: 'Scripts',
    description: 'Call the HTTP API directly.',
    clients: [
      { label: 'cURL', icon: 'i-simple-icons-curl' },
    ],
  },
]

const route = useRoute()

function parseSetupMethod(value: unknown): SetupMethod {
  return value === 'mcp' || value === 'api' ? value : 'cli'
}

const setupMethod = computed(() => parseSetupMethod(route.query.setup))

function selectSetupMethod(method: SetupMethod) {
  void navigateTo({ query: { ...route.query, setup: method === 'cli' ? undefined : method } }, { replace: true })
}

const quickStartDescription = computed(() => {
  if (setupMethod.value === 'mcp')
    return 'Add the server once. Then ask your client about your Search Console data.'
  if (setupMethod.value === 'api')
    return 'Send your API key as a bearer token.'
  return 'Sign in once on each machine. Then run queries from the terminal or an agent.'
})

// API keys
const proFetch = useProFetch()
const toast = useToast()
const { data: keysState, status: keysStatus, error: keysError, refresh: refreshKeys } = await useFetch<DeveloperApiKeysState>('/api/pro/developer/api-keys', {
  $fetch: proFetch,
  server: false,
})
const { data: sitesData } = await fetchSites()

const keys = computed<DeveloperApiKey[]>(() => keysState.value?._tag === 'Ready' ? keysState.value.keys : [])
const firstSite = computed(() => sitesData.value?.sites.find(site => site.gscdumpSiteId) ?? null)
const firstSiteId = computed(() => firstSite.value?.gscdumpSiteId ?? null)
// The Site the agent setup prompt reads. Null means the prompt has nothing to
// read, so the page names the step that comes first instead of offering it.
const promptSite = computed(() => agentPromptSite(sitesData.value?.sites ?? []))

// The newest raw key this visit created, from the form or from the agent setup
// prompt. It lives only in this ref. The manual steps read only this ref: the
// prompt used to keep its key in a ref of its own, so after a copy the steps
// still showed $GSCDUMP_API_KEY (UX replay A14).
const createdKey = ref<CreatedDeveloperApiKey | null>(null)
const createdKeyPresentation = computed(() => presentApiKey(createdKey.value?.apiKey ?? null))
const steps = computed(() => buildSetupSteps(setupMethod.value, createdKey.value?.apiKey ?? null, firstSiteId.value))

// One-click agent setup, ported from gscdump.com's `AppOverviewAgentSetup`.
// The first click creates an API key named "Agent setup". Later clicks on this
// visit reuse it, so repeated copies do not fill the key limit. Like any new
// key, the raw value lives only in this ref.
const AGENT_SETUP_KEY_LABEL = 'Agent setup'
const agentKey = ref<CreatedDeveloperApiKey | null>(null)
const preparingPrompt = ref(false)

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
  if (agentKey.value?.keyId === key.keyId)
    agentKey.value = null
  toast.add({ title: 'API key revoked', description: `${key.label} no longer works.`, color: 'success' })
  await refreshKeys()
}

const { copy, copied } = useClipboard({ legacy: true })
const copiedValue = ref<string | null>(null)
function copyValue(value: string) {
  copiedValue.value = value
  void copy(value)
}

async function copyAgentSetupPrompt() {
  const site = promptSite.value
  if (preparingPrompt.value || !site)
    return
  preparingPrompt.value = true
  const reused = agentKey.value
  // Safari allows a clipboard write only during the click, and the key request
  // ends after it. So the clipboard gets the prompt as a promise now, and the
  // promise resolves when the key exists. Create the promise once: if the
  // clipboard falls back to its legacy copy, it reads the same promise again.
  const prompt = (reused
    ? Promise.resolve(reused)
    : proFetch<CreatedDeveloperApiKey>('/api/pro/developer/api-keys', { method: 'POST', body: { label: AGENT_SETUP_KEY_LABEL } })
  ).then((key) => {
    agentKey.value = key
    createdKey.value = key
    return buildAgentSetupPrompt(key.apiKey, site)
  })
  copiedValue.value = null
  const result = await copy(() => prompt)
    .then(() => ({ _tag: 'Ok' as const }))
    .catch((error: unknown) => ({ _tag: 'Err' as const, error }))
  preparingPrompt.value = false

  if (result._tag === 'Err') {
    toast.add({
      title: 'The setup prompt could not be copied',
      description: agentKey.value
        ? 'The browser did not allow the copy. Try again, or use the manual setup below.'
        : apiErrorMessage(result.error, 'The API key for the prompt could not be created. Try again, or use the manual setup below.'),
      color: 'error',
    })
    return
  }
  toast.add({
    title: 'Setup prompt copied',
    description: 'Paste it into Claude Code, Codex, or Cursor.',
    color: 'success',
  })
  if (!reused)
    await refreshKeys()
}
</script>

<template>
  <div class="max-w-3xl space-y-8">
    <p class="text-sm text-muted">
      Request Indexing runs on <a href="https://gscdump.com" target="_blank" rel="noopener" class="text-primary hover:underline">gscdump</a>.
      The gscdump CLI, MCP server, and API read the same Search Console data this account syncs.
    </p>

    <section id="api-keys" aria-labelledby="api-keys-heading" class="scroll-mt-20">
      <h2 id="api-keys-heading" class="text-base font-semibold text-highlighted">
        API keys
      </h2>
      <p class="mt-1 text-sm text-muted">
        An API key signs in the CLI, MCP clients, and the API as you. Only you can see your keys.
      </p>

      <UiAlert
        v-if="keysError"
        class="mt-4"
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

      <div v-else-if="keysStatus === 'pending' && !keysState" class="mt-4 space-y-2" aria-label="Loading API keys">
        <UiSkeleton class="h-11 w-full rounded-lg" />
        <UiSkeleton class="h-14 w-full rounded-lg" />
      </div>

      <UiEmptyState
        v-else-if="keysState?._tag === 'SearchConsoleRequired'"
        class="mt-4"
        icon="key"
        title="Connect Search Console first"
        description="API keys read the data that Request Indexing syncs from Search Console. Connect Search Console, then create a key."
        compact
      >
        <ConnectSearchConsoleButton />
      </UiEmptyState>

      <template v-else-if="keysState?._tag === 'Ready'">
        <form class="mt-4" @submit.prevent="createKey()">
          <UFormField label="Key name" :error="createError || undefined" help="Use a name that tells you where the key is used.">
            <div class="flex flex-col gap-2 sm:flex-row">
              <UiInput
                v-model="label"
                class="min-w-0 grow"
                placeholder="Laptop CLI"
                autocomplete="off"
                :maxlength="DEVELOPER_API_KEY_LABEL_MAX"
                :disabled="creating"
              />
              <UiButton type="submit" purpose="cta" icon="key" class="min-h-11 shrink-0" :loading="creating">
                Create API key
              </UiButton>
            </div>
          </UFormField>
        </form>

        <div
          v-if="createdKey"
          class="mt-4 rounded-xl border border-default bg-elevated p-4"
          role="status"
        >
          <p class="text-sm font-medium text-highlighted">
            Copy {{ createdKey.label }} now
          </p>
          <p class="mt-0.5 text-sm text-muted">
            This page does not show the key again. If you lose it, revoke it and create a new key.
          </p>
          <div class="mt-3 flex min-h-11 items-center gap-2 rounded-lg border border-default bg-muted px-3 py-2">
            <code class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-xs text-default">{{ createdKeyPresentation.display }}</code>
            <UiButton
              :icon="copied && copiedValue === createdKeyPresentation.copy ? 'check' : 'copy'"
              purpose="secondary"
              size="sm"
              class="min-h-11 shrink-0"
              @click="copyValue(createdKeyPresentation.copy)"
            >
              {{ copied && copiedValue === createdKeyPresentation.copy ? 'Copied' : 'Copy key' }}
            </UiButton>
          </div>
          <p class="mt-2 inline-flex items-center gap-1 text-xs text-muted">
            <UiIcon name="check" class="size-3.5 text-success" aria-hidden="true" />
            The setup steps below include this key.
          </p>
        </div>

        <p v-if="!keys.length" class="mt-4 text-sm text-muted">
          You have no API keys.
        </p>
        <ul v-else class="mt-4 divide-y divide-default overflow-hidden rounded-xl border border-default bg-default" aria-label="Your API keys">
          <li v-for="key in keys" :key="key.keyId" class="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-highlighted">
                {{ key.label }}
              </p>
              <p class="mt-0.5 truncate font-mono text-xs text-muted">
                {{ key.preview }}
              </p>
            </div>
            <dl class="flex gap-4 text-xs text-muted">
              <div>
                <dt class="text-dimmed">
                  Created
                </dt>
                <dd><UiRelativeTime :date="new Date(key.createdAt)" /></dd>
              </div>
              <div>
                <dt class="text-dimmed">
                  Last used
                </dt>
                <dd>
                  <UiRelativeTime v-if="key.lastUsedAt !== null" :date="new Date(key.lastUsedAt)" />
                  <span v-else>Never</span>
                </dd>
              </div>
            </dl>
            <UiButton
              purpose="danger"
              size="sm"
              icon="delete"
              class="min-h-11"
              :aria-label="`Revoke ${key.label}`"
              @click="keyToRevoke = key"
            >
              Revoke
            </UiButton>
          </li>
        </ul>
      </template>
    </section>

    <section aria-labelledby="setup-method-heading">
      <h2 id="setup-method-heading" class="text-base font-semibold text-highlighted">
        Choose how to connect
      </h2>
      <p class="mt-1 text-sm text-muted">
        Every option reads the same data.
      </p>

      <div class="mt-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Setup method">
        <button
          v-for="method in setupMethods"
          :id="`setup-${method.id}`"
          :key="method.id"
          type="button"
          role="tab"
          :aria-selected="setupMethod === method.id"
          aria-controls="setup-quick-start"
          class="relative min-h-24 min-w-44 flex-1 cursor-pointer rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary"
          :class="setupMethod === method.id ? 'border-accented bg-elevated text-highlighted' : 'border-default bg-default text-muted hover:border-accented hover:text-default'"
          @click="selectSetupMethod(method.id)"
        >
          <span class="flex items-center justify-between gap-2">
            <span class="text-sm font-semibold">{{ method.label }}</span>
            <span class="text-xs" :class="setupMethod === method.id ? 'text-primary' : 'text-dimmed'">{{ method.hint }}</span>
          </span>
          <span class="mt-1 block text-xs text-muted">{{ method.description }}</span>
          <span class="mt-3 flex items-center gap-2 text-dimmed" aria-hidden="true">
            <UIcon
              v-for="client in method.clients"
              :key="client.label"
              :name="client.icon"
              class="size-4 shrink-0"
            />
          </span>
          <span class="sr-only">{{ method.clients.map(client => client.label).join(', ') }}</span>
        </button>
      </div>
    </section>

    <section
      id="setup-quick-start"
      role="tabpanel"
      :aria-labelledby="`setup-${setupMethod}`"
    >
      <h2 class="text-base font-semibold text-highlighted">
        Quick start
      </h2>
      <p class="mt-1 text-sm text-muted">
        {{ quickStartDescription }}
      </p>

      <div v-if="setupMethod === 'cli'" role="group" aria-labelledby="agent-setup-heading" class="mt-5">
        <h3 id="agent-setup-heading" class="text-sm font-medium text-highlighted">
          Agent setup
        </h3>
        <p class="mt-0.5 text-sm text-muted">
          Paste one prompt into Claude Code, Codex, or Cursor. The agent installs the CLI and the skill, then summarises the stored URL Inspection verdicts for your pages.
          The first copy creates an API key named {{ AGENT_SETUP_KEY_LABEL }}.
        </p>
        <UiButton
          v-if="keysState?._tag === 'Ready' && promptSite"
          purpose="secondary"
          icon="copy"
          class="mt-3 min-h-11"
          :loading="preparingPrompt"
          @click="copyAgentSetupPrompt()"
        >
          Copy agent setup prompt
        </UiButton>
        <UiEmptyState
          v-else-if="keysState?._tag === 'Ready'"
          class="mt-3"
          icon="globe"
          title="Connect a Site first"
          description="The prompt reads the indexing record of a linked Site. You have no linked Site yet."
          compact
        >
          <UiButton :to="CONNECT_SITE_ROUTE" purpose="cta" icon="add" class="min-h-11">
            Connect a Site
          </UiButton>
        </UiEmptyState>
        <UiSkeleton v-else-if="keysStatus === 'pending' && !keysState" class="mt-3 h-11 w-60 rounded-lg" />
        <a v-else href="#api-keys" class="mt-2 inline-flex min-h-11 items-center text-sm text-primary hover:underline">Go to API keys</a>
      </div>

      <h3 v-if="setupMethod === 'cli'" class="mt-8 text-sm font-medium text-highlighted">
        Manual setup
      </h3>

      <ol class="flex flex-col gap-6" :class="setupMethod === 'cli' ? 'mt-4' : 'mt-5'">
        <li v-for="(step, i) in steps" :key="step.title" class="flex gap-3">
          <span class="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-default bg-elevated font-mono text-xs text-muted">
            {{ i + 1 }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-highlighted">
              {{ step.title }}
            </p>
            <p class="mt-0.5 text-sm text-muted">
              {{ step.body }}
            </p>

            <template v-if="step._tag === 'command'">
              <div class="mt-2.5 flex min-h-11 items-center gap-2 rounded-lg border border-default bg-muted px-3 py-2">
                <code tabindex="0" class="min-w-0 flex-1 overflow-x-auto whitespace-pre text-xs text-default">{{ step.command.display }}</code>
                <UiButton
                  :icon="copied && copiedValue === step.command.copy ? 'check' : 'copy'"
                  purpose="quiet"
                  size="xs"
                  class="min-h-11 min-w-11 shrink-0"
                  :aria-label="copied && copiedValue === step.command.copy ? `Copied: ${step.title}` : `Copy: ${step.title}`"
                  @click="copyValue(step.command.copy)"
                />
              </div>
              <NuxtLink
                v-if="step.link"
                :to="step.link.to"
                external
                target="_blank"
                class="mt-1 inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline"
              >
                {{ step.link.label }}
                <UiIcon name="external" class="size-3.5" aria-hidden="true" />
              </NuxtLink>
            </template>

            <p v-else-if="step._tag === 'api-key'" class="mt-2 inline-flex min-h-11 items-center gap-1.5 text-sm">
              <template v-if="createdKey">
                <UiIcon name="check" class="size-4 text-success" aria-hidden="true" />
                <span class="text-default">Using {{ createdKey.label }}</span>
              </template>
              <a v-else href="#api-keys" class="text-primary hover:underline">Go to API keys</a>
            </p>

            <NuxtLink
              v-else
              :to="step.to"
              external
              target="_blank"
              class="mt-2 inline-flex min-h-11 items-center gap-1 text-sm text-primary hover:underline"
            >
              {{ step.label }}
              <UiIcon name="external" class="size-3.5" aria-hidden="true" />
            </NuxtLink>
          </div>
        </li>
      </ol>
    </section>

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
