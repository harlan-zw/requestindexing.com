<script setup lang="ts">
import type { AuthProviderId } from '#layers/pro-saas-auth/shared/types/auth'
import { safeAuthRedirect } from '#layers/pro-saas-auth/shared/utils/auth-redirect'

definePageMeta({
  layout: 'auth',
  pageTransition: { name: 'auth-content', mode: 'out-in' },
})

const { loggedIn, fetch: fetchSession } = useUserSession()
await fetchSession()

const { features } = useProSaasFeatures()
const googleEnabled = computed(() => features.value.googleSignIn)
const githubEnabled = computed(() => features.value.githubSignIn)

const route = useRoute()

const redirectTarget = computed(() => safeAuthRedirect(route.query.redirect))

if (loggedIn.value)
  await navigateTo(redirectTarget.value ?? '/pro/dashboard', { replace: true })

const error = computed(() => route.query.error as string | undefined)
const conflictProvider = computed(() => route.query.provider as AuthProviderId | undefined)
const conflictEmail = computed(() => route.query.email as string | undefined)

const noAccountFound = computed(() => error.value === 'no_account')
const conflictError = computed(() => error.value === 'use_existing_provider' && !!conflictProvider.value)
const emailNotVerified = computed(() => error.value === 'email_not_verified')
const emailLookupFailed = computed(() => error.value === 'email_lookup_failed')
// The refusing provider, when the callback named one.
const refusingProvider = computed(() => {
  if (conflictProvider.value === 'google')
    return 'Google'
  if (conflictProvider.value === 'github')
    return 'GitHub'
  return null
})

const errorVariant = computed<'no_account' | 'conflict' | 'email_not_verified' | 'email_lookup_failed' | 'generic' | null>(() => {
  if (!error.value)
    return null
  if (noAccountFound.value)
    return 'no_account'
  if (conflictError.value)
    return 'conflict'
  if (emailNotVerified.value)
    return 'email_not_verified'
  if (emailLookupFailed.value)
    return 'email_lookup_failed'
  return 'generic'
})

const errorTitle = computed(() => {
  if (noAccountFound.value)
    return 'No account found'
  if (conflictError.value)
    return 'Account exists with another sign-in method'
  if (emailNotVerified.value)
    return refusingProvider.value ? `Verify your email with ${refusingProvider.value} first` : 'Verify your email first'
  if (emailLookupFailed.value)
    return 'We could not check your email'
  if (error.value)
    return 'Sign in failed'
  return undefined
})

const errorDescription = computed(() => {
  if (noAccountFound.value)
    return undefined
  if (conflictError.value) {
    const provider = conflictProvider.value === 'google' ? 'Google' : 'GitHub'
    const emailNote = conflictEmail.value ? `Your account at ${conflictEmail.value} signs in with ${provider}.` : `Your account signs in with ${provider}.`
    return `${emailNote} Continue with ${provider} to access it.`
  }
  if (emailNotVerified.value) {
    const provider = refusingProvider.value ?? 'Your sign-in provider'
    return `${provider} reports that your email is not verified. Sign-in needs a verified email to keep your account and team invitations safe. Verify it, then try again.`
  }
  if (emailLookupFailed.value) {
    const provider = refusingProvider.value ?? 'Your sign-in provider'
    return `${provider} did not answer our email check, so sign-in stopped. This is usually temporary. Try again in a minute.`
  }
  // Raw provider failures (config errors, network errors) arrive as free text.
  if (error.value)
    return error.value
  return undefined
})

const lastProvider = ref<AuthProviderId | null>(null)
const LAST_PROVIDER_KEY = 'nuxtseo:auth:last-provider'
onMounted(() => {
  const stored = localStorage.getItem(LAST_PROVIDER_KEY)
  if (stored === 'github' || stored === 'google')
    lastProvider.value = stored
})

function buildHref(provider: AuthProviderId, source?: string): string {
  const params: string[] = []
  const target = redirectTarget.value
  if (target)
    params.push(`redirect=${encodeURIComponent(target)}`)
  if (source)
    params.push(`source=${source}`)
  return `/auth/${provider}${params.length ? `?${params.join('&')}` : ''}`
}

function rememberProvider(provider: AuthProviderId) {
  try {
    localStorage.setItem(LAST_PROVIDER_KEY, provider)
  }
  catch {
    // Browser storage can be unavailable; remembering the provider is optional.
  }
}

