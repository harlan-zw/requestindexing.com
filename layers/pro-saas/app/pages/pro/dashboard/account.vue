<script setup lang="ts">
// The sidebar calls this page "Profile", so it opens with the signed-in
// person: avatar, name, email and sign-in method. Every field below comes from
// the session the `pro-saas` session plugin already publishes. No endpoint and
// no column was added for this page.
//
// The layer that owns `ProConnectedAccounts` opts out of auto-import, so the
// component is imported by path.
import ProConnectedAccounts from '#layers/pro-saas-auth/app/components/auth/ProConnectedAccounts.vue'
import { resolveGscConnection } from '#layers/pro-saas/shared/onboarding'

definePageMeta({
  layout: 'user-dashboard',
  title: 'Account',
  icon: 'i-ph-user-circle-duotone',
  description: 'Manage your profile, connected accounts and account data.',
})

const { session, fetch } = useUserSession()
const indexingAuth = computed(() => session.value?.googleIndexingAuth)
const logout = createLogoutHandler()
const toast = useToast()
const route = useRoute()

const user = computed(() => session.value?.user ?? null)
const displayName = computed(() => user.value?.name || user.value?.email || 'Your account')
const avatarUrl = computed(() => user.value?.avatarUrl || undefined)
const providerLabel = computed(() => user.value?.authProvider === 'google' ? 'Google' : 'GitHub')

// Search Console lives on `google_accounts`, not on an identity row. The
// session already carries the grant state, so the row below is a read of
// `gscConnected` / `gscEmail` rather than a second request.
const gscConnected = computed(() => !!session.value?.gscConnected)
const gscEmail = computed(() => session.value?.gscEmail ?? null)
const gscConnectHref = `/auth/integrations/gsc/connect?returnTo=${encodeURIComponent('/pro/dashboard/account')}`
// This page renders through `user-dashboard`, not the shell that reports a
// scope-missing grant, so it reports its own.
const gscScopeMissing = computed(() => resolveGscConnection({
  gscdumpConnected: !!session.value?.gscdumpConnected,
  accountStatus: session.value?.gscdumpAccountStatus ?? null,
  error: route.query.error,
})._tag === 'ScopeMissing')

// Identity linking bounces back here with `?notice=` / `?error=` from
// `attachIdentityToCurrentSession`. Without feedback the round trip through
// Google ends in silence, so users re-click "Connect" and hit the conflict path.
const linkNotices: Record<string, { title: string, description: string, color: 'success' | 'warning' | 'error' }> = {
  linked: {
    title: 'Account connected',
    description: 'Your Google account is now linked.',
    color: 'success',
  },
  already_linked: {
    title: 'Already connected',
    description: 'That account was already linked to your profile.',
    color: 'warning',
  },
  link_conflict: {
    title: 'Account in use',
    description: 'That Google account is linked to another user.',
    color: 'error',
  },
}
const linkNotice = computed(() => linkNotices[String(route.query.notice)] ?? linkNotices[String(route.query.error)])
onMounted(() => {
  if (linkNotice.value)
    toast.add(linkNotice.value)
})

// Revoking and deleting are modelled as states rather than booleans so the
// confirmation markup cannot render while the user is still in `idle`.
type RevokeState = { _tag: 'idle' } | { _tag: 'revoking' }
type DeleteState = { _tag: 'idle' } | { _tag: 'confirming' } | { _tag: 'deleting' }

const revokeState = ref<RevokeState>({ _tag: 'idle' })
const deleteState = ref<DeleteState>({ _tag: 'idle' })

// The dialog owns no state of its own: it is a projection of `deleteState`.
// Closing is only allowed while confirming, so an in-flight delete stays visible.
const isConfirmingDelete = computed({
  get: () => deleteState.value._tag !== 'idle',
  set: (open: boolean) => {
    if (!open && deleteState.value._tag === 'confirming')
      deleteState.value = { _tag: 'idle' }
  },
})

async function revokeIndexingAuth() {
  revokeState.value = { _tag: 'revoking' }
  try {
    await $fetch('/api/indexing/auth', {
      method: 'DELETE',
      headers: { Accept: 'text/json' },
    })
    toast.add({
      title: 'Google token revoked',
      description: 'You removed access to the Web Indexing API.',
      color: 'success',
    })
    await fetch()
  }
  catch {
    toast.add({
      title: 'Failed to revoke the Google token',
      description: 'The request failed. Try again later.',
      color: 'error',
    })
  }
  finally {
    revokeState.value = { _tag: 'idle' }
  }
}

