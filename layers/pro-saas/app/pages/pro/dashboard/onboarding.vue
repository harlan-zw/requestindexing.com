<script setup lang="ts">
import type { OnboardingStep } from '#layers/pro-saas/shared/onboarding'
import {
  canAdvanceOnboardingStep,
  ONBOARDING_STEP_LABELS,
  ONBOARDING_STEPS,
  onboardingStepIndex,
  parseOnboardingStep,
  resolveGscConnection,
  resolveOnboardingResumeStep,
} from '#layers/pro-saas/shared/onboarding'

// First-run setup, three steps, the step in the URL.
//
// The step lives in `?step=` so a Google round trip comes back where it left
// off, and so does a reload. Nothing is stored: the step a user resumes at is
// derived from what they have actually done, which is the only state that
// survives an abandoned tab.
definePageMeta({
  layout: 'pro-onboarding',
  title: 'Set up',
})

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { session, fetch: refreshSession } = useUserSession()

// The callback returns `?error=gsc_scope_missing` when the user unticked
// Search Console on Google's consent screen, and gscdump's lifecycle reports
// `scope_missing` for a returning user who did it before the callback checked.
// Either outranks a gscdump key left from an earlier grant, so the step shows
// the retry instead of "connected".
const gsc = computed(() => resolveGscConnection({
  gscdumpConnected: !!session.value?.gscdumpConnected,
  accountStatus: session.value?.gscdumpAccountStatus ?? null,
  error: route.query.error,
}))
const gscConnected = computed(() => gsc.value._tag === 'Connected')
const siteCount = ref(session.value?.hasSites ? 1 : 0)
const hasSites = computed(() => siteCount.value > 0)

const signedInWithGithub = computed(() => session.value?.user?.authProvider === 'github')

function resumeStep(): OnboardingStep {
  return resolveOnboardingResumeStep({ gsc: gsc.value, hasSites: hasSites.value })
}

const step = ref<OnboardingStep>(parseOnboardingStep(route.query.step) ?? resumeStep())
const stepIndex = computed(() => onboardingStepIndex(step.value))

const progressSteps = ONBOARDING_STEPS.map(id => ({ id, label: ONBOARDING_STEP_LABELS[id] }))

function goStep(next: string) {
  const parsed = parseOnboardingStep(next)
  if (!parsed)
    return
  step.value = parsed
  router.replace({ query: { ...route.query, step: parsed } })
}

// The URL is the source of truth, so a back button moves the wizard.
watch(() => route.query.step, (value) => {
  const parsed = parseOnboardingStep(value)
  if (parsed && parsed !== step.value)
    step.value = parsed
})

const returnToSites = '/pro/dashboard/onboarding?step=sites'
const gscConnectUrl = `/auth/integrations/gsc/connect?returnTo=${encodeURIComponent(returnToSites)}`

// Coming back from Google, the session cookie is fresh but this page's copy is
// not. Refreshing on mount is what makes the connect step flip to "connected".
onMounted(async () => {
  await refreshSession()
  if (!parseOnboardingStep(route.query.step))
    goStep(resumeStep())
})

const finishing = ref(false)

async function finish() {
  if (finishing.value)
    return
  finishing.value = true
  try {
    await $fetch('/api/pro/onboarding/complete', { method: 'POST' })
    await refreshSession()
    await navigateTo('/pro/dashboard')
  }
  catch (err: unknown) {
    const message = (err as { data?: { message?: string } })?.data?.message
    toast.add({ title: 'Could not finish setup', description: message, color: 'error' })
  }
  finally {
    finishing.value = false
  }
}

function next() {
  if (step.value === 'connect')
    return goStep('sites')
  if (step.value === 'sites')
    return goStep('sync')
  return finish()
}

const nextLabel = computed(() => step.value === 'sync' ? 'Go to dashboard' : 'Continue')
const nextDisabled = computed(() => !canAdvanceOnboardingStep(step.value, {
  gsc: gsc.value,
  hasSites: hasSites.value,
}))

