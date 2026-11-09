export const ADMIN_JOURNEY_COPY = {
  evidence: 'Viewed Google evidence',
  timing: 'Time between recorded milestones',
  timingHelp: 'Only known, ordered timestamp pairs contribute to timing. Missing and reversed pairs remain visible.',
  median: 'Median time',
  known: 'Known pairs',
  missing: 'Missing timestamps',
  reversed: 'Out of order',
  unavailable: 'Not measured',
  source: 'Signup attribution',
  sourceHelp: 'Captured signup attribution stays with the account. Unknown history remains unknown.',
  feedback: 'Optional setup feedback',
  feedbackHelp: 'These are the latest self-reported reasons for each setup step. They are not customer goals.',
  integrations: 'Integration activity',
  integrationHelp: 'gscdump hosts MCP, CLI, and API activity. Request Indexing has no local successful-use evidence.',
  sites: 'Current Team Sites',
  sitesHelp: 'Site counts describe the current Team. Site sizes are unknown in this local cache.',
  export: 'Export CSV',
  details: 'Recorded details',
  coverage: 'First recorded observations. Older activity may be unrecorded.',
  invalidFilters: 'Choose valid report filters.',
  invalidExport: 'Choose a valid export format.',
  future: 'Future timestamps',
  excluded: 'Excluded history',
  beforeSignup: 'Before signup',
  invalid: 'Invalid timestamps',
  captured: 'Captured',
  legacy: 'Legacy',
  unknown: 'Unknown',
  step: 'Step',
  reason: 'Reason',
  engineUser: 'Engine user ID',
  utmSource: 'UTM source',
  utmMedium: 'UTM medium',
  utmCampaign: 'UTM campaign',
  utmContent: 'UTM content',
  utmTerm: 'UTM term',
  referrerDomain: 'Referrer domain',
  landingPath: 'Landing group',
  capturedAt: 'Captured at (UTC)',
  provider: 'Sign-in provider',
  channelClass: 'Acquisition channel',
} as const

export const JOURNEY_STAGES = ['signedUp', 'googleConnected', 'siteConnected', 'evidenceViewed', 'setupCompleted'] as const
export type JourneyStage = typeof JOURNEY_STAGES[number]
export type StageTimes = Record<JourneyStage, string | null>
export type PairDelay = { from: JourneyStage, to: JourneyStage } & (
  | { _tag: 'Known', milliseconds: number }
  | { _tag: 'Missing' | 'OutOfOrder' | 'Future', milliseconds: null }
)
export interface AcquisitionEvidence {
  label: string
  basis: 'captured' | 'legacy' | 'unknown'
  product: 'request-indexing'
  provider: string | null
  channelClass: string | null
  landingPath: string | null
  capturedAt: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmContent: string | null
  utmTerm: string | null
  referrerDomain: string | null
}
export interface FeedbackObservation { reason: 'permission' | 'property' | 'value' | 'time', step: 'connect' | 'sites' | 'sync' | 'page', recordedAt: string }
export interface UserJourney {
  stageTimes: StageTimes
  delays: PairDelay[]
  coverage: 'first-recorded'
  cutoff: string
  invalidHistory?: { beforeSignup: number, future: number, invalidTimestamp: number }
}

export function stagePairDelays(times: StageTimes, cutoff: number): PairDelay[] {
  return JOURNEY_STAGES.slice(1).map((to, index): PairDelay => {
    const from = JOURNEY_STAGES[index]!
    const previous = times[from] ? Date.parse(times[from]) : NaN
    const current = times[to] ? Date.parse(times[to]) : NaN
    if (!Number.isFinite(previous) || !Number.isFinite(current))
      return { from, to, _tag: 'Missing', milliseconds: null }
    if (previous > cutoff || current > cutoff)
      return { from, to, _tag: 'Future', milliseconds: null }
    if (current < previous || (times.signedUp && (previous < Date.parse(times.signedUp) || current < Date.parse(times.signedUp))))
      return { from, to, _tag: 'OutOfOrder', milliseconds: null }
    return { from, to, _tag: 'Known', milliseconds: current - previous }
  })
}

export function summarizeDelays(journeys: UserJourney[]) {
  return JOURNEY_STAGES.slice(1).map((to, index) => {
    const from = JOURNEY_STAGES[index]!
    const pairs = journeys.flatMap(journey => journey.delays.filter(pair => pair.from === from && pair.to === to))
    const known = pairs.flatMap(pair => pair._tag === 'Known' ? [pair.milliseconds] : []).sort((a, b) => a - b)
    const medianMs = known.length ? known.length % 2 ? known[Math.floor(known.length / 2)]! : (known[known.length / 2 - 1]! + known[known.length / 2]!) / 2 : null
    return { from, to, knownPairs: known.length, missingPairs: pairs.filter(pair => pair._tag === 'Missing').length, reversedPairs: pairs.filter(pair => pair._tag === 'OutOfOrder').length, futurePairs: pairs.filter(pair => pair._tag === 'Future').length, medianMs }
  })
}
