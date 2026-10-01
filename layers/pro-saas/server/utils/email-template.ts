// Markdown email templates with front matter, ported from nuxtseo.com's
// `email-template-loader.ts`. This app sends plain text only, so the HTML
// layout, the preheader, and the call-to-action button are cut.
//
// A template names its values as `{TOKEN}`. An unknown token throws when the
// template loads, so a typo fails the test suite instead of reaching an inbox.

export interface EmailTemplate {
  subject: string
  /** Hours to wait after the previous step sends, or after enrolment for the first step. */
  delayHours: number
  body: string
}

export interface EmailTemplateContext {
  firstName: string | null
  baseUrl: string
  unsubscribeUrl: string
}

export interface RenderedEmail {
  subject: string
  text: string
}

const TOKEN_PATTERN = /\{(\w+)\}/g

function buildTokens(ctx: EmailTemplateContext): Record<string, string> {
  const baseUrl = ctx.baseUrl.replace(/\/+$/u, '')
  return {
    firstName: ctx.firstName?.trim() || 'there',
    DASHBOARD_URL: `${baseUrl}/pro/dashboard`,
    INDEXING_URL: `${baseUrl}/pro/dashboard/indexing`,
    DEVELOPERS_URL: `${baseUrl}/pro/dashboard/developers`,
  }
}

const KNOWN_TOKENS = new Set(Object.keys(buildTokens({ firstName: null, baseUrl: '', unsubscribeUrl: '' })))

function assertKnownTokens(text: string): void {
  for (const [, name] of text.matchAll(TOKEN_PATTERN)) {
    if (!KNOWN_TOKENS.has(name!))
      throw new Error(`Email template uses an unknown token {${name}}. Known tokens: ${[...KNOWN_TOKENS].join(', ')}.`)
  }
}

export function parseEmailTemplate(raw: string): EmailTemplate {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match)
    throw new Error('Email template has no front matter.')
  const meta: Record<string, string> = {}
  for (const line of match[1]!.split('\n')) {
    const idx = line.indexOf(':')
    if (idx === -1)
      continue
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
  }
  const subject = meta.subject ?? ''
  const delayHours = Number(meta.delayHours)
  if (!subject)
    throw new Error('Email template has no subject.')
  if (!Number.isFinite(delayHours) || delayHours < 0)
    throw new Error(`Email template "${subject}" has no valid delayHours.`)
  const body = match[2]!.trim()
  assertKnownTokens(subject)
  assertKnownTokens(body)
  return { subject, delayHours, body }
}

function applyTokens(text: string, tokens: Record<string, string>): string {
  return text.replace(TOKEN_PATTERN, (_, name: string) => tokens[name]!)
}

export function renderEmailTemplate(template: EmailTemplate, ctx: EmailTemplateContext): RenderedEmail {
  const tokens = buildTokens(ctx)
  // `-- ` with its trailing space is the plain text signature separator.
  const footer = `-- \nHarlan Wilton · requestindexing.com\nUnsubscribe: ${ctx.unsubscribeUrl}`
  return {
    subject: applyTokens(template.subject, tokens),
    text: `${applyTokens(template.body, tokens)}\n\n${footer}\n`,
  }
}
