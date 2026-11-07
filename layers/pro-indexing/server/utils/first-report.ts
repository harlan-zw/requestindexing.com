import { z } from 'zod'
import { pagePropertyCoversUrl, savedPageMatchesHost } from '#layers/pro-saas/shared/page-task'

interface SitemapPage {
  generation: { id: string, observedAt: number }
  items: { url: string }[]
  page: { nextCursor: string | null }
}

/** A bounded preview of known membership, never an estimate of Site-wide coverage. */
export async function readFirstReportCandidates(
  host: string,
  property: string,
  read: (query: { generationId?: string, cursor?: string, limit: number }) => Promise<SitemapPage>,
  generationId?: string,
) {
  const urls: string[] = []
  let generation: SitemapPage['generation'] | undefined
  let cursor: string | undefined
  for (let page = 0; page < 10; page++) {
    const response = await read({ generationId: generation?.id ?? generationId, cursor, limit: 100 })
    if ((generationId && response.generation.id !== generationId) || (generation && generation.id !== response.generation.id))
      throw new Error('Sitemap generation changed during the preview.')
    generation = response.generation
    for (const row of response.items) {
      if (row.url.length > 2048 || !URL.canParse(row.url))
        continue
      const parsed = new URL(row.url)
      if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password || row.url.includes('#'))
        continue
      const url = parsed.href
      if (savedPageMatchesHost(url, host) && pagePropertyCoversUrl(url, property) && !urls.includes(url))
        urls.push(url)
      if (urls.length === 10)
        break
    }
    if (urls.length === 10 || !response.page.nextCursor)
      return urls.length ? { _tag: 'Ready' as const, urls, generationId: generation.id, observedAt: new Date(generation.observedAt).toISOString() } : { _tag: 'Empty' as const }
    cursor = response.page.nextCursor
  }
  // A partial set is still an honest preview. An exhausted bounded search is not absence.
  return urls.length && generation
    ? { _tag: 'Ready' as const, urls, generationId: generation.id, observedAt: new Date(generation.observedAt).toISOString() }
    : { _tag: 'Incomplete' as const }
}

const planSchema = z.object({
  userId: z.number().int(),
  teamId: z.number().int(),
  siteId: z.string(),
  remoteSiteId: z.string(),
  property: z.string(),
  generationId: z.string(),
  urls: z.array(z.string().max(2048)).min(1).max(10),
  expiresAt: z.number(),
}).strict()
export type FirstReportPlan = z.infer<typeof planSchema>

export function firstReportPlanMatches(plan: FirstReportPlan, current: Pick<FirstReportPlan, 'userId' | 'teamId' | 'siteId' | 'remoteSiteId' | 'property'>) {
  return plan.userId === current.userId && plan.teamId === current.teamId && plan.siteId === current.siteId && plan.remoteSiteId === current.remoteSiteId && plan.property === current.property
}

const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
const decode = (text: string) => Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0))

async function key(secret: string) {
  if (secret.length < 32)
    throw new Error('First report signing is unavailable.')
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signFirstReportPlan(plan: FirstReportPlan, secret: string) {
  const payload = encode(new TextEncoder().encode(JSON.stringify(plan)))
  const signature = await crypto.subtle.sign('HMAC', await key(secret), new TextEncoder().encode(`first-report.v1.${payload}`))
  return `${payload}.${encode(new Uint8Array(signature))}`
}

export async function verifyFirstReportPlan(token: string, secret: string, now: number): Promise<FirstReportPlan | null> {
  if (token.length > 40000 || !/^[\w-]+\.[\w-]+$/.test(token))
    return null
  const [payload, signature] = token.split('.') as [string, string]
  let bytes: Uint8Array<ArrayBuffer>
  let value: unknown
  try {
    bytes = decode(signature)
    value = JSON.parse(new TextDecoder().decode(decode(payload)))
  }
  catch {
    // Malformed client tokens are expected input failures.
    return null
  }
  if (!await crypto.subtle.verify('HMAC', await key(secret), bytes, new TextEncoder().encode(`first-report.v1.${payload}`)))
    return null
  const parsed = planSchema.safeParse(value)
  return parsed.success && parsed.data.expiresAt > now ? parsed.data : null
}
