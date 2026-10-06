<script setup lang="ts">
import type { AuthProviderId } from '#layers/pro-saas-auth/shared/types/auth'

import { $fetch } from '#imports'

interface IdentityRow {
  provider: AuthProviderId
  providerUserId: string
  email: string | null
  displayName: string | null
  avatarUrl: string | null
  linkedAt: string | null
  lastUsedAt: string | null
}

interface IdentitiesResponse {
  identities: IdentityRow[]
  canPromoteGoogle: boolean
  googleIntegrationEmail: string | null
  activeProvider: AuthProviderId
}

const { data, refresh, pending } = await useFetch<IdentitiesResponse>('/api/auth/identities')

const toast = useToast()

function errorRecord(error: unknown): Record<string, unknown> {
  return typeof error === 'object' && error !== null ? error as Record<string, unknown> : {}
}

function errorMessage(error: unknown): string {
  const record = errorRecord(error)
  const data = errorRecord(record.data)
  return typeof data.statusMessage === 'string'
    ? data.statusMessage
    : typeof record.message === 'string' ? record.message : 'Try again later.'
}

const disconnecting = ref<AuthProviderId | null>(null)
const promoting = ref(false)
const disconnectTarget = ref<AuthProviderId | null>(null)
const disconnectModalOpen = ref(false)

function providerLabel(p: AuthProviderId) {
  return p === 'google' ? 'Google' : 'GitHub'
}

function requestDisconnect(provider: AuthProviderId) {
  disconnectTarget.value = provider
  disconnectModalOpen.value = true
}

function cancelDisconnect() {
  disconnectModalOpen.value = false
  disconnectTarget.value = null
}

const disconnectIsActive = computed(() =>
  !!disconnectTarget.value && data.value?.activeProvider === disconnectTarget.value,
)

const remainingProviderLabel = computed(() => {
  const target = disconnectTarget.value
  if (!target)
    return ''
  const others = (data.value?.identities ?? []).filter(i => i.provider !== target)
  return others[0] ? providerLabel(others[0].provider) : ''
})

async function confirmDisconnect() {
  const provider = disconnectTarget.value
  if (!provider)
    return
  disconnecting.value = provider
  try {
    const res = await $fetch<{ ok: boolean, forceLogout?: boolean }>('/api/auth/disconnect', {
      method: 'POST',
      body: { provider },
    })
    disconnectModalOpen.value = false
    if (res.forceLogout) {
      toast.add({ title: 'Disconnected', description: `Sign in again with ${remainingProviderLabel.value || 'your remaining provider'}.`, color: 'success' })
      await navigateTo('/login', { external: true })
      return
    }
    toast.add({ title: `${providerLabel(provider)} disconnected`, color: 'success' })
    await refresh()
  }
  catch (error: unknown) {
    toast.add({ title: 'Disconnect failed', description: errorMessage(error), color: 'error' })
  }
  finally {
    disconnecting.value = null
  }
}

async function onPromoteGoogle() {
  promoting.value = true
  try {
    const res = await $fetch<{ status: string }>('/api/auth/promote-integration-to-identity', {
      method: 'POST',
      body: { provider: 'google' },
    })
    if (res.status === 'linked') {
      toast.add({ title: 'Google sign-in enabled', description: 'You can now sign in with either method.', color: 'success' })
    }
    else if (res.status === 'already_linked') {
      toast.add({ title: 'Already linked', color: 'info' })
    }
    await refresh()
  }
  catch (error: unknown) {
    const reason = errorRecord(errorRecord(errorRecord(error).data).data).reason
    if (reason === 'REAUTH_REQUIRED') {
      toast.add({ title: 'Re-authentication needed', description: 'Connect Google sign-in via OAuth.', color: 'warning' })
    }
    else {
      toast.add({ title: 'Could not enable Google sign-in', description: errorMessage(error), color: 'error' })
    }
  }
  finally {
    promoting.value = false
  }
}

function identityFor(provider: AuthProviderId): IdentityRow | undefined {
  return data.value?.identities.find(i => i.provider === provider)
}

const githubIdentity = computed(() => identityFor('github'))
const googleIdentity = computed(() => identityFor('google'))
const canPromoteGoogle = computed(() => !!data.value?.canPromoteGoogle)
const googleIntegrationEmail = computed(() => data.value?.googleIntegrationEmail ?? null)
const onlyOne = computed(() => (data.value?.identities.length ?? 0) <= 1)

function buildLinkHref(provider: AuthProviderId) {
  return `/auth/${provider}?intent=link`
}

function fmtDate(s: string | null) {
  if (!s)
    return null
  try {
    return new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })
  }
  catch { return null }
}
</script>

