import { resolveGscConnection, resolveOnboardingGate } from '#layers/pro-saas/shared/onboarding'

// The onboarding gate. It used to be a `watch` plus a `router.push` inside two
// dashboard layouts, which ran after the page had begun rendering and never saw
// the account routes, so a half-onboarded user who opened `/account` bounced in
// a loop. The decision itself is pure and lives in
// `layers/pro-saas/shared/onboarding.ts`; this file only reads the session and
// performs the redirect.
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, session } = useUserSession()

  const gate = resolveOnboardingGate({
    path: to.path,
    loggedIn: loggedIn.value,
    onboardingCompletedAt: session.value?.onboardingCompletedAt ?? null,
    gsc: resolveGscConnection({
      gscdumpConnected: !!session.value?.gscdumpConnected,
      accountStatus: session.value?.gscdumpAccountStatus ?? null,
      error: to.query.error,
    }),
    hasSites: !!session.value?.hasSites,
  })

  if (gate._tag === 'Allow')
    return

  return navigateTo({ path: gate.path, query: gate.query }, { replace: true })
})
