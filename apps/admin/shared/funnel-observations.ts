import type { FunnelUser } from './funnel'
import type { AcquisitionEvidence, FeedbackObservation, StageTimes } from './journey-evidence'
import { z } from 'zod'
import { SETUP_EXIT_REASONS } from '#layers/pro-saas/shared/setup-experiments'
import { funnelTimestamp } from './funnel'
import { stagePairDelays } from './journey-evidence'

export interface FunnelAccount { id: number, name: string | null, email: string, createdAt: unknown, completedAt: unknown, source: string | null, teamId: number, engineUserId: string | null }
export interface FunnelEvent { userId: number, type: string, createdAt: unknown, payload: unknown }
export interface FunnelSite { teamId: number }
export type ObservedFunnelUser = FunnelUser & {
  acquisition: AcquisitionEvidence
  journey: { stageTimes: StageTimes, delays: ReturnType<typeof stagePairDelays>, coverage: 'first-recorded', cutoff: string, invalidHistory: { beforeSignup: number, future: number, invalidTimestamp: number } }
  feedback: FeedbackObservation[]
  currentSites: { count: number, knownUrlCount: null, unknownSizeSites: number, scope: 'current-team', capturedAt: string }
  engineUserId: string | null
}

function payload(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    }
    catch {
      // Malformed legacy event payloads remain unknown.
      return null
    }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}
const safeText = (value: unknown, max = 253) => typeof value === 'string' && value.length <= max ? value : null
const feedbackSchema = z.object({ reason: z.enum(SETUP_EXIT_REASONS), step: z.enum(['connect', 'sites', 'sync', 'page']) }).strict()

export function buildObservedFunnelUsers(accounts: FunnelAccount[], events: FunnelEvent[], sites: FunnelSite[], now: number): ObservedFunnelUser[] {
  const byUser = new Map<number, FunnelEvent[]>()
  for (const event of events) byUser.set(event.userId, [...(byUser.get(event.userId) ?? []), event])
  const sitesByTeam = new Map<number, number>()
  for (const site of sites) sitesByTeam.set(site.teamId, (sitesByTeam.get(site.teamId) ?? 0) + 1)
  return accounts.flatMap((account) => {
    const rawEvents = byUser.get(account.id) ?? []
    const observations = rawEvents.flatMap((event) => {
      const at = funnelTimestamp(event.createdAt)
      return at ? [{ ...event, at, time: Date.parse(at) }] : []
    }).sort((a, b) => a.time - b.time)
    const signup = observations.find(event => event.type === 'signed_up' && event.time <= now)
    const signedUpAt = signup?.at ?? funnelTimestamp(account.createdAt)
    if (!signedUpAt || Date.parse(signedUpAt) > now)
      return []
    const valid = observations.filter(event => event.time >= Date.parse(signedUpAt) && event.time <= now)
    const first = (type: string) => valid.find(event => event.type === type)
    const storedCompletion = funnelTimestamp(account.completedAt)
    const completedAt = storedCompletion && Date.parse(storedCompletion) >= Date.parse(signedUpAt) && Date.parse(storedCompletion) <= now ? storedCompletion : null
    const initial = payload(signup?.payload)
    const captured = initial?.attributionBasis === 'journey_linked' && safeText(initial.attributionSource, 320)
    const legacy = safeText(signup ? initial?.source : account.source, 320)
    const acquisition: AcquisitionEvidence = {
      label: captured || legacy || 'Unattributed',
      basis: captured ? 'captured' : legacy ? 'legacy' : 'unknown',
      product: 'request-indexing',
      provider: safeText(initial?.provider, 32),
      channelClass: safeText(initial?.channelClass, 32),
      landingPath: safeText(initial?.landingPath, 128),
      capturedAt: funnelTimestamp(initial?.capturedAt),
    }
    const times: StageTimes = {
      signedUp: signedUpAt,
      googleConnected: first('gsc_connected')?.at ?? null,
      siteConnected: first('site_added')?.at ?? null,
      evidenceViewed: valid.find(event => ['page_evidence_viewed', 'first_report_evidence_viewed'].includes(event.type))?.at ?? null,
      setupCompleted: first('onboarding_completed')?.at ?? completedAt,
    }
    const feedback = new Map<string, FeedbackObservation>()
    for (const observation of valid.filter(event => event.type === 'setup_feedback')) {
      const parsed = feedbackSchema.safeParse(payload(observation.payload))
      if (parsed.success && observation.time <= now)
        feedback.set(parsed.data.step, { ...parsed.data, recordedAt: observation.at })
    }
    const siteCount = sitesByTeam.get(account.teamId) ?? 0
    return [{ id: account.id, name: account.name, email: account.email, signedUpAt, signupEvidence: signup ? 'event' : 'account', source: acquisition.label, googleConnected: !!times.googleConnected, siteConnected: !!times.siteConnected, setupCompleted: !!times.setupCompleted, acquisition, journey: { stageTimes: times, delays: stagePairDelays(times, now), coverage: 'first-recorded', cutoff: new Date(now).toISOString(), invalidHistory: { beforeSignup: observations.filter(event => event.time < Date.parse(signedUpAt)).length, future: observations.filter(event => event.time > now).length, invalidTimestamp: rawEvents.length - observations.length } }, feedback: [...feedback.values()], currentSites: { count: siteCount, knownUrlCount: null, unknownSizeSites: siteCount, scope: 'current-team', capturedAt: new Date(now).toISOString() }, engineUserId: account.engineUserId }]
  })
}
