import { z } from 'zod'
import {
  ONBOARDING_INTENT_IDS,
  ONBOARDING_OTHER_MAX,
  ONBOARDING_ROLE_IDS,
  ONBOARDING_SEO_EXPERIENCE_IDS,
  ONBOARDING_SITE_COUNT_IDS,
} from '#layers/design-system/app/components/element/onboarding-answers'

/**
 * Onboarding Answers: what a user told the "About you" card on the sync step.
 * Every field is optional, so a partial answer is a valid answer.
 */
export const OnboardingAnswersSchema = z.object({
  role: z.enum(ONBOARDING_ROLE_IDS).optional(),
  siteCount: z.enum(ONBOARDING_SITE_COUNT_IDS).optional(),
  seoExperience: z.enum(ONBOARDING_SEO_EXPERIENCE_IDS).optional(),
  intents: z.array(z.enum(ONBOARDING_INTENT_IDS)).max(ONBOARDING_INTENT_IDS.length).refine(ids => new Set(ids).size === ids.length, 'Choose each goal once.').default([]),
  other: z.string().trim().max(ONBOARDING_OTHER_MAX).transform(text => text || undefined).optional(),
}).strict()

export type OnboardingAnswers = z.output<typeof OnboardingAnswersSchema>

/** One write from the card. `close` ends the card: Done or Skip. */
export const OnboardingAnswersWriteSchema = z.object({
  answers: OnboardingAnswersSchema,
  close: z.boolean().default(false),
}).strict()

export type OnboardingAnswersWrite = z.input<typeof OnboardingAnswersWriteSchema>

/** What the card reads. A closed card never shows again. */
export type OnboardingAnswersState
  = | { _tag: 'Open', answers: OnboardingAnswers }
    | { _tag: 'Closed' }

export type OnboardingAnswersWriteResult = { _tag: 'Saved' } | { _tag: 'Closed' }

export const EMPTY_ONBOARDING_ANSWERS: OnboardingAnswers = { intents: [] }

/** Parse a stored value. A row from an older shape reads as no answers. */
export function parseStoredOnboardingAnswers(value: unknown): OnboardingAnswers | null {
  if (value === null || value === undefined)
    return null
  let raw = value
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    }
    catch {
      // Malformed stored JSON reads as no answers; the admin view shows none.
      return null
    }
  }
  const parsed = OnboardingAnswersSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

/** COPY.md: About you card. */
export const ONBOARDING_ANSWERS_COPY = {
  heading: 'About you',
  description: 'Optional. Your answers help us improve Request Indexing. Setup does not wait for them.',
  otherLabel: 'Anything else? Optional',
  otherPlaceholder: 'Tell us what you want to get indexed',
  done: 'Save answers',
  skip: 'Skip',
  saved: 'Thanks. Your answers are saved.',
  failed: 'Your answer could not save. Setup continues without it.',
} as const
