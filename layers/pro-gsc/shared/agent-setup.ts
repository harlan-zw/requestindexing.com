// Agent setup, the first onboarding step (COPY.md, Agent setup assets). The
// reader picks a coding agent, Claude, or ChatGPT, copies its Setup prompt,
// and approves the gscdump sign-in. Or they select Skip agent setup and
// continue in the web flow. The choice rides `?agent=` through the Connect
// Google round trip.
//
// Every route reaches gscdump's MCP server or the gscdump CLI in Hosted mode.
// Request Indexing has no listing of its own. gscdump finds its account by
// Google account, so the person must sign in to gscdump with the Google
// account they later connect here. Then gscdump's account is the one this
// app registers at Connect Google, and the agent reads the same Sites.
//
// A Setup prompt carries no secret. The coding agent signs in through the
// CLI's browser login, which the person approves. Claude and ChatGPT sign in
// through gscdump's OAuth when the person adds gscdump.
//
// No connection status: gscdump reports no browser login or MCP grant to a
// partner (its integration activity counts partner-issued API keys only), and
// before Connect Google this app holds no gscdump user to ask about.

import { ONBOARDING_ROUTE } from '#layers/pro-saas/shared/onboarding'
import { GSCDUMP_CLI_PACKAGE } from './developer-setup'

export const AGENT_SETUP_ROUTES = ['coding-agent', 'claude', 'chatgpt'] as const

export type AgentSetupRoute = typeof AGENT_SETUP_ROUTES[number]

type HostedAgentRoute = Exclude<AgentSetupRoute, 'coding-agent'>

/** Parse an untrusted `?agent=` value once, at the boundary. */
export function parseAgentSetupRoute(value: unknown): AgentSetupRoute | null {
  return AGENT_SETUP_ROUTES.find(route => route === value) ?? null
}

/** Where the reader finishes setup. An empty Site list sends the agent's reader here, never to gscdump.com. */
export const ONBOARDING_SETUP_URL = `https://requestindexing.com${ONBOARDING_ROUTE}`

export interface AgentSetupOption {
  route: AgentSetupRoute
  label: string
  detail: string
  /** The product mark. One monochrome set, so the list never mixes styles. */
  icon: string
}

export const AGENT_SETUP_OPTIONS: readonly AgentSetupOption[] = [
  { route: 'coding-agent', label: 'Coding agent', detail: 'Claude Code, Codex, or Cursor, in your terminal', icon: 'i-ph-terminal-window-duotone' },
  { route: 'claude', label: 'Claude', detail: 'Claude.ai or Claude Desktop, through gscdump\'s listing', icon: 'i-simple-icons-claude' },
  { route: 'chatgpt', label: 'ChatGPT', detail: 'ChatGPT, through gscdump\'s app', icon: 'i-simple-icons-openai' },
]

export const AGENT_SETUP_COPY = {
  groupLabel: 'Agent',
  copyPrompt: 'Copy setup prompt',
  promptCopied: 'Setup prompt copied',
  codingAgentHelp: 'Paste it into your coding agent. It stops at the gscdump sign-in for your approval.',
  commandsSummary: 'Run the commands yourself',
  signIn: 'Sign in to gscdump with the Google account that owns your Search Console property. Approve the access.',
  pastePrompt: (label: string) => `Paste the Setup prompt into a new ${label} chat.`,
  next: 'Next, connect Google here. Your agent reads your Sites after you connect them.',
  continue: 'Continue',
  skip: 'Skip agent setup',
} as const

/**
 * How the person adds gscdump to Claude or ChatGPT. Claude links gscdump's
 * directory listing. ChatGPT links gscdump's guide, because gscdump's own
 * records disagree on whether its ChatGPT app is public.
 */
export const HOSTED_AGENT_ADD: Record<HostedAgentRoute, { step: string, label: string, to: string }> = {
  claude: {
    step: 'Add gscdump to Claude from its directory listing.',
    label: 'Open gscdump in Claude',
    to: 'https://claude.ai/directory/gscdump',
  },
  chatgpt: {
    step: 'Add the gscdump app to ChatGPT. The guide shows each step.',
    label: 'Read the ChatGPT guide',
    to: 'https://gscdump.com/mcp/chatgpt',
  },
}

