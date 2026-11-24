<script setup lang="ts">
import { GOOGLE_ACCOUNT_SENTENCE } from '#layers/pro-gsc/shared/agent-setup'
import { GSC_CONNECT_COPY as copy } from '#layers/pro-saas/shared/gsc-connect-copy'

// Connect Google's consent preview (COPY.md, Connect Google assets): what
// Google's screen will ask for, before the reader leaves for it, and how to
// take the access back. The scope line is Google's own description of
// `webmasters.readonly`, the only Search Console scope setup asks for.
//
// The signed-in row names the account only for a Google sign-in. A GitHub
// sign-in says nothing about the Google account the consent screen uses, and
// the step shows its GitHub note instead.
//
// The fill is the dashboard card's: the elevated tone at 35% over the page,
// mixed solid so the setup backdrop does not show through. In dark mode the
// full elevated tone reads as a muddy olive.
const { session } = useUserSession()
const googleUser = computed(() => {
  const user = session.value?.user
  return user?.authProvider === 'google' && user.email ? { email: user.email, name: user.name, avatarUrl: user.avatarUrl } : null
})
</script>

<template>
  <div
    data-testid="gsc-consent-preview"
    class="rounded-(--ui-radius) border border-default bg-[color-mix(in_oklab,var(--ui-bg-elevated)_35%,var(--ui-bg))] p-4 shadow-(--elevation-raised) dark:border-accented"
  >
    <p class="text-xs text-muted">
      {{ copy.consent.ask }}
    </p>
    <p class="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-base text-highlighted">
      <span class="rounded-md border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">{{ copy.consent.readOnly }}</span>
      <span>{{ copy.consent.scope }}</span>
    </p>
    <!-- The Read-only chip states the access, so no sentence repeats it.
         Google's screen offers every signed-in Google account, so the
         preview says which one to choose before the reader leaves. -->
    <p class="mt-2 text-sm text-muted">
      {{ GOOGLE_ACCOUNT_SENTENCE }}
    </p>
    <p class="mt-1 text-sm text-muted">
      {{ copy.remove }}
      <ULink :to="copy.removeHref" external target="_blank" rel="noopener" class="font-medium text-highlighted underline">
        {{ copy.removeAction }}
      </ULink>.
    </p>
    <div v-if="googleUser" class="mt-3 flex min-w-0 items-center gap-2.5 border-t border-default pt-3 text-sm text-muted dark:border-accented" data-testid="gsc-consent-account">
      <UAvatar :src="googleUser.avatarUrl || undefined" :alt="googleUser.name || googleUser.email" size="xs" />
      <span class="min-w-0 truncate">{{ copy.consent.signedInAs }} <span class="font-medium text-highlighted">{{ googleUser.email }}</span></span>
    </div>
  </div>
</template>
