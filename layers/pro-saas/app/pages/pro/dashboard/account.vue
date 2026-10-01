<script setup lang="ts">
// The sidebar calls this page "Profile", so it opens with the signed-in
// person: avatar, name, email and sign-in method. Every field below comes from
// the session the `pro-saas` session plugin already publishes. No endpoint and
// no column was added for this page.
//
// The layer that owns `ProConnectedAccounts` opts out of auto-import, so the
// component is imported by path.
import type { IndexingGrant } from '#layers/pro-indexing/shared/contracts/indexing-grant'
import ProConnectedAccounts from '#layers/pro-saas-auth/app/components/auth/ProConnectedAccounts.vue'
import { ACCOUNT_DELETED_PATH, accountDeletionCopy } from '#layers/pro-saas/shared/account-deletion-copy'
import { resolveGscConnection } from '#layers/pro-saas/shared/onboarding'

definePageMeta({
  layout: 'user-dashboard',
  title: 'Account',
  icon: 'i-ph-user-circle-duotone',
  description: 'Manage your profile, connected accounts and account data.',
})

const { session } = useUserSession()
// The stored grant the submit route sends with. `session.googleIndexingAuth`
// is the in-flight OAuth state instead: set before Google asks for consent,
// gone after the next sign-in, and kept after a revoke.
const { data: indexingGrant, error: indexingGrantError, refresh: refreshIndexingGrant } = useFetch<IndexingGrant>('/api/indexing/auth', { key: 'indexing-grant' })
const toast = useToast()
const route = useRoute()

const user = computed(() => session.value?.user ?? null)
const displayName = computed(() => user.value?.name || user.value?.email || 'Your account')
const avatarUrl = computed(() => user.value?.avatarUrl || undefined)
const providerLabel = computed(() => user.value?.authProvider === 'google' ? 'Google' : 'GitHub')

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
      description: 'You removed access to the Indexing API.',
      color: 'success',
    })
    await refreshIndexingGrant()
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
  const deleted = await $fetch('/api/user/me', {
    method: 'DELETE',
    headers: { Accept: 'text/json' },
  }).then(() => true, () => false)
  if (!deleted) {
    deleteState.value = { _tag: 'idle' }
    toast.add({
      title: 'Failed to delete the account',
      description: 'The request failed. Try again later.',
      color: 'error',
    })
    return
  }
  // The route already cleared the session cookie. A full page load drops every
  // client cache of the account and lands on the page that confirms the delete,
  // as on nuxtseo.com. The sign-out handler is not used: its "See you next
  // time!" toast replaced the confirmation (UX replay N4).
  await navigateTo(ACCOUNT_DELETED_PATH, { external: true, replace: true })
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

    <p class="text-sm">
      <NuxtLink to="/pro/dashboard/integrations" class="text-primary hover:underline">
        Manage Google Search Console and Bing on Integrations
      </NuxtLink>
    </p>

    <section>
      <ProSectionHeader title="Indexing API" icon="lock" />
      <ProCard variant="default">
        <template v-if="indexingGrantError">
          <p class="mb-3 text-sm text-muted">
            Indexing API access could not load. Retry to read the stored grant.
          </p>
          <UButton
            color="neutral"
            variant="outline"
            size="sm"
            class="self-start"
            @click="refreshIndexingGrant()"
          >
            Retry loading
          </UButton>
        </template>
        <USkeleton v-else-if="!indexingGrant" class="h-5 w-2/3" />
        <template v-else-if="indexingGrant._tag === 'Granted'">
          <p class="mb-3 text-sm break-words text-muted">
            <template v-if="indexingGrant.googleEmail">
              {{ indexingGrant.googleEmail }} gave this app access to the Indexing API.
            </template>
            <template v-else>
              You gave this app access to the Indexing API.
            </template>
            You can revoke access at any time.
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
          This app has no access to the Indexing API. To grant access, open the Submit to Google page of a Site.
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
        {{ accountDeletionCopy.blastRadius }} {{ accountDeletionCopy.permanent }}
      </p>
      <ProAccountDeletionScope class="mt-2" />
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
      title="Delete account?"
      :dismissible="deleteState._tag === 'confirming'"
    >
      <template #body>
        <div class="space-y-4">
          <UAlert
            color="error"
            variant="subtle"
            icon="warning"
            title="This is permanent"
            :description="accountDeletionCopy.blastRadius"
          />
          <ProAccountDeletionScope />
        </div>
      </template>
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
            Delete my account
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