/** The coding agent route without an agent: the same commands the Setup prompt runs. */
export const CODING_AGENT_COMMANDS: readonly { command: string, note?: string }[] = [
  { command: `npm install -g ${GSCDUMP_CLI_PACKAGE}` },
  { command: 'gscdump auth login --mode hosted', note: 'Then approve the sign-in in your browser.' },
  { command: 'gscdump sites --json' },
]

const EMPTY_SITES = `If the list is empty, stop. Tell me to finish Connect Google and Connect Sites at ${ONBOARDING_SETUP_URL}, then wait for me. My Sites live in Request Indexing. Never connect a Site on gscdump.com.`

const SAVED_VERDICTS = 'These are saved URL Inspection verdicts, not Google\'s live index. Say when gscdump counted them. Say how many URLs have an indexed verdict, how many do not, and where they stopped.'

const PAPERCUT_RULES = 'Start the comment with "Agent report for Request Indexing". Give the expected and actual behavior, and any workaround. Keep personal data, private URLs, and secrets out of it.'

function buildCodingAgentPrompt(): string {
  return `Connect this environment to my Request Indexing account through the gscdump CLI. Then tell me what Google's saved verdicts show for my Site.

1. Install the CLI. It needs Node.js 22.13 or later:
   npm install -g ${GSCDUMP_CLI_PACKAGE}
2. If you are Claude Code or Codex, install the skill. Read the SKILL.md it prints before you continue:
   gscdump skill install --agent claude    # Codex: --agent codex
   Any other client, Cursor included: read \`gscdump --help\` instead.
3. Sign in:
   gscdump auth login --mode hosted
   It opens gscdump.com in my browser. If no browser opens, show me the link it prints.
   Stop and wait. I sign in with the Google account that owns my Search Console property, then I approve the CLI.
   Never ask me for an API key, a password, or a cookie.
4. Confirm the account:
   gscdump auth status --json
   Tell me the account it shows. If it is not the Google account that owns my Search Console property, stop and tell me.
5. List my Sites:
   gscdump sites --json
   ${EMPTY_SITES}
6. Use the Site I name, or the only Site. Read its saved verdicts with its Site ID from step 5:
   gscdump indexing summary --site <site-id> --json
   ${SAVED_VERDICTS}
   Never run \`gscdump indexing inspect\`. It uses my Free allowance and Google's daily URL Inspection quota.

If a command fails twice, report it once, then tell me what blocked you:
   gscdump papercut --command "<the command>" --agent "<your name>" --comment "<report>" --origin requestindexing.com --product requestindexing --surface cli --yes --json
${PAPERCUT_RULES}`
}

function buildHostedAgentPrompt(): string {
  return `Use the gscdump tools to read my Request Indexing Sites. Then tell me what Google's saved verdicts show for my Site.

1. Call list-sites. If the gscdump tools are missing, or they ask me to sign in, stop. Tell me to add gscdump and sign in with the Google account that owns my Search Console property.
2. ${EMPTY_SITES} Never call connect-site.
3. Use the Site I name, or the only Site. Call get-indexing with its Site ID.
   ${SAVED_VERDICTS}
4. For saved evidence on one URL, use get-indexing-urls or get-url-inspection. Never call inspect-url. It uses my Free allowance and Google's daily URL Inspection quota.

If a tool call fails twice, report it once with submit-feedback, if you have that tool. Then tell me what blocked you.
${PAPERCUT_RULES}`
}

/**
 * The Setup prompt for one route. It signs in through the browser and stops
 * for approval, confirms the account, hands an empty Site list back to this
 * app, reads saved verdicts only, and reports a step that fails twice
 * through gscdump's paper cut intake, the one an agent can reach.
 */
export function buildAgentSetupPrompt(route: AgentSetupRoute): string {
  return route === 'coding-agent' ? buildCodingAgentPrompt() : buildHostedAgentPrompt()
}