<template>
  <section class="space-y-3">
    <ProSectionHeader title="Connected accounts" icon="link" />
    <p class="text-sm text-muted">
      These sign-in methods open your Request Indexing account.
    </p>

    <div v-if="pending" class="grid min-w-0 gap-3">
      <ProCard v-for="i in 2" :key="i" variant="default" size="sm" class="min-w-0">
        <div class="flex min-w-0 items-start gap-3">
          <UiSkeleton type="bar" :index="i" class="size-10 rounded-2xl shrink-0" />
          <div class="flex-1 min-w-0 space-y-2">
            <UiSkeleton type="text" :index="i" :base="70" :range="20" />
            <UiSkeleton type="text" :index="i + 10" :base="200" :range="60" />
            <UiSkeleton type="text" :index="i + 20" :base="90" :range="20" class="!h-3" />
          </div>
          <UiSkeleton type="bar" :index="i + 30" class="h-7 w-20" />
        </div>
      </ProCard>
    </div>

    <div v-else class="grid min-w-0 gap-3">
      <!-- GitHub -->
      <ProCard variant="default" size="sm" class="min-w-0">
        <div class="flex min-w-0 items-start gap-3">
          <ProNavIcon icon="github" />
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline gap-2">
              <p class="text-base font-medium text-highlighted">
                GitHub
              </p>
              <UBadge
                v-if="githubIdentity && data?.activeProvider === 'github'"
                size="xs"
                color="primary"
                variant="subtle"
              >
                Active
              </UBadge>
            </div>
            <p v-if="githubIdentity" class="text-sm break-words text-muted">
              {{ githubIdentity.displayName ?? githubIdentity.email ?? 'Linked' }}
              <span v-if="githubIdentity.email && githubIdentity.displayName"> · {{ githubIdentity.email }}</span>
            </p>
            <p v-else class="text-sm text-muted">
              Not connected
            </p>
            <p v-if="githubIdentity && fmtDate(githubIdentity.linkedAt)" class="text-[11px] text-dimmed mt-1">
              Linked {{ fmtDate(githubIdentity.linkedAt) }}
            </p>
          </div>
          <UButton
            v-if="githubIdentity"
            color="neutral"
            variant="ghost"
            size="sm"
            :loading="disconnecting === 'github'"
            :disabled="onlyOne"
            @click="requestDisconnect('github')"
          >
            Disconnect
          </UButton>
          <UButton
            v-else
            color="primary"
            variant="subtle"
            size="sm"
            :to="buildLinkHref('github')"
            external
          >
            Connect
          </UButton>
        </div>
      </ProCard>

      <!-- Google: three states -->
      <ProCard variant="default" size="sm" class="min-w-0">
        <div class="flex min-w-0 items-start gap-3">
          <ProNavIcon icon="google" />
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline gap-2">
              <p class="text-base font-medium text-highlighted">
                Google
              </p>
              <UBadge
                v-if="googleIdentity && data?.activeProvider === 'google'"
                size="xs"
                color="primary"
                variant="subtle"
              >
                Active
              </UBadge>
            </div>

            <!-- State A: linked as sign-in identity -->
            <template v-if="googleIdentity">
              <p class="text-sm break-words text-muted">
                {{ googleIdentity.displayName ?? googleIdentity.email ?? 'Linked' }}
                <span v-if="googleIdentity.email && googleIdentity.displayName"> · {{ googleIdentity.email }}</span>
              </p>
              <p v-if="fmtDate(googleIdentity.linkedAt)" class="text-[11px] text-dimmed mt-1">
                Linked {{ fmtDate(googleIdentity.linkedAt) }}
              </p>
            </template>

            <!-- State B: GSC-connected but not a sign-in identity -->
            <template v-else-if="canPromoteGoogle">
              <p class="text-sm text-muted">
                <template v-if="googleIntegrationEmail">
                  {{ googleIntegrationEmail }} is connected for Search Console.
                </template>
                <template v-else>
                  Connected for Search Console.
                </template>
              </p>
              <p class="text-[11px] text-dimmed mt-1">
                You can enable Google sign-in. It needs no extra permissions.
              </p>
            </template>

            <!-- State C: not connected at all -->
            <template v-else>
              <p class="text-sm text-muted">
                Not connected
              </p>
            </template>
          </div>

          <UButton
            v-if="googleIdentity"
            color="neutral"
            variant="ghost"
            size="sm"
            :loading="disconnecting === 'google'"
            :disabled="onlyOne"
            @click="requestDisconnect('google')"
          >
            Disconnect
          </UButton>
          <UButton
            v-else-if="canPromoteGoogle"
            color="primary"
            variant="subtle"
            size="sm"
            :loading="promoting"
            @click="onPromoteGoogle"
          >
            Enable Google sign-in
          </UButton>
          <UButton
            v-else
            color="primary"
            variant="subtle"
            size="sm"
            :to="buildLinkHref('google')"
            external
          >
            Connect
          </UButton>
        </div>
      </ProCard>
    </div>

    <UModal v-model:open="disconnectModalOpen" :title="disconnectTarget ? `Disconnect ${providerLabel(disconnectTarget)}?` : 'Disconnect provider?'">
      <template #body>
        <div class="space-y-3">
          <ProAlert
            v-if="disconnectIsActive"
            color="warning"
            icon="log-out"
            title="You will be signed out"
            :description="`Next sign-in uses ${remainingProviderLabel || 'your remaining provider'}.`"
          />
          <p v-else class="text-sm text-muted">
            Next sign-in uses {{ remainingProviderLabel || 'your remaining provider' }}.
          </p>
          <p class="text-sm text-dimmed">
            Your subscription and site data stay unchanged.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2 w-full">
          <UButton
            variant="ghost"
            color="neutral"
            :disabled="!!disconnecting"
            @click="cancelDisconnect"
          >
            Cancel
          </UButton>
          <UButton
            color="error"
            :loading="!!disconnecting"
            @click="confirmDisconnect"
          >
            Disconnect
          </UButton>
        </div>
      </template>
    </UModal>
  </section>
</template>
