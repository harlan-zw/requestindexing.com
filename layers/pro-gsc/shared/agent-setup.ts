// Agent setup, the first onboarding step (COPY.md, Agent setup assets). The
// reader picks Claude, ChatGPT, Gemini, or a coding agent, copies its Setup
// prompt, and approves the gscdump sign-in. Or they select Skip agent setup
// and continue in the web flow. The choice rides `?agent=` through the
// Connect Google round trip.
//
// Every route reaches gscdump's MCP server or the gscdump CLI in Hosted mode.
// Request Indexing has no listing of its own. gscdump finds its account by
// Google account, so the person must sign in to gscdump with the Google
// account they later connect here. Then gscdump's account is the one this
// app registers at Connect Google, and the agent reads the same Sites.
//
// A Setup prompt carries no secret. The coding agent signs in through the
// CLI's browser login, which the person approves. Claude, ChatGPT, and Gemini
// sign in through gscdump's OAuth when the person adds gscdump.
//
// No connection status: gscdump reports no browser login or MCP grant to a
// partner (its integration activity counts partner-issued API keys only), and
// before Connect Google this app holds no gscdump user to ask about.

import { ONBOARDING_ROUTE } from '#layers/pro-saas/shared/onboarding'
import { GSCDUMP_CLI_PACKAGE, GSCDUMP_MCP_URL } from './developer-setup'

/** Each Agent setup route, in the order the step lists them, and each `?agent=` id it accepts. */
export const AGENT_SETUP_ROUTES = ['claude', 'chatgpt', 'gemini', 'coding-agent'] as const

export type AgentSetupRoute = typeof AGENT_SETUP_ROUTES[number]

type HostedAgentRoute = Exclude<AgentSetupRoute, 'coding-agent'>

/** Parse an untrusted `?agent=` value once, at the boundary. */
export function parseAgentSetupRoute(value: unknown): AgentSetupRoute | null {
  return AGENT_SETUP_ROUTES.find(route => route === value) ?? null
}

/** Where the reader finishes setup. An empty Site list sends the agent's reader here, never to gscdump.com. */
export const ONBOARDING_SETUP_URL = `https://requestindexing.com${ONBOARDING_ROUTE}`

/** A product and its real mark. `invertDark` flips a near-black mark so it shows on a dark surface. */
export interface AgentMark {
  label: string
  icon: string
  invertDark?: boolean
}

/**
 * The coding agents the Coding agent row names, with the marks gscdump.com
 * shows. They all take the same Setup prompt, so they share one route.
 */
export const CODING_AGENT_MARKS: readonly AgentMark[] = [
  { label: 'Claude Code', icon: 'i-logos-claude-icon' },
  { label: 'Codex', icon: 'i-logos-openai-icon', invertDark: true },
  { label: 'Cursor', icon: 'i-simple-icons-cursor' },
  { label: 'Copilot', icon: 'i-logos-github-copilot', invertDark: true },
  { label: 'OpenCode', icon: 'i-simple-icons-opencode' },
]

/** What a row says under its label. The Coding agent row names its agents by their marks. */
export type AgentSetupDetail
  = | { _tag: 'Text', text: string }
    | { _tag: 'Marks', marks: readonly AgentMark[], more: string }

export interface AgentSetupOption extends AgentMark {
  route: AgentSetupRoute
  detail: AgentSetupDetail
}

/**
 * COPY.md, Agent setup assets. The chat apps first, by the names people know,
 * each with its plan or region limit. Then every coding agent in one row.
 * Claude on the web, desktop, and mobile share one connector, so Claude is one
 * row. `terminal` is a design system icon role, so it follows the active set.
 */
export const AGENT_SETUP_OPTIONS: readonly AgentSetupOption[] = [
  { route: 'claude', label: 'Claude', detail: { _tag: 'Text', text: 'Web, desktop, and mobile share one connection.' }, icon: 'i-logos-claude-icon' },
  // https://help.openai.com/en/articles/12584461
  { route: 'chatgpt', label: 'ChatGPT', detail: { _tag: 'Text', text: 'On the web. Custom apps need a Business, Enterprise, or Edu plan.' }, icon: 'i-logos-openai-icon', invertDark: true },
  // https://support.google.com/gemini/answer/17209137
  { route: 'gemini', label: 'Gemini', detail: { _tag: 'Text', text: 'On the web. Personal Google Accounts in the US.' }, icon: 'i-logos-google-gemini-icon' },
  { route: 'coding-agent', label: 'Coding agent', detail: { _tag: 'Marks', marks: CODING_AGENT_MARKS, more: 'and others' }, icon: 'terminal' },
]

export const AGENT_SETUP_COPY = {
  groupLabel: 'Agent',
  copyPrompt: 'Copy setup prompt',
  promptCopied: 'Setup prompt copied',
  runCommands: 'Run the commands yourself',
  copyCommands: 'Copy commands',
  copyServerUrl: 'Copy server URL',
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
  /** A value the reader enters in another app, shown under the detail with its own copy button. */
  paste?: string
  action: AgentSetupAction | null
}

// gscdump finds its account by Google account (header note), so every
// approval step names the account to use.
const GOOGLE_ACCOUNT = 'Sign in with the Google account that owns your Search Console property.'

interface HostedAgent {
  label: string
  add: { detail: string, action: string, to: string, paste?: string }
  approve: string
}

/**
 * How the person adds gscdump to each chat app. Claude links gscdump's
 * directory listing. ChatGPT links gscdump's setup steps, because gscdump's
 * own records disagree on whether its ChatGPT app is public. Gemini adds
 * gscdump as a custom app by its MCP URL. "Connected Apps" is Gemini's menu
 * name, not a status.
 */
const HOSTED_AGENTS: Record<HostedAgentRoute, HostedAgent> = {
  claude: {
    label: 'Claude',
    add: { detail: 'From the Claude directory.', action: 'Add to Claude', to: 'https://claude.ai/directory/gscdump' },
    approve: 'Approve access',
  },
  chatgpt: {
    label: 'ChatGPT',
    add: { detail: 'Follow the setup steps on gscdump.com.', action: 'Open setup steps', to: 'https://gscdump.com/mcp/chatgpt' },
    approve: 'Approve access',
  },
  gemini: {
    label: 'Gemini',
    add: {
      detail: 'In Gemini, open Settings, then Connected Apps, then Add a custom app. Enter this URL.',
      action: 'Open Gemini',
      to: 'https://gemini.google.com/',
      paste: GSCDUMP_MCP_URL,
    },
    approve: 'Sign in and approve access',
  },
}

/** The steps of one route, in order. A coding agent runs the setup itself, so its Setup prompt comes first. */
export function agentSetupSteps(route: AgentSetupRoute): readonly AgentSetupStep[] {
  if (route === 'coding-agent') {
    return [
      { key: 'copy', title: 'Copy the Setup prompt', detail: 'Your agent installs the gscdump CLI and signs in.', action: { _tag: 'CopyPrompt' } },
      { key: 'approve', title: 'Approve the sign-in', detail: `Your agent opens gscdump in your browser. ${GOOGLE_ACCOUNT}`, action: null },
    ]
  }
  const { label: app, add, approve } = HOSTED_AGENTS[route]
  return [
    { key: 'add', title: `Add gscdump to ${app}`, detail: add.detail, paste: add.paste, action: { _tag: 'Link', label: add.action, to: add.to } },
    { key: 'approve', title: approve, detail: `${app} opens gscdump. ${GOOGLE_ACCOUNT}`, action: null },
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
