<script setup lang="ts">
import ProShellOnboardingFrame from '@nuxtseo/pro-shell/app/components/ProShellOnboardingFrame.vue'
import { useProShellCopy } from '@nuxtseo/pro-shell/app/composables/useProShellCopy'
import { useProShellOnboardingFlow, useProShellOnboardingSteps } from '@nuxtseo/pro-shell/app/composables/useProShellOnboarding'
import { REQUEST_HONOUR } from '@nuxtseo/pro-shell/shared/onboarding'
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'
import ProSetupFirstSiteReport from '~~/layers/indexing/app/components/ProSetupFirstSiteReport.vue'
import ProOnboardingStepGuide from '~~/layers/pro-saas/app/components/pro/ProOnboardingStepGuide.vue'

import { FIRST_REPORT_COPY } from '#layers/indexing/shared/first-report'
import { parseAgentSetupRoute } from '#layers/pro-gsc/shared/agent-setup'
import { parseGscConnectReturn } from '#layers/pro-gsc/shared/gsc-grant'
import { readProErrorMessage } from '#layers/pro-saas/shared/errors'
import { GSC_CONNECT_COPY } from '#layers/pro-saas/shared/gsc-connect-copy'
import {
  DASHBOARD_ROUTE,
  FIRST_RUN_FLOW,
  ONBOARDING_COMPLETION_COPY,
  onboardingConnectReturnTo,
  parseOnboardingStep,
  resolveGscConnection,
} from '#layers/pro-saas/shared/onboarding'
import { PAGE_TASK_ROUTE } from '#layers/pro-saas/shared/page-task'

// First-run setup, four steps, the step in the URL. Agent setup leads, and a
// new signup opens it by URL; Skip agent setup moves on to Connect Google.
//
// The steps are registered on `@nuxtseo/pro-shell`'s Step registry
// (`shared/onboarding.ts`), and the shell's flow resolves the current one. The
// step lives in `?step=` so a Google round trip comes back where it left off,
// and so does a reload. Nothing is stored: a bare URL resumes from what the
// user has actually done, which is the only state that survives an abandoned
// tab. `agent`, `connect` and `sites` draw their own nav from the frame's `controls`;
// `sync` uses the frame's, which waits for a Site because finishing without
// one is refused.
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
// A Google round trip that came back with no grant: cancelled, or failed. Only
// an unconnected account shows it; a connected one keeps its grant.
const gscReturn = computed(() => gscConnected.value ? null : parseGscConnectReturn(route.query.error))
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
    // The server says why, for example that Google must be connected first.
    toast.add({ title: 'Could not finish setup', description: readProErrorMessage(err) ?? undefined, color: 'error' })
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
// Agent setup has its own exit, Skip agent setup, so the exit question
// shows on the web steps only.
const feedbackStep = computed(() => currentStep.value === 'agent' ? null : currentStep.value)

// Agent setup keeps the chosen agent in `?agent=`. Step moves keep every
// other query key, and the Google return carries it, so Back reopens Agent
// setup with the same choice.
const agent = ref(parseAgentSetupRoute(route.query.agent))
watch(agent, (value) => {
  if (value && route.query.agent !== value)
    void navigateTo({ query: { ...route.query, agent: value } }, { replace: true })
})
watch(() => route.query.agent, (value) => {
  const parsed = parseAgentSetupRoute(value)
  if (parsed)
    agent.value = parsed
})

const returnToSites = computed(() => onboardingConnectReturnTo(agent.value))
// Read-only, as nuxtseo.com's setup asks: every setup step works with it, and
// Google's consent screen then lists one Search Console line instead of three.
// Sitemap submission and Add and verify ask for more when the reader uses them.
const gscConnectUrl = computed(() => `/auth/integrations/gsc/connect?scope=read&returnTo=${encodeURIComponent(returnToSites.value)}`)

// Coming back from Google, the session cookie is fresh but this page's copy is
// not. Refreshing on mount is what makes the connect step flip to "connected".
onMounted(() => refreshSession())

useRobotsRule(false)
useSeoMeta({ title: 'Set up Request Indexing' })
</script>

