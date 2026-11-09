import { z } from 'zod'

export const SIGNUP_TOUCH_COOKIE = 'pro-first-touch'
const landingPaths = ['/', '/tools', '/guides', '/pro/onboarding', '/pro/dashboard', '/login', '/auth'] as const
const base = { landingPath: z.enum(landingPaths), capturedAt: z.iso.datetime() }
const campaignToken = (max: number) => z.string().min(1).max(max).regex(/^[a-z0-9._+-]+$/)
const domain = z.string().min(1).max(253).regex(/^[a-z0-9.-]+$/)
export const signupTouchSchema = z.discriminatedUnion('_tag', [
  z.object({ _tag: z.literal('campaign'), ...base, utmSource: campaignToken(80), utmMedium: campaignToken(80).optional(), utmCampaign: campaignToken(120).optional(), utmContent: campaignToken(120).optional(), utmTerm: campaignToken(120).optional(), referrerDomain: domain.optional() }).strict(),
  z.object({ _tag: z.literal('referral'), ...base, referrerDomain: domain }).strict(),
  z.object({ _tag: z.literal('direct'), ...base }).strict(),
])
export type SignupTouch = z.infer<typeof signupTouchSchema>
export interface SignupAttribution {
  attributionBasis: 'journey_linked' | 'auth_fallback'
  attributionKind: 'campaign' | 'referral' | 'direct'
  attributionConfidence: 'high' | 'medium' | 'low'
  attributionSource: string
  channelClass: 'paid' | 'owned' | 'earned' | 'direct' | 'unknown'
  landingPath: typeof landingPaths[number]
  capturedAt: string | null
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  referrerDomain?: string
}

function routeGroup(path: string): typeof landingPaths[number] | null {
  if (path === '/')
    return '/'
  if (path === '/login')
    return '/login'
  if (path.startsWith('/auth/'))
    return '/auth'
  if (path.startsWith('/pro/onboarding'))
    return '/pro/onboarding'
  if (path.startsWith('/pro/dashboard'))
    return '/pro/dashboard'
  if (/^\/tools(?:\/|$)/.test(path))
    return '/tools'
  if (/^\/guides(?:\/|$)/.test(path))
    return '/guides'
  return null
}

const handoffHosts = ['accounts.google.com', 'checkout.stripe.com', 'login.microsoftonline.com', 'login.live.com']
function referrerDomain(raw: string | undefined, ownHost: string): string | null {
  if (!raw || !URL.canParse(raw))
    return null
  const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '')
  const own = ownHost.toLowerCase().replace(/^www\./, '')
  if ([own, 'requestindexing.com', ...handoffHosts].some(root => host === root || host.endsWith(`.${root}`)))
    return null
  return domain.safeParse(host).success ? host : null
}
function token(value: unknown, max: number): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string')
    return null
  return raw.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9._+-]/g, '').slice(0, max) || null
}

/** Only finite route groups and normalized campaign tokens cross signup. */
export function captureSignupTouch(input: { path: string, query: Record<string, unknown>, referrer?: string, hostname: string, now: number }): SignupTouch | null {
  const landingPath = routeGroup(input.path)
  if (!landingPath)
    return null
  const capturedAt = new Date(input.now).toISOString()
  const utmSource = token(input.query.utm_source, 80)
  const utmMedium = token(input.query.utm_medium, 80)
  const utmCampaign = token(input.query.utm_campaign, 120)
  const utmContent = token(input.query.utm_content, 120)
  const utmTerm = token(input.query.utm_term, 120)
  const referrer = referrerDomain(input.referrer, input.hostname)
  if (utmSource || utmMedium || utmCampaign || utmContent || utmTerm) {
    return { _tag: 'campaign', landingPath, capturedAt, utmSource: utmSource ?? 'not-set', ...(utmMedium ? { utmMedium } : {}), ...(utmCampaign ? { utmCampaign } : {}), ...(utmContent ? { utmContent } : {}), ...(utmTerm ? { utmTerm } : {}), ...(referrer ? { referrerDomain: referrer } : {}) }
  }
  return referrer ? { _tag: 'referral', landingPath, capturedAt, referrerDomain: referrer } : { _tag: 'direct', landingPath, capturedAt }
}

export function parseSignupTouchCookie(raw: string | undefined): SignupTouch | null {
  if (!raw || raw.length > 2048)
    return null
  try {
    const parsed = signupTouchSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : null
  }
  catch {
    // Malformed client cookies are expected input failures. Sign-in stays available.
    return null
  }
}

const paid = new Set(['cpc', 'cpm', 'display', 'paid', 'paid-search', 'paid-social', 'paid_search', 'paid_social', 'ppc'])
const owned = new Set(['crm', 'email', 'lifecycle', 'newsletter', 'push', 'sms'])
const earned = new Set(['affiliate', 'organic', 'organic-search', 'organic-social', 'organic_search', 'organic_social', 'referral', 'social'])

export function resolveSignupAttribution(touch: SignupTouch | null): SignupAttribution {
  if (!touch || (touch.landingPath === '/auth' && touch._tag === 'direct')) {
    return { attributionBasis: 'auth_fallback', attributionKind: 'direct', attributionConfidence: 'low', attributionSource: 'unattributed', channelClass: 'unknown', landingPath: '/auth', capturedAt: null }
  }
  const { _tag, ...properties } = touch
  if (touch._tag === 'campaign') {
    const medium = touch.utmMedium ?? ''
    return { ...properties, attributionBasis: 'journey_linked', attributionKind: _tag, attributionConfidence: touch.utmSource === 'not-set' ? 'low' : 'high', attributionSource: `utm:${touch.utmSource}`, channelClass: paid.has(medium) ? 'paid' : owned.has(medium) ? 'owned' : earned.has(medium) ? 'earned' : 'unknown' }
  }
  return { ...properties, attributionBasis: 'journey_linked', attributionKind: _tag, attributionConfidence: touch._tag === 'referral' ? 'medium' : 'low', attributionSource: touch._tag === 'referral' ? `referral:${touch.referrerDomain}` : 'direct', channelClass: touch._tag === 'referral' ? 'earned' : 'direct' }
}
