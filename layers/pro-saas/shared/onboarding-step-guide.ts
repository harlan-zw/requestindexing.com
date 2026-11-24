import type { OnboardingStep } from './onboarding'
import { GOOGLE_ACCOUNT_SENTENCE } from '#layers/pro-gsc/shared/agent-setup'
import { GSC_CONNECT_COPY } from './gsc-connect-copy'

// COPY.md, Step guide assets. Each setup step has one step guide: what the
// reader signs up for at this step, and why. A fact states shipped behaviour
// only. A canonical string that has a constant comes from it, so the two
// places cannot drift apart. No fact repeats a sentence the step can show.

/** Google's coverage state for one URL, verbatim. Every example row is a URL Google left out. */
export interface OnboardingStepGuideExampleRow {
  path: string
  coverage: string
}

export interface OnboardingStepGuide {
  title: string
  why: string
  facts: readonly string[]
  /** One real artifact, only where it shows the point better than words. */
  example?: { label: string, rows: readonly OnboardingStepGuideExampleRow[] }
  /** What follows the step, in order, where the step hands off to work the reader cannot see. */
  next?: { title: string, steps: readonly string[] }
}

export const ONBOARDING_STEP_GUIDES: Record<OnboardingStep, OnboardingStepGuide> = {
  // The Setup prompt asks for the indexed count and where the rest stopped,
  // reads saved verdicts only, and carries no secret (`agent-setup.ts`).
  // gscdump finds its account by Google account, so a second account gives a
  // second gscdump account with no Site. The step's skip line already says
  // that agents can wait, so no fact repeats it.
  agent: {
    title: 'Why start with an agent',
    why: 'Ask about your pages in the chat you already use. Your agent connects to gscdump, the engine that Request Indexing runs on.',
    facts: [
      'Your agent says how many pages have an indexed verdict, and where the rest stopped.',
      'Use one Google account for gscdump and for Connect Google. Then your agent reads the same Sites.',
      'The Setup prompt asks for saved verdicts only. Those reads use no URL Inspections.',
      'The Setup prompt holds no API key, cookie, or token.',
    ],
  },
  // The step's consent preview shows the read-only scope and how to remove
  // access, so the guide states the account, what Request Indexing changes,
  // who holds the grant, and the terms. gscdump holds the Search Console
  // token (COPY.md, Truth rules); its sync is the next list's second step.
  connect: {
    title: 'Why connect Google',
    why: 'Google reports its verdict for each page in Search Console. Request Indexing reads it with your own Google sign-in.',
    facts: [
      GOOGLE_ACCOUNT_SENTENCE,
      // COPY.md, Truth rules, the Search Console access sentence, verbatim.
      GSC_CONNECT_COPY.changes,
      'gscdump holds the Google grant.',
      // COPY.md, Landing page assets, FAQ 5, verbatim.
      'Free, with a Free allowance. No card needed.',
    ],
    // The grant returns to Connect Sites (`onboardingConnectReturnTo`).
    // gscdump syncs a new Site and inspects its sitemap URLs by itself, and
    // the last step reads the saved verdicts (COPY.md, First Site report).
    next: {
      title: 'What happens next',
      steps: [
        'You choose the Sites to connect.',
        'gscdump syncs each Site and inspects its sitemap URLs, within your Free allowance.',
        'Your First Site report reads Google\'s saved verdicts for the Site.',
      ],
    },
  },
  // gscdump sets the Free allowance numbers, so no number appears here. The
  // property list shows the count when gscdump caps the account.
  sites: {
    title: 'What a Site is',
    why: 'A Site is one website that Request Indexing checks for you. It comes from a verified Search Console property in your Google account.',
    facts: [
      'Your Free allowance sets how many Sites your account can connect.',
      // COPY.md, Free allowance assets, the end of Duplicate property.
      'You can connect each property once.',
      'gscdump then syncs the Site and inspects its sitemap URLs, within your Free allowance.',
      'You can connect more Sites later from your dashboard.',
    ],
    // What a Site gives: Google's reason for a URL it left out. The state
    // is one Google's URL Inspection API returned (VERIFIED-CLAIMS
    // GSC-API-01). The label is the landing page's Example card label.
    example: {
      label: 'Example',
      rows: [
        { path: '/pricing', coverage: 'Crawled - currently not indexed' },
      ],
    },
  },
  // COPY.md, First Site report: the saved read spends no URL Inspection.
  // gscdump inspects a new Site's sitemap URLs by itself, within the Free
  // allowance, so only the report's own URL Inspection waits for approval.
  // The cost line stays beside the approve button, not here.
  sync: {
    title: 'Saved verdicts come first',
    why: 'The report reads saved Google verdicts first. That read uses no URL Inspections.',
    facts: [
      'gscdump inspects the sitemap URLs of a new Site after its sitemaps sync, within your Free allowance.',
      'This report inspects more URLs only when you approve it.',
      'After setup, the Indexing page of each Site lists its saved verdicts.',
    ],
  },
}