<template>
  <ProShellOnboardingFrame
    class="[&_[data-onboarding-step]]:relative"
    :flow="flow"
    :next-disabled="currentStep === 'sync' && !hasSites"
    :next-loading="finishing"
  >
    <template #step-agent="{ step, controls }">
      <ProOnboardingAgentStep
        v-model:agent="agent"
        :title="step.copy.title"
        :description="step.copy.description"
        @skip="controls.skip()"
        @next="controls.next()"
      />
    </template>

    <template #step-connect="{ step, controls }">
      <div class="space-y-5">
        <UiAuthHeading size="md" :title="step.copy.title" :description="step.copy.description" />

        <ProAlert
          v-if="signedInWithGithub && !gscConnected"
          color="warning"
          icon="i-lucide-shield-check"
          title="Search Console needs a Google account"
          :description="GSC_CONNECT_COPY.githubSignIn"
        />

        <ProGscScopeMissingAlert v-if="gsc._tag === 'ScopeMissing'" />
        <ProGscConnectReturnAlert v-else-if="gscReturn" :result="gscReturn" />

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
          <p class="text-sm text-muted">
            {{ GSC_CONNECT_COPY.readAccess }}
          </p>
          <UButton
            :to="gscConnectUrl"
            external
            size="lg"
            class="min-h-11"
            icon="i-simple-icons-google"
            label="Connect Google Search Console"
            data-testid="connect-gsc-btn"
          />
          <ProSetupExample />
          <details class="text-sm text-muted" data-testid="gsc-access">
            <summary class="list-item min-h-11 cursor-pointer content-center font-medium text-highlighted">
              {{ GSC_CONNECT_COPY.accessHeading }}
            </summary>
            <div class="space-y-2 pb-2">
              <p>{{ GSC_CONNECT_COPY.changes }}</p>
              <p>
                {{ GSC_CONNECT_COPY.remove }}
                <ULink :to="GSC_CONNECT_COPY.removeHref" external target="_blank" rel="noopener" class="font-medium text-highlighted underline">
                  {{ GSC_CONNECT_COPY.removeAction }}
                </ULink>
              </p>
            </div>
          </details>
        </template>
      </div>

      <!-- One way forward: before a grant the Connect button drives the
           advance, so the footer is empty; after, it offers Continue. There
           is no skip (COPY.md, Connect Google assets). A member of a Team
           that already has a Site may continue without a grant. Back
           reopens Agent setup. -->
      <UiWizardNav
        can-back
        :show-next="gscConnected || hasSites"
        :next-label="frameCopy.next"
        @back="controls.back()"
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

    <!-- The First Site report is the step's result, so it comes straight
         after the heading. About you follows the step's buttons: it is
         optional, and it must not push the result or Go to dashboard down. -->
    <template #step-sync>
      <div v-if="hasSites" class="space-y-5">
        <UiAuthHeading size="md" :title="FIRST_REPORT_COPY.heading" />
        <ProSetupFirstSiteReport />
      </div>
      <UiAuthHeading
        v-else
        size="md"
        :title="ONBOARDING_COMPLETION_COPY.missingSite.title"
        :description="ONBOARDING_COMPLETION_COPY.missingSite.description"
      />
    </template>

    <!-- The step guide follows the step's buttons, so on a narrow screen it
         never pushes the step's way forward down. The frame's class makes
         the step section its anchor, so from 1420px the guide hangs to the
         right of the step, top-aligned with the heading, and the column keeps
         its width. The 672px column stays centred, so the 32px gap and the
         320px card need that width again on the left: 1376px, plus the
         scrollbar and a margin. The last step's guide describes the report,
         so it waits for a Site. -->
    <template #after>
      <ProOnboardingStepGuide
        v-if="currentStep !== 'sync' || hasSites"
        :step="currentStep"
        class="min-[1420px]:absolute min-[1420px]:top-0 min-[1420px]:left-full min-[1420px]:ml-8 min-[1420px]:w-80"
      />
      <ProOnboardingAnswers v-if="currentStep === 'sync'" />
      <ProSetupExitFeedback v-if="feedbackStep" :step="feedbackStep" />
    </template>
  </ProShellOnboardingFrame>
</template>
