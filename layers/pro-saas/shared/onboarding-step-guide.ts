import type { OnboardingStep } from './onboarding'
import { GSC_CONNECT_COPY } from './gsc-connect-copy'

// COPY.md, Step guide assets. Each setup step has one step guide: what the
// reader signs up for at this step, and why. Show, then tell: a guide leads
// with an artifact where one makes the point, and keeps at most two facts. A
// fact states shipped behaviour only. A canonical string that has a constant
// comes from it, so the two places cannot drift apart. No fact repeats what
// the step or the progress rail already shows.

/** Google's coverage state for one URL, verbatim. Every example row is a URL Google left out. */
export interface OnboardingStepGuideExampleRow {
  path: string
  coverage: string
}

export interface OnboardingStepGuide {
  title: string
  why: string
  /** Questions the reader can ask their agent, drawn as chat bubbles. */
  questions?: readonly string[]
  /** One real artifact, only where it shows the point better than words. */
  example?: { label: string, rows: readonly OnboardingStepGuideExampleRow[] }
  facts: readonly string[]
}

export const ONBOARDING_STEP_GUIDES: Record<OnboardingStep, OnboardingStepGuide> = {
  // The questions match what the Setup prompt asks the agent to report: how
  // many URLs have an indexed verdict, and where the rest stopped
  // (`agent-setup.ts`, SAVED_VERDICTS). gscdump finds its account by Google
  // account, so the first fact names the account. The step's skip line
  // already says that agents can wait.
  agent: {
    title: 'Why start with an agent',
    why: 'Ask about your pages in the chat you already use.',
    questions: [
      'How many of my pages has Google indexed?',
      'Which pages did Google leave out, and why?',
    ],
    facts: [
      'Your agent signs in to gscdump, the engine behind Request Indexing. Use the same Google account for both.',
      'The Setup prompt holds no API key, cookie, or token.',
    ],
  },
  // The consent preview shows the read-only scope and how to remove access,
  // and the rail shows the steps that follow, so the guide states only what
  // Request Indexing changes and the terms.
  connect: {
    title: 'Why connect Google',
    why: 'Google reports its verdict for each page in Search Console.',
    facts: [
      // COPY.md, Truth rules, the Search Console access sentence, verbatim.
      GSC_CONNECT_COPY.changes,
      // COPY.md, Landing page assets, FAQ 5, verbatim.
      'Start free, within your Free allowance. No card needed.',
    ],
  },
  // What a Site gives: Google's reason for a URL it left out. The state is
  // one Google's URL Inspection API returned (VERIFIED-CLAIMS GSC-API-01).
  // The label is the landing page's Example card label. The property list
  // shows the Free allowance count when gscdump caps the account. The first
  // fact says that connecting starts URL Inspections within that allowance.
  sites: {
    title: 'What a Site is',
    why: 'One website, from a verified Search Console property.',
    example: {
      label: 'Example',
      rows: [
        { path: '/pricing', coverage: 'Crawled - currently not indexed' },
      ],
    },
    facts: [
      // Connecting spends allowance with no further click, so the guide says so.
      'gscdump then syncs the Site and inspects its sitemap URLs, within your Free allowance.',
      'You can connect more Sites later from your dashboard.',
    ],
  },
  // COPY.md, First Site report: the saved read spends no URL Inspection, and
  // only the report's own URL Inspection waits for approval. The cost line
  // stays beside the approve button, not here.
  sync: {
    title: 'Saved verdicts come first',
    why: 'The report reads saved Google verdicts first. That read uses no URL Inspections.',
    facts: [
      'This report inspects more URLs only when you approve it.',
      'After setup, the Indexing page of each Site lists its saved verdicts.',
    ],
  },
}
