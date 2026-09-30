// Setup steps for the Developers page. Each command exists twice: `display`
// masks the API key for the screen, and `copy` holds the full key for the
// clipboard. Before a key exists, both show the same placeholder.

export type SetupMethod = 'cli' | 'mcp' | 'api'

export const API_KEY_PLACEHOLDER = '$GSCDUMP_API_KEY'
// Cursor reads an environment variable with this syntax, so the placeholder
// config works as written once GSCDUMP_API_KEY is set.
// eslint-disable-next-line no-template-curly-in-string
const CURSOR_ENV_API_KEY = '${env:GSCDUMP_API_KEY}'
export const SITE_ID_PLACEHOLDER = 's_your_site'
export const GSCDUMP_MCP_URL = 'https://gscdump.com/mcp'
export const GSCDUMP_API_ROOT = 'https://gscdump.com/api'
export const GSCDUMP_SKILL_URL = 'https://gscdump.com/skill'
const GSCDUMP_CLI_PACKAGE = '@gscdump/cli'

export interface ApiKeyPresentation {
  display: string
  copy: string
}

export interface SetupCommand {
  display: string
  copy: string
}

export interface SetupLink {
  to: string
  label: string
}

export type SetupStep
  = | { _tag: 'command', title: string, body: string, command: SetupCommand, link?: SetupLink }
    | { _tag: 'api-key', title: string, body: string }
    | { _tag: 'link', title: string, body: string, to: string, label: string }

/** Keep the raw key out of visible markup. Only the clipboard gets it. */
export function presentApiKey(apiKey: string | null): ApiKeyPresentation {
  if (!apiKey)
    return { display: API_KEY_PLACEHOLDER, copy: API_KEY_PLACEHOLDER }
  return { display: `${apiKey.slice(0, 9)}••••${apiKey.slice(-4)}`, copy: apiKey }
}

function command(render: (apiKey: string) => string, key: ApiKeyPresentation): SetupCommand {
  return { display: render(key.display), copy: render(key.copy) }
}

const API_KEY_STEP_BODY = 'Create a key in API keys above. The commands below then include it.'

export function buildSetupSteps(method: SetupMethod, apiKey: string | null, siteId: string | null): SetupStep[] {
  const key = presentApiKey(apiKey)

  if (method === 'mcp') {
    return [
      {
        _tag: 'command',
        title: 'Claude.ai or ChatGPT',
        body: 'Enter this URL as a custom connector. Then sign in to gscdump with the Google account you use here. No API key is necessary.',
        command: command(() => GSCDUMP_MCP_URL, key),
      },
      { _tag: 'api-key', title: 'Create an API key', body: `Claude Code, Cursor, and other clients send an API key in a header. ${API_KEY_STEP_BODY}` },
      {
        _tag: 'command',
        title: 'Claude Code',
        body: 'Run this command in a terminal.',
        command: command(k => `claude mcp add --transport http gscdump ${GSCDUMP_MCP_URL} --header "x-api-key: ${k}"`, key),
      },
      {
        _tag: 'command',
        title: 'Codex',
        body: 'Add this server to ~/.codex/config.toml. Set GSCDUMP_API_KEY to your key, then restart Codex.',
        command: command(() => [
          '[mcp_servers.gscdump]',
          `url = "${GSCDUMP_MCP_URL}"`,
          'env_http_headers = { "x-api-key" = "GSCDUMP_API_KEY" }',
        ].join('\n'), key),
      },
      {
        _tag: 'command',
        title: 'Cursor and other clients',
        body: 'Add this server to the MCP config file of the client. For Cursor, the file is ~/.cursor/mcp.json.',
        command: command(k => JSON.stringify({
          mcpServers: {
            gscdump: {
              url: GSCDUMP_MCP_URL,
              headers: { 'x-api-key': k === API_KEY_PLACEHOLDER ? CURSOR_ENV_API_KEY : k },
            },
          },
        }, null, 2), key),
      },
    ]
  }

  if (method === 'api') {
    const site = siteId ?? SITE_ID_PLACEHOLDER
    return [
      { _tag: 'api-key', title: 'Create an API key', body: API_KEY_STEP_BODY },
      {
        _tag: 'command',
        title: 'Query your top queries',
        body: siteId
          ? 'This request reads the search queries for your first connected Site. Send the key as a bearer token.'
          : 'Connect a Site first. Then replace s_your_site with its gscdump Site ID.',
        command: command(k => [
          `curl -X POST ${GSCDUMP_API_ROOT}/analytics/v1/sites/${site}/reports \\`,
          `  -H "Authorization: Bearer ${k}" \\`,
          '  -H "Content-Type: application/json" \\',
          `  -d '{"state":{"dimensions":["query"],"searchType":"web"}}'`,
        ].join('\n'), key),
      },
      {
        _tag: 'link',
        title: 'Browse every operation',
        body: 'The hosted API guide lists each route, credential, and error.',
        to: 'https://github.com/harlan-zw/gscdump/blob/main/docs/hosted-api-v1.md',
        label: 'Read the API guide',
      },
    ]
  }

  return [
    {
      _tag: 'command',
      title: 'Install the CLI',
      body: 'Use Node.js 22.13 or later.',
      command: command(() => `npm install -g ${GSCDUMP_CLI_PACKAGE}`, key),
    },
    {
      _tag: 'command',
      title: 'Install the agent skill',
      body: 'The skill teaches Claude Code every gscdump command. For Codex, use --agent codex. Other clients can run gscdump --help.',
      command: command(() => 'gscdump skill install --agent claude', key),
      link: { to: GSCDUMP_SKILL_URL, label: 'Read about the skill' },
    },
    { _tag: 'api-key', title: 'Create an API key', body: API_KEY_STEP_BODY },
    {
      _tag: 'command',
      title: 'Sign in',
      body: 'The CLI saves the key and uses Hosted mode. Do this once on each machine.',
      command: command(k => `GSCDUMP_API_KEY=${k} gscdump auth login --mode hosted`, key),
    },
    {
      _tag: 'command',
      title: 'List your Sites',
      body: 'Every command has --help.',
      command: command(() => 'gscdump sites', key),
    },
  ]
}

