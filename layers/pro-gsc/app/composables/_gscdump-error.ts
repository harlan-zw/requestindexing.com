import type { EntitlementRefusal } from '@gscdump/contracts'
import type { PartnerErrorKind } from '@gscdump/sdk/partner-errors'
import { toPartnerError } from '@gscdump/sdk/partner-errors'
import { refusalMessage } from '../../shared/entitlement-copy'
import { refusalFromError } from '../../shared/entitlement-refusal'

export type GscdumpErrorCode
  = | 'AUTH'
    | 'PERMISSION'
    | 'NOT_FOUND'
    | 'PROVISIONING'
    | 'RATE_LIMIT'
    | 'REFUSED'
    | 'SERVER'
    | 'NETWORK'
    | 'VALIDATION'
    | 'UNKNOWN'

interface GscdumpErrorBase {
  message: string
  status?: number
}

export type GscdumpError
  = | (GscdumpErrorBase & { code: 'AUTH' | 'PERMISSION' | 'NOT_FOUND' | 'PROVISIONING' | 'VALIDATION', retry: false })
    | (GscdumpErrorBase & { code: 'REFUSED', refusal: EntitlementRefusal, retry: false })
    | (GscdumpErrorBase & { code: 'RATE_LIMIT' | 'SERVER' | 'NETWORK' | 'UNKNOWN', retry: true })

function messageFor(kind: PartnerErrorKind, message: string): string {
  switch (kind) {
    case 'auth':
      return 'Authentication failed. Please reconnect your account.'
    case 'permission':
      return 'Search Console permission is missing. Please reconnect your account.'
    case 'not-found':
      return 'Data not found. The site may not be synced yet.'
    case 'provisioning':
      return 'Search Console data is still being prepared.'
    case 'rate-limit':
      return 'Rate limited. Please wait a moment and try again.'
    case 'server':
      return 'Server error. Please try again later.'
    case 'network':
      return 'Network error. Check your connection.'
    case 'validation':
      return message || 'Search Console rejected this request.'
    case 'unknown':
      return message || 'An unexpected error occurred.'
  }
}

export function isGscdumpError(error: unknown): error is GscdumpError {
  if (!error || typeof error !== 'object')
    return false
  const value = error as Partial<GscdumpError>
  if (typeof value.message !== 'string')
    return false
  switch (value.code) {
    case 'AUTH':
    case 'PERMISSION':
    case 'NOT_FOUND':
    case 'PROVISIONING':
    case 'VALIDATION':
      return value.retry === false
    case 'REFUSED':
      return value.retry === false && 'refusal' in value
    case 'RATE_LIMIT':
    case 'SERVER':
    case 'NETWORK':
    case 'UNKNOWN':
      return value.retry === true
    default:
      return false
  }
}

export function parseGscdumpError(error: unknown): GscdumpError {
  if (isGscdumpError(error))
    return error

  // An entitlement refusal first. gscdump answers a full Free allowance or a
  // held Site with 409, which the generic mapping reads as "still being
  // prepared", and its message points to Local mode. Render the tag instead.
  const refusal = refusalFromError(error)
  if (refusal) {
    return {
      code: 'REFUSED',
      refusal,
      message: refusalMessage(refusal),
      status: refusal.reason === 'inspection_allowance' ? 429 : 409,
      retry: false,
    }
  }

  const partnerError = toPartnerError(error)
  const base = {
    message: messageFor(partnerError.kind, partnerError.message),
    status: partnerError.statusCode,
  }

  switch (partnerError.kind) {
    case 'auth':
      return { ...base, code: 'AUTH', retry: false }
    case 'permission':
      return { ...base, code: 'PERMISSION', retry: false }
    case 'not-found':
      return { ...base, code: 'NOT_FOUND', retry: false }
    case 'provisioning':
      return { ...base, code: 'PROVISIONING', retry: false }
    case 'rate-limit':
      return { ...base, code: 'RATE_LIMIT', retry: true }
    case 'server':
      return { ...base, code: 'SERVER', retry: true }
    case 'network':
      return { ...base, code: 'NETWORK', retry: true }
    case 'validation':
      return { ...base, code: 'VALIDATION', retry: false }
    case 'unknown':
      return { ...base, code: 'UNKNOWN', retry: true }
  }
}