async function deleteAccount() {
  deleteState.value = { _tag: 'deleting' }
  try {
    await $fetch('/api/user/me', {
      method: 'DELETE',
      headers: { Accept: 'text/json' },
    })
    toast.add({
      id: 'logout',
      title: 'Account deleted',
      description: 'We deleted your account and all of its data.',
      color: 'success',
    })
    session.value = null
    await logout()
  }
  catch {
    deleteState.value = { _tag: 'idle' }
    toast.add({
      title: 'Failed to delete the account',
      description: 'The request failed. Try again later.',
      color: 'error',
    })
  }
}
</script>

<template>
  <div class="max-w-3xl space-y-10">
    <ProGscScopeMissingAlert v-if="gscScopeMissing" retry-to="/pro/dashboard/account" />

    <section>
      <ProSectionHeader title="Profile" icon="user" />
      <ProCard variant="default">
        <div class="flex items-center gap-4">
          <UAvatar
            :src="avatarUrl"
            :alt="displayName"
            size="xl"
            class="shrink-0"
          />
          <div class="min-w-0">
            <p class="truncate text-base font-medium text-highlighted">
              {{ displayName }}
            </p>
            <p v-if="user?.email" class="truncate text-sm text-muted">
              {{ user.email }}
            </p>
            <p class="mt-1 text-xs text-dimmed">
              You signed in with {{ providerLabel }}.
            </p>
          </div>
        </div>
      </ProCard>
    </section>

    <ProConnectedAccounts />

    <section>
      <ProSectionHeader title="Search Console" icon="chart" />
      <ProCard variant="default">
        <div class="flex min-w-0 items-start gap-3">
          <ProNavIcon icon="google" :variant="gscConnected ? 'success' : 'default'" />
          <div class="min-w-0 flex-1">
            <div class="flex items-baseline gap-2">
              <p class="text-base font-medium text-highlighted">
                Google Search Console
              </p>
              <UBadge
                size="xs"
                :color="gscConnected ? 'success' : 'neutral'"
                variant="subtle"
              >
                {{ gscConnected ? 'Connected' : 'Not connected' }}
              </UBadge>
            </div>
            <p v-if="gscConnected" class="text-sm break-words text-muted">
              <template v-if="gscEmail">
                {{ gscEmail }} grants access to your properties.
              </template>
              <template v-else>
                This app reads your Search Console properties.
              </template>
            </p>
            <p v-else class="text-sm text-muted">
              Connect Search Console to load your search data.
            </p>
          </div>
          <UButton
            v-if="!gscConnected"
            color="primary"
            variant="subtle"
            size="sm"
            :to="gscConnectHref"
            external
            class="shrink-0"
          >
            Connect
          </UButton>
        </div>
      </ProCard>
    </section>

    <section>
      <ProSectionHeader title="Web Indexing API" icon="lock" />
      <ProCard variant="default">
        <template v-if="indexingAuth?.indexingOAuthId">
          <p class="mb-3 text-sm text-muted">
            You gave this app access to the Web Indexing API. You can revoke access at any time.
          </p>
          <UButton
            color="error"
            variant="outline"
            size="sm"
            class="self-start"
            :loading="revokeState._tag === 'revoking'"
            @click="revokeIndexingAuth"
          >
            Revoke tokens
          </UButton>
        </template>
        <p v-else class="text-sm text-muted">
          This app has no access to the Web Indexing API. Grant access when you request indexing.
        </p>
      </ProCard>
    </section>

    <!-- Demoted on purpose. Deleting the account used to be the only filled
         card on the page, so a red panel read as the page's main content. The
         action and its confirmation are unchanged; only the weight dropped. -->
    <section class="border-t border-default pt-6">
      <div class="mb-3 flex items-center gap-2">
        <ProNavIcon icon="warning" variant="error" />
        <h2 class="text-[13px] font-semibold tracking-tight">
          Danger zone
        </h2>
      </div>
      <p class="text-sm text-muted">
        Delete all data linked to your account.
      </p>
      <ul class="mt-2 ml-5 list-disc text-sm text-muted">
        <li>We delete every cached and stored record for your account.</li>
        <li>We revoke your Google account tokens.</li>
      </ul>
      <UButton
        color="error"
        variant="outline"
        size="sm"
        class="mt-4"
        @click="deleteState = { _tag: 'confirming' }"
      >
        Delete account
      </UButton>
    </section>

    <UModal
      v-model:open="isConfirmingDelete"
      title="Delete your account?"
      description="This action is irreversible. We delete all data linked to your account."
      :dismissible="deleteState._tag === 'confirming'"
    >
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="deleteState._tag === 'deleting'"
            @click="deleteState = { _tag: 'idle' }"
          >
            Cancel
          </UButton>
          <UButton
            color="error"
            :loading="deleteState._tag === 'deleting'"
            @click="deleteAccount"
          >
            Delete account
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