/** The Site the agent setup prompt reads. `gscdumpSiteId` addresses the engine. */
export interface AgentPromptSite {
  gscdumpSiteId: string
  host: string
}

/**
 * The self-contained prompt that "Copy agent setup prompt" puts on the
 * clipboard. Ported from gscdump.com's `AppOverviewAgentSetup`. The agent
 * installs the CLI and the skill, saves the key with a Hosted mode login, and
 * ends on a read of the indexing record, never on a connection message.
 *
 * The key is saved, not exported: Claude Code and Codex start a new shell for
 * each command, so an `export` is gone by the next step. The raw key appears
 * once, as the environment of the login, and never in a command argument.
 */
export function buildAgentSetupPrompt(apiKey: string, site: AgentPromptSite | null): string {
  const host = site?.host ?? 'my Sites'
  const read = site
    ? `   gscdump indexing summary --site ${site.gscdumpSiteId} --json`
    : [
        '   gscdump indexing summary --json',
        '   If the CLI asks for --site, pass a Site URL from `gscdump sites --json`.',
      ].join('\n')
  return `Set up the gscdump CLI in this environment, then tell me what the indexing record shows for ${host}.

1. Install the CLI:
   npm install -g ${GSCDUMP_CLI_PACKAGE}
2. Install the agent skill, if you are Claude Code or Codex. The command prints where it wrote the skill. Read that SKILL.md before you run anything. It documents every command, the JSON envelope, and the exit codes:
   gscdump skill install --agent claude    # Codex: --agent codex
   Any other client, Cursor included: skip this step. Run \`gscdump --help\`, and \`gscdump <command> --help\`, which list the same commands and flags.
3. Save this API key with the CLI. The login stores the key and selects Hosted mode. Later commands read the saved key, so a new shell needs no setup. Give the key only through this variable, never as --api-key, and do not write it to a shell profile:
   GSCDUMP_API_KEY='${apiKey}' gscdump auth login --mode hosted
4. Confirm the key and list my Sites:
   gscdump auth status --json
   gscdump sites --json
5. Read the indexing record and summarise it for me:
${read}
   Its counts are stored URL Inspection verdicts. They are not Google's live index or the Search Console Page indexing report. Tell me that, and say when the verdicts were counted. Then say how many URLs have an indexed verdict. Say how many do not, and at which stage they stopped. Say what changed over the last 28 days.

If this client cannot run a terminal, the MCP server at ${GSCDUMP_MCP_URL} reads the same Search Console data over HTTP. Send the API key from step 3 in the x-api-key header.`
}
