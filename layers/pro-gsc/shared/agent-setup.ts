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

/** COPY.md, Agent setup assets. `terminal` is a design system icon role, so it follows the active set. */
export const AGENT_SETUP_OPTIONS: readonly AgentSetupOption[] = [
  { route: 'coding-agent', label: 'Coding agent', detail: 'Claude Code, Codex, or Cursor, through the gscdump CLI', icon: 'terminal' },
  { route: 'claude', label: 'Claude', detail: 'Claude on the web or desktop', icon: 'i-simple-icons-claude' },
  { route: 'chatgpt', label: 'ChatGPT', detail: 'ChatGPT on the web', icon: 'i-simple-icons-openai' },
]

export const AGENT_SETUP_COPY = {
  groupLabel: 'Agent',
  copyPrompt: 'Copy setup prompt',
  promptCopied: 'Setup prompt copied',
  runCommands: 'Run the commands yourself',
  copyCommands: 'Copy commands',
  next: 'Next, connect Google here. Your agent reads your Sites after you connect them.',
  continue: 'Continue',
  skip: 'Skip agent setup',
} as const

/** What the reader does in a step. A Link opens in a new tab. */
export type AgentSetupAction = { _tag: 'Link', label: string, to: string } | { _tag: 'CopyPrompt' }

/**
 * One numbered step of the chosen route. A step has no state: Request
 * Indexing cannot read whether the reader finished it, so every step keeps
 * its number.
 */
export interface AgentSetupStep {
  key: 'copy' | 'add' | 'approve' | 'ask'
  title: string
  detail: string
  action: AgentSetupAction | null
}

// gscdump finds its account by Google account (header note), so both
// approval steps name the account to use.
const GOOGLE_ACCOUNT = 'Sign in with the Google account that owns your Search Console property.'

/**
 * How the person adds gscdump to Claude or ChatGPT. Claude links gscdump's
 * directory listing. ChatGPT links gscdump's setup steps, because gscdump's
 * own records disagree on whether its ChatGPT app is public.
 */
const HOSTED_AGENT_ADD: Record<HostedAgentRoute, { detail: string, action: string, to: string }> = {
  claude: { detail: 'From the Claude directory.', action: 'Add to Claude', to: 'https://claude.ai/directory/gscdump' },
  chatgpt: { detail: 'Follow the setup steps on gscdump.com.', action: 'Open setup steps', to: 'https://gscdump.com/mcp/chatgpt' },
}

const HOSTED_AGENT_LABEL: Record<HostedAgentRoute, string> = { claude: 'Claude', chatgpt: 'ChatGPT' }

/** The steps of one route, in order. A coding agent runs the setup itself, so its Setup prompt comes first. */
export function agentSetupSteps(route: AgentSetupRoute): readonly AgentSetupStep[] {
  if (route === 'coding-agent') {
    return [
      { key: 'copy', title: 'Copy the Setup prompt', detail: 'Your agent installs the gscdump CLI and signs in.', action: { _tag: 'CopyPrompt' } },
      { key: 'approve', title: 'Approve the sign-in', detail: `Your agent opens gscdump in your browser. ${GOOGLE_ACCOUNT}`, action: null },
    ]
  }
  const app = HOSTED_AGENT_LABEL[route]
  const add = HOSTED_AGENT_ADD[route]
  return [
    { key: 'add', title: `Add gscdump to ${app}`, detail: add.detail, action: { _tag: 'Link', label: add.action, to: add.to } },
    { key: 'approve', title: 'Approve access', detail: `${app} opens gscdump. ${GOOGLE_ACCOUNT}`, action: null },
    { key: 'ask', title: 'Ask your first question', detail: `Paste the Setup prompt into a new ${app} chat.`, action: { _tag: 'CopyPrompt' } },
  ]
}

/** The coding agent route without an agent: the same commands the Setup prompt runs, one per line. */
export const CODING_AGENT_COMMANDS = [
  `npm install -g ${GSCDUMP_CLI_PACKAGE}`,
  'gscdump auth login --mode hosted',
  'gscdump sites --json',
].join('\n')

const EMPTY_SITES = `If the list is empty, stop. Tell me to finish Connect Google and Connect Sites at ${ONBOARDING_SETUP_URL}, then wait for me. My Sites live in Request Indexing. Never connect a Site on gscdump.com.`

// gscdump can hold a Site of its own for the same property, for example one
// its agent entry connected at sign-in. So the agent never picks a Site, even
// from a list of one: the reader chooses.
const CHOOSE_SITE = 'Show me each Site with its URL. Ask me which Site to read, and wait for my answer. Never choose a Site for me, even when the list has one Site.'

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
   ${CHOOSE_SITE}
6. Read the saved verdicts for the Site I chose, with its Site ID from step 5:
   gscdump indexing summary --site <site-id> --json
   ${SAVED_VERDICTS}
   Never run \`gscdump indexing inspect\`. It uses my Free allowance and Google's daily URL Inspection quota.

If a command fails twice, report it once, then tell me what blocked you:
   gscdump papercut --command "<the command>" --agent "<your name>" --comment "<report>" --origin requestindexing.com --product requestindexing --surface cli --yes --json
${PAPERCUT_RULES}`
}

function buildHostedAgentPrompt(): string {
  return `Use the gscdump tools to read my Request Indexing Sites. Then tell me what Google's saved verdicts show for my Site.

1. Ask me to confirm that I signed in to gscdump with the Google account that owns my Search Console property. Wait for my answer. If I used another account, stop.
2. Call list-sites. If the gscdump tools are missing, or they ask me to sign in, stop. Tell me to add gscdump and sign in with that Google account.
3. ${EMPTY_SITES} Never call connect-site.
   ${CHOOSE_SITE}
4. Call get-indexing with the Site ID of the Site I chose.
   ${SAVED_VERDICTS}
5. For saved evidence on one URL, use get-indexing-urls or get-url-inspection. Never call inspect-url. It uses my Free allowance and Google's daily URL Inspection quota.

If a tool call fails twice, report it once with submit-feedback, if you have that tool. Then tell me what blocked you.
${PAPERCUT_RULES}`
}

/**
 * The Setup prompt for one route. It signs in through the browser and stops
 * for approval, confirms the account, hands an empty Site list back to this
 * app, lets the reader choose the Site, and reads saved verdicts only. A step
 * that fails twice goes to gscdump's paper cut intake, the one an agent can
 * reach.
 */
export function buildAgentSetupPrompt(route: AgentSetupRoute): string {
  return route === 'coding-agent' ? buildCodingAgentPrompt() : buildHostedAgentPrompt()
}
