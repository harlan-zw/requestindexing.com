import { z } from 'zod'
import { GSC_CONNECT_COPY } from './gsc-connect-copy'

export const PAGE_TASK_ROUTE = '/pro/dashboard/url-inspection'
export const PAGE_TASK_TTL = 7 * 24 * 60 * 60 * 1000
export const PAGE_SETUP_COPY = {
  heading: 'Keep checking your page',
  introduction: 'Connect the Site that contains this page. Your selected URL stays with you through setup.',
  target: 'The page you checked',
  signIn: 'Sign in, then allow Search Console access to see what Google reports for this page.',
  expired: 'Your saved page has expired. Check the page again to continue.',
  missing: 'Check a page to start, or connect a Site from your dashboard.',
  invalid: 'Enter an http or https page URL without a username or password.',
  tooLong: 'Use a page URL with at most 1024 characters.',
  unavailable: 'Your saved page could not load. Select Retry to load it again.',
  evidenceUnavailable: 'Your saved URL Inspection result could not load. Select Retry to try again.',
  review: 'Check that the Search Console property covers this page before you connect the Site.',
  host: 'Site host',
  property: 'Matching property',
  connect: 'Connect Site',
  resume: 'Resume this page',
  skip: 'Continue later',
  noEvidence: 'This page has no saved URL Inspection result.',
  inspectHeading: 'Check Google\'s indexing status for this URL',
  inspectHelp: 'You can inspect this URL while your history syncs.',
  inspectCost: 'One accepted check uses one URL Inspection from your Free allowance and Google\'s daily quota.',
  inspect: 'Inspect URL',
  inspectFailed: 'Google returned no inspection result for this page. Retry the check later.',
  inspectUnavailable: 'We could not confirm the inspection. Select Retry to check for a saved result.',
  dailyQuota: 'This Site has used its daily URL Inspection quota. Return when the quota resets.',
  resultHeading: 'Google\'s evidence for your page',
  source: 'Google URL Inspection',
  captured: 'Captured',
  notReported: 'Not reported by Google',
  coverage: 'Google coverage state',
  details: 'View inspection details',
  pending: 'This Site is being connected to Search Console. Refresh its status in a moment.',
  readAccess: GSC_CONNECT_COPY.readAccess,
  retry: 'Retry',
  propertyLimit: 'This Site\'s connected property does not cover your selected page.',
  connectedProperty: 'Connected property',
  otherProperties: 'Other properties in your Google account that cover this page',
  propertyRecovery: 'Open Search Console with this URL. This Site keeps its current property.',
  copyUrl: 'Copy URL',
  copiedUrl: 'URL copied',
  copyFailed: 'Copy the selected URL above. Your browser could not copy it.',
  changed: 'Your saved page changed. Reload this page before you inspect it.',
} as const

const taskSchema = z.object({
  id: z.string().min(1).max(64),
  url: z.string().max(1024),
  ownerId: z.number().int().positive().nullable(),
  createdAt: z.number().int().nonnegative(),
  expiresAt: z.number().int().positive(),
  evidenceViewedAt: z.number().int().nonnegative().nullable(),
})
export type PageTask = z.infer<typeof taskSchema>
export type PageTaskRead = { _tag: 'Available', task: PageTask } | { _tag: 'Missing' } | { _tag: 'Expired' }

export function createPageTask(input: unknown, ownerId: number | null, now: number, id: string): { _tag: 'Ok', task: PageTask } | { _tag: 'Err', message: string } {
  if (typeof input !== 'string' || !/^https?:\/\//i.test(input.trim()) || !URL.canParse(input.trim()))
    return { _tag: 'Err', message: PAGE_SETUP_COPY.invalid }
  const url = new URL(input.trim())
  if (!url.hostname || url.username || url.password)
    return { _tag: 'Err', message: PAGE_SETUP_COPY.invalid }
  url.hash = ''
  if (url.href.length > 1024)
    return { _tag: 'Err', message: PAGE_SETUP_COPY.tooLong }
  return { _tag: 'Ok', task: { id, url: url.href, ownerId, createdAt: now, expiresAt: now + PAGE_TASK_TTL, evidenceViewedAt: null } }
}

export function readPageTask(value: unknown, ownerId: number | null, now: number): PageTaskRead {
  const result = taskSchema.safeParse(value)
  if (!result.success || result.data.ownerId !== ownerId)
    return { _tag: 'Missing' }
  const task = result.data
  if (task.createdAt > now || task.expiresAt <= task.createdAt)
    return { _tag: 'Missing' }
  if (task.evidenceViewedAt !== null && (task.evidenceViewedAt < task.createdAt || task.evidenceViewedAt > now))
    return { _tag: 'Missing' }
  const normalized = createPageTask(task.url, ownerId, task.createdAt, task.id)
  if (normalized._tag !== 'Ok' || normalized.task.url !== task.url || task.expiresAt > task.createdAt + PAGE_TASK_TTL)
    return { _tag: 'Missing' }
  return task.expiresAt <= now ? { _tag: 'Expired' } : { _tag: 'Available', task }
}

export function bindPageTask(value: unknown, ownerId: number, now: number): PageTask | null {
  const owned = readPageTask(value, ownerId, now)
  if (owned._tag === 'Available')
    return owned.task
  const anonymous = readPageTask(value, null, now)
  return anonymous._tag === 'Available' ? { ...anonymous.task, ownerId } : null
}

export function savedPageMatchesHost(page: string, host: string): boolean {
  if (!URL.canParse(page))
    return false
  const target = host.includes('://') ? host : `https://${host.replace(/^sc-domain:/, '')}`
  return URL.canParse(target) && new URL(page).hostname.toLowerCase() === new URL(target).hostname.toLowerCase()
}

/** Google URL-prefix properties cover the literal prefix, including protocol and path. */
export function pagePropertyCoversUrl(page: string, property: string): boolean {
  if (!URL.canParse(page))
    return false
  const url = new URL(page)
  if (property.startsWith('sc-domain:')) {
    const domain = property.slice(10).toLowerCase()
    return /^[\w.-]+$/.test(domain) && (url.hostname === domain || url.hostname.endsWith(`.${domain}`))
  }
  if (!URL.canParse(property))
    return false
  const prefix = new URL(property)
  return !prefix.username && !prefix.password && url.origin === prefix.origin && url.href.startsWith(prefix.href)
}
