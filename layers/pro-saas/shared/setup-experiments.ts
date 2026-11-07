export const SETUP_EXPERIMENT_COPY = {
  exampleHeading: 'See an example before you connect',
  exampleLabel: 'Example from nuxtseo.com',
  exampleHelp: 'This public example shows a saved Google URL Inspection result. Your Site needs its own check.',
  exampleSource: 'View the public example',
  question: 'What would help you continue? Optional',
  permission: 'Understand Google access',
  property: 'Find my Search Console property',
  value: 'See what I get',
  time: 'Come back later',
  permissionRecovery: 'URL Inspection reads Search Console data. It does not submit a page to Google.',
  propertyRecovery: 'Use the Google account that owns a verified Search Console property for this Site.',
  timeRecovery: 'Your saved page stays available for seven days. Resume it from your dashboard.',
  genericTimeRecovery: 'Return to setup from your dashboard when you are ready.',
  recorded: 'Thanks. You can continue setup or leave when you are ready.',
  failed: 'Your answer could not save. You can still continue later.',
  propertyAction: 'Open Search Console',
} as const

export const SETUP_EXIT_REASONS = ['permission', 'property', 'value', 'time'] as const
export type SetupExitReason = typeof SETUP_EXIT_REASONS[number]
export interface SetupFeedback { reason: SetupExitReason, step: 'connect' | 'sites' | 'sync' | 'page' }
export type SetupFeedbackWrite = { _tag: 'Recorded' } | { _tag: 'Unavailable' }

/** A tiny subset of gscdump.com's public dashboard-snapshot.json. No customer data. */
export const PUBLIC_INSPECTION_EXAMPLE = {
  site: 'nuxtseo.com',
  publishedAt: '2026-09-22T14:41:11.655Z',
  source: 'https://gscdump.com/',
  url: 'https://nuxtseo.com/docs/og-image/integrations/color-mode',
  coverage: 'Crawled - currently not indexed',
  capturedAt: new Date(1790070425 * 1000).toISOString(),
} as const