// Search Console is an offer, so the skip has to be visible. Without it the
// only wording on the step is "Connect", and a user who cannot connect reads a
// working Continue as a mistake rather than as the way out.
const skipLabel = computed(() => step.value === 'connect' && !gscConnected.value ? 'Skip for now' : undefined)

function back() {
  goStep(ONBOARDING_STEPS[Math.max(0, stepIndex.value - 1)]!)
}

useRobotsRule(false)
useSeoMeta({ title: 'Set up Request Indexing' })
</script>

<template>
  <div class="space-y-8">
    <UiWizardProgress :steps="progressSteps" :current-index="stepIndex" @select="goStep" />

    <section v-if="step === 'connect'" class="space-y-5">
      <UiAuthHeading
        size="md"
        title="Connect Google Search Console"
        description="Request Indexing reads your Search Console data to find pages Google has missed, then submits them for you."
      />

      <ProAlert
        v-if="signedInWithGithub && !gscConnected"
        color="warning"
        icon="i-lucide-shield-check"
        title="Search Console needs a Google account"
        description="You signed in with GitHub. Connecting below links your Google account to this login; you keep signing in with GitHub."
      />

      <ProGscScopeMissingAlert v-if="gsc._tag === 'ScopeMissing'" />

      <div v-if="gscConnected" class="flex items-center gap-2 rounded-lg border border-default bg-elevated/40 px-3 py-3">
        <UIcon name="i-heroicons-check-circle" class="size-5 shrink-0 text-primary" aria-hidden="true" />
        <div class="min-w-0">
          <p class="text-sm font-medium text-highlighted">
            Google Search Console is connected
          </p>
          <p v-if="session?.gscEmail" class="truncate text-xs text-muted">
            {{ session.gscEmail }}
          </p>
        </div>
      </div>

      <template v-else>
        <ul class="space-y-2 text-sm text-muted">
          <li class="flex gap-2">
            <UIcon name="i-heroicons-check" class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            Read your queries, pages and coverage.
          </li>
          <li class="flex gap-2">
            <UIcon name="i-heroicons-check" class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            Submit missing pages through the Indexing API.
          </li>
          <li class="flex gap-2">
            <UIcon name="i-heroicons-check" class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            Keep your data past Google's 16-month window.
          </li>
        </ul>
        <UButton
          :to="gscConnectUrl"
          external
          size="lg"
          class="min-h-11"
          icon="i-simple-icons-google"
          label="Connect Google Search Console"
          data-testid="connect-gsc-btn"
        />
      </template>
    </section>

    <section v-else-if="step === 'sites'" class="space-y-5">
      <UiAuthHeading
        size="md"
        title="Connect your sites"
        description="Name the address you want tracked. We match it to a Search Console property for you."
      />
      <ProSiteAddForm :gsc-return-to="returnToSites" @changed="siteCount = $event" />
    </section>

    <section v-else class="space-y-5">
      <UiAuthHeading
        size="md"
        title="You're set up"
        description="We are pulling your Search Console history now. It runs in the background, and the dashboard shows the progress as it lands."
      />
      <div class="flex items-center gap-2 rounded-lg border border-default bg-elevated/40 px-3 py-3" role="status" aria-live="polite">
        <UIcon name="i-heroicons-arrow-path" class="size-5 shrink-0 animate-spin text-primary" aria-hidden="true" />
        <p class="text-sm text-muted">
          First sync started. You do not have to wait here.
        </p>
      </div>
    </section>

    <UiWizardNav
      :can-back="stepIndex > 0"
      :skip-label="skipLabel"
      :next-label="nextLabel"
      :next-disabled="nextDisabled"
      :next-loading="finishing"
      @back="back"
      @skip="next"
      @next="next"
    />
  </div>
</template>
