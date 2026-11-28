<script setup lang="ts">
import type { AuthProviderId } from '#layers/pro-saas-auth/shared/types/auth'
import ProShellOnboardingSurface from '@nuxtseo/pro-shell/app/components/ProShellOnboardingSurface.vue'
import { GSC_CONNECT_COPY } from '#layers/pro-saas/shared/gsc-connect-copy'
import { ONBOARDING_ROUTE, resolveGscConnection, resolveOnboardingResumeStep } from '#layers/pro-saas/shared/onboarding'
import { PAGE_SETUP_COPY, PAGE_TASK_ROUTE } from '#layers/pro-saas/shared/page-task'

// The signup door. A signed-out visitor gets the provider buttons; a signed-in
// one is never left here, because this page's only job is to route them on.
definePageMeta({
  layout: false,
  pageTransition: { name: 'auth-content', mode: 'out-in' },
})

useHead({ htmlAttrs: { class: 'dashboard-theme' } })

const { loggedIn, session, fetch: fetchSession } = useUserSession()
await fetchSession()
const { data: savedPage } = await useFetch('/api/onboarding/page')
const hasSavedPage = computed(() => savedPage.value?._tag === 'Available')

const { features } = useProSaasFeatures()

// Older Google returns can still bring this marker back to signup.
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
    href: `/auth/${p.id}?redirect=${encodeURIComponent(hasSavedPage.value ? PAGE_TASK_ROUTE : ONBOARDING_ROUTE)}`,
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
  if (hasSavedPage.value) {
    await navigateTo(PAGE_TASK_ROUTE, { replace: true })
    return
  }
  if (session.value?.onboardingCompletedAt) {
    await navigateTo('/pro/dashboard', { replace: true })
    return
  }
  const step = resolveOnboardingResumeStep({
    gsc: resolveGscConnection({
      gscdumpConnected: !!session.value?.gscdumpConnected,
      accountStatus: session.value?.gscdumpAccountStatus ?? null,
      error: route.query.error,
    }),
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
  title: GSC_CONNECT_COPY.signupHeading,
  description: 'Connect Google Search Console and see which of your pages Google has indexed, and why the rest are not.',
})
</script>

<template>
  <ProShellOnboardingSurface
    class="min-h-screen overflow-clip! [&_.max-w-6xl]:max-w-[66rem]"
    :wide="!hasSavedPage"
    :show-exit="false"
  >
    <template #brand>
      <div class="flex flex-1 justify-center">
        <NuxtLink to="/" aria-label="Request Indexing home" class="inline-flex min-h-11 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <OgBrand :size="34" wordmark semantic />
        </NuxtLink>
      </div>
    </template>

    <div
      v-if="!loggedIn"
      data-testid="onboarding-entry"
      class="grid items-start gap-8"
      :class="{ 'lg:grid-cols-[minmax(0,1fr)_22rem]': !hasSavedPage }"
    >
      <section class="min-w-0">
        <div v-if="savedPage?._tag === 'Available'" class="mb-6 space-y-2">
          <h1 class="text-2xl font-semibold">
            {{ PAGE_SETUP_COPY.heading }}
          </h1>
          <p class="wrap-anywhere text-sm">
            {{ savedPage.url }}
          </p>
          <p class="text-sm text-muted">
            {{ PAGE_SETUP_COPY.signIn }}
          </p>
        </div>
        <UiAuthHeading
          v-else
          :title="GSC_CONNECT_COPY.signupHeading"
          :description="GSC_CONNECT_COPY.signupDescription"
        />

        <ProAlert
          v-if="missingScope"
          data-testid="onboarding-missing-scope"
          color="warning"
          title="Search Console access is missing"
          :description="GSC_CONNECT_COPY.signupMissingScope"
          class="mb-4"
        />

        <UiAuthProviders :providers="providers" class="[&_a]:min-h-11" @select="rememberProvider" />

        <p class="mt-4 text-sm text-muted">
          {{ hasSavedPage ? GSC_CONNECT_COPY.readAccess : GSC_CONNECT_COPY.signupAccess }}
        </p>

        <p class="mt-2 flex flex-wrap items-center gap-x-1 text-sm text-muted">
          Already have an account?
          <ULink to="/login" class="inline-flex min-h-11 items-center font-medium text-highlighted underline underline-offset-4 transition-colors hover:text-primary">
            Sign in
          </ULink>
        </p>
      </section>

      <aside v-if="!hasSavedPage" aria-labelledby="signup-example-heading" class="min-w-0 space-y-3">
        <h2 id="signup-example-heading" class="text-base font-semibold text-highlighted">
          {{ GSC_CONNECT_COPY.signupExampleHeading }}
        </h2>
        <ProSetupExample layout="panel" :record-view="false" />
      </aside>
    </div>

    <div v-else class="flex min-h-[120px] w-full items-center justify-center gap-2 text-muted" role="status" aria-live="polite">
      <UIcon name="i-heroicons-arrow-path" class="size-5 animate-spin" aria-hidden="true" />
      <span>{{ GSC_CONNECT_COPY.signupOpening }}</span>
    </div>
  </ProShellOnboardingSurface>
</template>
