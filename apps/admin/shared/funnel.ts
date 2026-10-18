const DAY = 86_400_000

export const FUNNEL_STEPS = [
  { key: 'signedUp', label: 'Signed up' },
  { key: 'googleConnected', label: 'Connected Google' },
  { key: 'siteConnected', label: 'Connected a Site' },
  { key: 'setupCompleted', label: 'Finished setup' },
] as const

export interface FunnelUser {
  id: number
  name: string | null
  email: string
  signedUpAt: string
  signupEvidence: 'event' | 'account'
  source: string
  googleConnected: boolean
  siteConnected: boolean
  setupCompleted: boolean
}

export interface FunnelQuery {
  from: string
  to: string
  source: string
  stage: string
  search: string
  page: number
}

/** D1 has historical seconds, milliseconds and CURRENT_TIMESTAMP text. */
export function funnelTimestamp(value: unknown): string | null {
  if (value === null || value === undefined || value === '')
    return null
  let milliseconds: number
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value))) {
    const numeric = Number(value)
    milliseconds = numeric < 100_000_000_000 ? numeric * 1000 : numeric
  }
  else if (typeof value === 'string') {
    milliseconds = Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(' ', 'T')}Z` : value)
  }
  else {
    return null
  }
  return Number.isFinite(milliseconds) && milliseconds >= 0 && milliseconds <= 8.64e15
    ? new Date(milliseconds).toISOString()
    : null
}

export function defaultFunnelDates(now = Date.now(), days = 30) {
  const to = new Date(now).toISOString().slice(0, 10)
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * DAY).toISOString().slice(0, 10)
  return { from, to }
}

export function parseFunnelQuery(query: Record<string, unknown>, now = Date.now()): FunnelQuery {
  const defaults = defaultFunnelDates(now)
  const date = (value: unknown, fallback: string) => {
    const text = value === undefined ? fallback : value
    if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)
      || funnelTimestamp(`${text}T00:00:00Z`)?.slice(0, 10) !== text) {
      throw new Error('Choose valid start and end dates.')
    }
    return text
  }
  const from = date(query.from, defaults.from)
  const to = date(query.to, defaults.to)
  const days = (Date.parse(to) - Date.parse(from)) / DAY + 1
  if (days < 1 || days > 366)
    throw new Error('Choose a date range from 1 to 366 days.')
  const source = query.source === undefined ? 'all' : query.source
  const stage = query.stage === undefined ? 'all' : query.stage
  const search = query.search === undefined ? '' : query.search
  const page = query.page === undefined ? 1 : Number(query.page)
  if (typeof source !== 'string' || source.length > 200 || typeof search !== 'string' || search.length > 100
    || typeof stage !== 'string' || !['all', 'complete', ...FUNNEL_STEPS.slice(1).map(step => step.key)].includes(stage)
    || !Number.isSafeInteger(page) || page < 1 || Array.isArray(query.page)) {
    throw new Error('Choose valid funnel filters.')
  }
  return { from, to, source, stage, search: search.trim(), page }
}

export function funnelProgress(user: FunnelUser) {
  const evidence = [true, user.googleConnected, user.siteConnected, user.setupCompleted]
  const missing = evidence.findIndex(value => !value)
  return { reached: missing < 0 ? evidence.length : missing, next: missing < 0 ? 'complete' : FUNNEL_STEPS[missing]!.key }
}

/** A signup cohort followed through today, not unrelated events in the date window. */
export function buildFunnelReport(users: FunnelUser[], query: FunnelQuery, now = Date.now()) {
  const start = Date.parse(`${query.from}T00:00:00Z`)
  const end = Date.parse(`${query.to}T00:00:00Z`) + DAY
  const inPeriod = users.filter((user) => {
    const timestamp = Date.parse(user.signedUpAt)
    return timestamp >= start && timestamp < end && timestamp <= now
  })
  const sources = [...new Set(inPeriod.map(user => user.source))].sort()
  const cohort = inPeriod.filter(user => query.source === 'all' || user.source === query.source)
  const total = cohort.length
  const percent = (count: number, denominator: number) => denominator ? Math.round(count / denominator * 1000) / 10 : null
  const stages = FUNNEL_STEPS.map((step, index) => {
    const count = cohort.filter(user => funnelProgress(user).reached > index).length
    const previous = index ? cohort.filter(user => funnelProgress(user).reached >= index).length : total
    const observed = cohort.filter(user => index === 0 || user[step.key as 'googleConnected' | 'siteConnected' | 'setupCompleted']).length
    return { ...step, count, observed, percent: percent(count, total), conversion: percent(count, previous), dropped: previous - count }
  })
  const days = []
  const byDay = new Map<string, number>()
  for (const user of cohort) {
    const day = user.signedUpAt.slice(0, 10)
    byDay.set(day, (byDay.get(day) ?? 0) + 1)
  }
  for (let time = start; time < end; time += DAY) {
    const date = new Date(time).toISOString().slice(0, 10)
    days.push({ date, count: byDay.get(date) ?? 0 })
  }
  const search = query.search.toLowerCase()
  const filtered = cohort.filter(user => (query.stage === 'all' || funnelProgress(user).next === query.stage)
    && (!search || `${user.name ?? ''} ${user.email}`.toLowerCase().includes(search)))
    .sort((a, b) => b.signedUpAt.localeCompare(a.signedUpAt) || b.id - a.id)
  const pageSize = 50
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Math.min(query.page, pageCount)
  return {
    period: { from: query.from, to: query.to, timezone: 'UTC' as const },
    capturedAt: new Date(now).toISOString(),
    total,
    setupCompleted: cohort.filter(user => user.setupCompleted).length,
    accountDateFallbacks: cohort.filter(user => user.signupEvidence === 'account').length,
    completedOutsidePath: cohort.filter(user => user.setupCompleted && funnelProgress(user).next !== 'complete').length,
    sources,
    stages,
    days,
    users: filtered.slice((page - 1) * pageSize, page * pageSize).map(user => ({ ...user, next: funnelProgress(user).next })),
    pagination: { page, pageSize, pageCount, total: filtered.length },
  }
}

export type FunnelReport = ReturnType<typeof buildFunnelReport>