interface ProviderButton {
  id: AuthProviderId
  label: string
  icon: string
  enabled: boolean
}

const providerButtons = computed<ProviderButton[]>(() => {
  // Google leads. It is the identity that also reaches Search Console, so a
  // GitHub-only account has more setup ahead of it than a Google one.
  const all: ProviderButton[] = [
    { id: 'google', label: 'Sign in with Google', icon: 'i-simple-icons-google', enabled: googleEnabled.value },
    { id: 'github', label: 'Sign in with GitHub', icon: 'i-simple-icons-github', enabled: githubEnabled.value },
  ]
  const enabled = all.filter(p => p.enabled)
  if (!lastProvider.value)
    return enabled
  // Promote last-used to the top.
  return [...enabled.filter(p => p.id === lastProvider.value), ...enabled.filter(p => p.id !== lastProvider.value)]
})

useRobotsRule(false)
useSeoMeta({
  title: 'Sign in',
  description: 'Sign in to your Request Indexing account.',
})
</script>

<template>
  <div data-testid="login-page">
    <div class="mb-6">
      <h1 class="text-3xl font-semibold tracking-tight text-highlighted leading-[1.1] mb-3">
        Welcome back
      </h1>
      <p class="text-muted text-sm leading-relaxed">
        Sign in to your dashboard.
      </p>
    </div>

    <ProAlert
      v-if="errorVariant"
      data-testid="login-error"
      :color="errorVariant === 'conflict' ? 'warning' : 'error'"
      :icon="errorVariant === 'conflict' ? 'i-lucide-shield-check' : undefined"
      :title="errorTitle"
      :description="errorDescription"
      class="mb-4"
    >
      <p v-if="errorVariant === 'no_account'" class="text-muted mt-0.5">
        <span class="font-medium text-highlighted">Sign in with Google</span> to create one.
      </p>
    </ProAlert>

    <!-- Conflict variant: lead with the original provider's CTA. -->
    <template v-if="errorVariant === 'conflict' && conflictProvider">
      <UButton
        :to="buildHref(conflictProvider)"
        external
        color="primary"
        variant="solid"
        size="lg"
        :icon="conflictProvider === 'google' ? 'i-simple-icons-google' : 'i-simple-icons-github'"
        block
        class="mb-3"
        @click="rememberProvider(conflictProvider)"
      >
        Continue with {{ conflictProvider === 'google' ? 'Google' : 'GitHub' }}
      </UButton>
      <ULink
        :to="{ query: {} }"
        class="block text-xs text-muted hover:text-highlighted transition-colors text-center mt-3"
      >
        This isn't my account
      </ULink>
    </template>

    <!-- No account: offer create flow with both providers. -->
    <template v-else-if="errorVariant === 'no_account'">
      <UButton
        v-for="(p, idx) in providerButtons"
        :key="p.id"
        :to="buildHref(p.id, 'pro-free')"
        external
        :color="idx === 0 ? 'primary' : 'neutral'"
        :variant="idx === 0 ? 'solid' : 'subtle'"
        size="lg"
        :icon="p.icon"
        block
        class="mb-3"
        @click="rememberProvider(p.id)"
      >
        Create with {{ p.id === 'google' ? 'Google' : 'GitHub' }}
      </UButton>
    </template>

    <!-- Default: provider buttons reordered by last-used. -->
    <template v-else>
      <div class="flex flex-col gap-3">
        <div
          v-for="(p, idx) in providerButtons"
          :key="p.id"
          class="relative"
        >
          <UButton
            :data-testid="`${p.id}-signin-btn`"
            :to="buildHref(p.id)"
            external
            :color="idx === 0 ? 'primary' : 'neutral'"
            :variant="idx === 0 ? 'solid' : 'subtle'"
            size="lg"
            :icon="p.icon"
            block
            @click="rememberProvider(p.id)"
          >
            {{ p.label }}
          </UButton>
          <UBadge
            v-if="idx === 0 && lastProvider === p.id && providerButtons.length > 1"
            color="neutral"
            variant="outline"
            size="xs"
            class="absolute -top-2 right-3"
          >
            Last used
          </UBadge>
        </div>
      </div>
    </template>

    <p class="mt-7 text-xs text-muted">
      New to Request Indexing?
      <ULink to="/pro/onboarding" class="font-medium text-highlighted transition-colors hover:text-primary">
        Create your free account
      </ULink>
    </p>
  </div>
</template>
