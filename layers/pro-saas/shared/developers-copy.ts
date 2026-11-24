import type { OnboardingStepGuide } from './onboarding-step-guide'
import { ONBOARDING_STEP_GUIDES } from './onboarding-step-guide'

// COPY.md, Developers assets: the strings the Developers page adds around the
// agent panel it shares with onboarding Agent setup. The panel's own strings
// stay in `AGENT_SETUP_COPY`. The lead, the Connect label, and the API keys
// hint match gscdump.com's Developers page, so the family reads the same.

export const DEVELOPERS_COPY = {
  /** The agents section's heading, for screen readers. GLOSSARY.md names the section Agent setup. */
  agentsHeading: 'Agent setup',
  lead: 'You can connect more than one agent. Each one signs in on its own.',
  connect: 'Connect',
  apiKeysHeading: 'API keys',
  apiKeysHint: 'For scripts and SDKs. Agents do not need a key.',
  keyNamePlaceholder: 'Deploy script',
  keyInExample: 'The HTTP example below includes this key.',
  httpExample: 'HTTP example',
  apiGuide: 'Read the API guide',
} as const

/**
 * The guide card beside the agents: Agent setup's own guide, so both places
 * promise the same. Only the heading changes, because the reader finished
 * setup before they reach this page.
 */
export const DEVELOPERS_AGENT_GUIDE: OnboardingStepGuide = {
  ...ONBOARDING_STEP_GUIDES.agent,
  title: 'Why use an agent',
}
