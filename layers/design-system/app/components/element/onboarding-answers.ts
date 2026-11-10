// The "About you" questions: display data only (id, label, icon), in order.
// The ids are shared with nuxtseo.com and gscdump.com, which copy this file, so
// an id never changes. Only the intents list is per product.

export interface OnboardingOption<Id extends string = string> {
  id: Id
  label: string
}

export interface OnboardingIntent extends OnboardingOption {
  icon: string
}

export const ONBOARDING_ROLES = [
  { id: 'solo', label: 'Solo developer' },
  { id: 'agency', label: 'Agency or freelancer' },
  { id: 'in-house', label: 'In-house team' },
  { id: 'tool-builder', label: 'Building an SEO tool' },
  { id: 'other', label: 'Something else' },
] as const satisfies readonly OnboardingOption[]

export const ONBOARDING_SITE_COUNTS = [
  { id: '1', label: '1' },
  { id: '2-5', label: '2–5' },
  { id: '6-20', label: '6–20' },
  { id: '21+', label: '21+' },
] as const satisfies readonly OnboardingOption[]

export const ONBOARDING_SEO_EXPERIENCE = [
  { id: 'new', label: 'New to it' },
  { id: 'basics', label: 'Know the basics' },
  { id: 'professional', label: 'Do it for a living' },
] as const satisfies readonly OnboardingOption[]

export const ONBOARDING_INTENTS = [
  { id: 'new-pages', label: 'Get new pages indexed', icon: 'i-lucide-file-plus' },
  { id: 'why-not', label: 'Find why pages are not indexed', icon: 'search' },
  { id: 'many-sites', label: 'Watch indexing across many sites', icon: 'i-lucide-layout-grid' },
  { id: 'launch', label: 'Recover after a launch or migration', icon: 'i-lucide-rocket' },
] as const satisfies readonly OnboardingIntent[]

/** The free text under the intents. */
export const ONBOARDING_OTHER_MAX = 500

export const ONBOARDING_QUESTIONS = {
  role: 'What best describes you?',
  siteCount: 'How many websites do you look after?',
  seoExperience: 'How comfortable are you with SEO?',
  intents: 'What do you want to do with Request Indexing?',
} as const

export type OnboardingRole = typeof ONBOARDING_ROLES[number]['id']
export type OnboardingSiteCount = typeof ONBOARDING_SITE_COUNTS[number]['id']
export type OnboardingSeoExperience = typeof ONBOARDING_SEO_EXPERIENCE[number]['id']
export type OnboardingIntentId = typeof ONBOARDING_INTENTS[number]['id']

const ids = <T extends readonly OnboardingOption[]>(options: T) => options.map(option => option.id) as [T[number]['id'], ...T[number]['id'][]]

export const ONBOARDING_ROLE_IDS = ids(ONBOARDING_ROLES)
export const ONBOARDING_SITE_COUNT_IDS = ids(ONBOARDING_SITE_COUNTS)
export const ONBOARDING_SEO_EXPERIENCE_IDS = ids(ONBOARDING_SEO_EXPERIENCE)
export const ONBOARDING_INTENT_IDS = ids(ONBOARDING_INTENTS)
