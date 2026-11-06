export type FollowUpProgress = 'google-missing' | 'site-missing' | 'evidence-missing' | 'ready' | 'unavailable'

/** Existing welcome copy offers a Site connection. Later material needs its prerequisites. */
export function onboardingFollowUpReady(stepIndex: number, progress: FollowUpProgress): boolean {
  return progress !== 'unavailable' && (stepIndex === 0 || progress === 'ready')
}
