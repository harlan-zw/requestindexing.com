<script setup lang="ts">
import ProShellOnboardingFrame from '@nuxtseo/pro-shell/app/components/ProShellOnboardingFrame.vue'
import { useProShellCopy } from '@nuxtseo/pro-shell/app/composables/useProShellCopy'
import { useProShellOnboardingFlow, useProShellOnboardingSteps } from '@nuxtseo/pro-shell/app/composables/useProShellOnboarding'
import { REQUEST_HONOUR } from '@nuxtseo/pro-shell/shared/onboarding'
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'

import ProSetupFirstSiteReport from '~~/layers/indexing/app/components/ProSetupFirstSiteReport.vue'
import {
  DASHBOARD_ROUTE,
  FIRST_RUN_FLOW,
  ONBOARDING_COMPLETION_COPY,
  parseOnboardingStep,
  resolveGscConnection,
} from '#layers/pro-saas/shared/onboarding'
import { PAGE_TASK_ROUTE } from '#layers/pro-saas/shared/page-task'

// First-run setup, three steps, the step in the URL.
//
// The steps are registered on `@nuxtseo/pro-shell`'s Step registry
// (`shared/onboarding.ts`), and the shell's flow resolves the current one. The
// step lives in `?step=` so a Google round trip comes back where it left off,
// and so does a reload. Nothing is stored: a bare URL resumes from what the
// user has actually done, which is the only state that survives an abandoned
// tab. Each step draws its own nav from the frame's `controls`.
definePageMeta({
  layout: 'pro-onboarding',
  title: 'Set up',
})

const route = useRoute()
const toast = useToast()
const frameCopy = useProShellCopy().onboarding
const { session, fetch: refreshSession } = useUserSession()
const { data: savedPage } = useFetch('/api/onboarding/page', { server: false, lazy: true })
watch(() => savedPage.value?._tag, (state) => {
  if (state === 'Available')
    void navigateTo(PAGE_TASK_ROUTE, { replace: true })
}, { immediate: true })

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

// nuxtseo.com's escape hatch. The sites step needs a Site, but a Site that
// cannot connect must not trap the user: a Google account with no Search
// Console property, a gscdump outage, or a full Free allowance would. The form
// reports a property list with nothing to connect, a failed attempt, or a full
// allowance, and only then does the step's skip rule offer a skip. Skipping
// finishes setup with no Site, and the dashboard's Connect a Site takes over.
const sitesBlocked = ref(false)

const finishing = ref(false)

async function finish(options: { skipSites?: boolean } = {}) {
  if (finishing.value)
    return
  finishing.value = true
  try {
    await getAppFetch()('/api/pro/onboarding/complete', {
      method: 'POST',
      body: options.skipSites ? { skipSites: true } : undefined,
    })
    await refreshSession()
    await navigateTo(DASHBOARD_ROUTE)
  }
  catch (err: unknown) {
    const message = (err as { data?: { message?: string } })?.data?.message
    toast.add({ title: 'Could not finish setup', description: message, color: 'error' })
  }
  finally {
    finishing.value = false
  }
}

function skipSites() {
  return finish({ skipSites: true })
}

const flow = useProShellOnboardingFlow({
  steps: useProShellOnboardingSteps(FIRST_RUN_FLOW),
  context: computed(() => ({ gsc: gsc.value, hasSites: hasSites.value, connectBlocked: sitesBlocked.value })),
  policy: REQUEST_HONOUR,
  finish: () => finish(),
})
const currentStep = computed(() => parseOnboardingStep(flow.current.value?.id) ?? 'connect')

const returnToSites = '/pro/dashboard/onboarding?step=sites'
const gscConnectUrl = `/auth/integrations/gsc/connect?returnTo=${encodeURIComponent(returnToSites)}`

// Coming back from Google, the session cookie is fresh but this page's copy is
// not. Refreshing on mount is what makes the connect step flip to "connected".
onMounted(() => refreshSession())

useRobotsRule(false)
useSeoMeta({ title: 'Set up Request Indexing' })
</script>

<template>
  <ProShellOnboardingFrame :flow="flow">
    <template #step-connect="{ step, controls }">
      <div class="space-y-5">
        <UiAuthHeading size="md" :title="step.copy.title" :description="step.copy.description" />

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
          <ProSetupExample />
          <ul class="space-y-2 text-sm text-muted">
            <li class="flex gap-2">
              <UIcon name="i-heroicons-check" class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              Read your queries, pages and coverage.
            </li>
            <li class="flex gap-2">
              <UIcon name="i-heroicons-check" class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              Submit to Google. Google documents the Indexing API for job posting and livestream pages only.
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
      </div>

      <!-- One way forward: before a grant the Connect button drives the
           advance, so the footer offers only the skip; after, only Continue. -->
      <UiWizardNav
        :skip-label="step.skippable ? frameCopy.skip : undefined"
        :show-next="gscConnected"
        :next-label="frameCopy.next"
        @skip="controls.skip()"
        @next="controls.next()"
      />
    </template>

    <template #step-sites="{ step, controls }">
      <div class="space-y-5">
        <UiAuthHeading size="md" :title="step.copy.title" :description="step.copy.description" />
        <ProSiteAddForm :gsc-return-to="returnToSites" @changed="siteCount = $event" @blocked="sitesBlocked = true" />
        <p v-if="step.skippable" class="flex flex-wrap items-center gap-x-1 text-sm text-muted">
          Can't connect your Site right now?
          <UButton
            variant="link"
            color="neutral"
            class="min-h-11 px-0 underline"
            label="Skip and connect it later"
            :loading="finishing"
            data-testid="skip-sites"
            @click="skipSites"
          />
        </p>
      </div>

      <UiWizardNav
        can-back
        :next-label="frameCopy.next"
        :next-disabled="!hasSites"
        @back="controls.back()"
        @next="controls.next()"
      />
    </template>

    <template #step-sync="{ step, controls }">
      <div class="space-y-5">
        <UiAuthHeading
          size="md"
          :title="hasSites ? ONBOARDING_COMPLETION_COPY.connected.title : ONBOARDING_COMPLETION_COPY.missingSite.title"
          :description="hasSites ? ONBOARDING_COMPLETION_COPY.connected.description : ONBOARDING_COMPLETION_COPY.missingSite.description"
        />
        <ProSetupFirstSiteReport v-if="hasSites" />
        <ProOnboardingAnswers />
      </div>

      <!-- Finishing is refused without a Site, so the advance waits for one. -->
      <UiWizardNav
        can-back
        :next-label="step.copy.cta || frameCopy.finish"
        :next-disabled="!hasSites"
        :next-loading="finishing"
        @back="controls.back()"
        @next="controls.next()"
      />
    </template>

    <template #after>
      <ProSetupExitFeedback :step="currentStep" />
    </template>
  </ProShellOnboardingFrame>
</template>
