// The gscdump endpoints that Agent setup and the Developers page name, and the
// HTTP example under API keys. The example exists twice: `display` masks the
// API key for the screen, and `copy` holds the full key for the clipboard.
// Before a key exists, both show the same placeholder.
import { CONNECT_SITE_ROUTE } from '#layers/pro-saas/shared/onboarding'

export const API_KEY_PLACEHOLDER = '$GSCDUMP_API_KEY'
export const SITE_ID_PLACEHOLDER = 's_your_site'
export const GSCDUMP_MCP_URL = 'https://gscdump.com/mcp'
export const GSCDUMP_API_ROOT = 'https://gscdump.com/api'
export const GSCDUMP_API_GUIDE_URL = 'https://github.com/harlan-zw/gscdump/blob/main/docs/hosted-api-v1.md'
export const GSCDUMP_CLI_PACKAGE = '@gscdump/cli@^7.12.0'
/** Where a finished reader connects a Site. A Setup prompt sends them here, never to gscdump.com. */
export const CONNECT_SITE_URL = `https://requestindexing.com${CONNECT_SITE_ROUTE}`

export interface ApiKeyPresentation {
  display: string
  copy: string
}

/** Keep the raw key out of visible markup. Only the clipboard gets it. */
export function presentApiKey(apiKey: string | null): ApiKeyPresentation {
  if (!apiKey)
    return { display: API_KEY_PLACEHOLDER, copy: API_KEY_PLACEHOLDER }
  return { display: `${apiKey.slice(0, 9)}••••${apiKey.slice(-4)}`, copy: apiKey }
}

export interface ApiExample {
  description: string
  display: string
  copy: string
}

/**
 * The HTTP example: one read of a Site's indexing record, signed with the key
 * this visit created, or with the placeholder. Without a Site the example
 * keeps the placeholder Site ID and names the step that comes first.
 */
export function buildApiExample(apiKey: string | null, siteId: string | null): ApiExample {
  const key = presentApiKey(apiKey)
  const render = (value: string) => [
    `curl '${GSCDUMP_API_ROOT}/partner/v1/sites/${siteId ?? SITE_ID_PLACEHOLDER}/indexing?days=28' \\`,
    `  -H "Authorization: Bearer ${value}"`,
  ].join('\n')
  return {
    description: siteId
      ? 'Read stored URL Inspection verdicts and 28-day changes. The response names when the evidence was captured.'
      : 'Connect a Site first. Then replace s_your_site with its gscdump Site ID.',
    display: render(key.display),
    copy: render(key.copy),
  }
}
