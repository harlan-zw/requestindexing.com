<script setup lang="ts">
import type { AuthProviderId } from '#layers/pro-saas-auth/shared/types/auth'
import { ONBOARDING_ROUTE, resolveGscConnection, resolveOnboardingResumeStep } from '#layers/pro-saas/shared/onboarding'

// The signup door. A signed-out visitor gets the provider buttons; a signed-in
// one is never left here, because this page's only job is to route them on.
definePageMeta({
  layout: 'auth',
  pageTransition: { name: 'auth-content', mode: 'out-in' },
})

const { loggedIn, session, fetch: fetchSession } = useUserSession()
await fetchSession()

const { features } = useProSaasFeatures()

// `/get-started` used to carry this. Google sends a consent screen where the
// Search Console scope can be unticked, and the account is then useless to us,
// so the door that started the flow is the door that reports the refusal.
const route = useRoute()
const missingScope = computed(() => route.query.error === 'missing-scope')

const LAST_PROVIDER_KEY = 'nuxtseo:auth:last-provider'
const lastProvider = ref<AuthProviderId | null>(null)
onMounted(() => {
  try {
    const stored = localStorage.getItem(LAST_PROVIDER_KEY)
    if (stored === 'github' || stored === 'google')
      lastProvider.value = stored
  }
  catch {
    // Browser storage can be unavailable. Promoting the last-used provider is a
    // convenience, so the page renders the default order instead.
  }
})

function rememberProvider(provider: string) {
  try {
    localStorage.setItem(LAST_PROVIDER_KEY, provider)
  }
  catch {
    // See above: remembering the provider is optional.
  }
}

const providers = computed(() => {
  const all = [
    { id: 'google' as const, label: 'Continue with Google', icon: 'i-simple-icons-google', enabled: features.value.googleSignIn },
    { id: 'github' as const, label: 'Continue with GitHub', icon: 'i-simple-icons-github', enabled: features.value.githubSignIn },
  ].filter(p => p.enabled)

  const ordered = lastProvider.value
    ? [...all.filter(p => p.id === lastProvider.value), ...all.filter(p => p.id !== lastProvider.value)]
    : all

  return ordered.map(p => ({
    id: p.id,
    label: p.label,
    icon: p.icon,
    href: `/auth/${p.id}?redirect=${encodeURIComponent(ONBOARDING_ROUTE)}`,
    external: true,
    lastUsed: lastProvider.value === p.id,
    testId: `${p.id}-signup-btn`,
  }))
})

/**
 * A signed-in visitor must always leave this page. The wizard resumes at the
 * step their data is actually up to, so a bookmark or a back button never
 * restarts setup from step one.
 */
async function resolveSignedInLanding() {
  await fetchSession()
  if (session.value?.onboardingCompletedAt) {
    await navigateTo('/pro/dashboard', { replace: true })
    return
  }
  const step = resolveOnboardingResumeStep({
    gsc: resolveGscConnection({ gscdumpConnected: !!session.value?.gscdumpConnected, error: route.query.error }),
    hasSites: !!session.value?.hasSites,
  })
  await navigateTo({ path: ONBOARDING_ROUTE, query: { step } }, { replace: true })
}

if (import.meta.client) {
  let handled = false
  watch(() => loggedIn.value && session.value != null, (ready) => {
    if (handled || !ready)
      return
    handled = true
    void resolveSignedInLanding()
  }, { immediate: true })
}

useRobotsRule(false)
useSeoMeta({
  title: 'Get started',
  description: 'Connect Google Search Console and start submitting pages for indexing.',
})
</script>

<template>
  <div data-testid="onboarding-entry">
    <template v-if="!loggedIn">
      <UiAuthHeading
        title="Get your pages indexed"
        description="Connect Google Search Console, then submit the pages Google has missed. Free during the beta."
      />

      <ProAlert
        v-if="missingScope"
        data-testid="onboarding-missing-scope"
        color="warning"
        title="Search Console access is missing"
        description="Request Indexing reads your data through the Google Search Console API. Sign up again and allow that access."
        class="mb-4"
      />

      <UiAuthProviders :providers="providers" @select="rememberProvider" />

      <ul class="mt-6 space-y-2 text-xs text-muted">
        <li class="flex gap-2">
          <UIcon name="i-lucide-check" class="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>We set up a personal team from your Google Account.</span>
        </li>
        <li class="flex gap-2">
          <UIcon name="i-lucide-check" class="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>You choose which Search Console sites to sync.</span>
        </li>
        <li class="flex gap-2">
          <UIcon name="i-lucide-shield-check" class="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>You can delete your data and revoke access at any time.</span>
        </li>
      </ul>

      <p class="mt-4 text-xs text-muted">
        Google asks for two scopes. Your Google profile sets up the team. The Google Search Console API, read only, queries your data.
      </p>

      <p class="mt-7 text-xs text-muted">
        Already have an account?
        <ULink to="/login" class="font-medium text-highlighted transition-colors hover:text-primary">
          Sign in
        </ULink>
      </p>
    </template>

    <div v-else class="flex min-h-[120px] w-full items-center justify-center gap-2 text-muted" role="status" aria-live="polite">
      <UIcon name="i-heroicons-arrow-path" class="size-5 animate-spin" aria-hidden="true" />
      <span>Opening your dashboard.</span>
    </div>
  </div>
</template>
