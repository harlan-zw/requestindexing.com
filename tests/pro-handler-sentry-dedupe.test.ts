import type { H3Event } from 'h3'
import { createError, defineEventHandler, H3Error } from 'h3'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { defineProApiHandler } from '../layers/pro-saas/server/utils/handler'

vi.mock('../layers/pro-saas/server/utils/get-caller', () => ({
  getCaller: vi.fn(),
  requireCaller: vi.fn(),
}))
vi.mock('../layers/pro-saas/server/utils/require-current-team', () => ({
  requireCurrentTeam: vi.fn(),
}))
vi.mock('../layers/pro-saas/server/utils/require-site-access', () => ({
  requireSiteAccess: vi.fn(),
}))

const { captureException, captureMessage, scopeSpies } = vi.hoisted(() => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  scopeSpies: {
    setTag: vi.fn(),
    setContext: vi.fn(),
    setFingerprint: vi.fn(),
    setLevel: vi.fn(),
  },
}))

// evlog-sentry-drain captures through `@sentry/cloudflare`. The SDK is not
// initialized under vitest, so the module is mocked at the seam the drain
// uses and `withScope` runs its callback synchronously.
vi.mock('@sentry/cloudflare', () => ({
  captureException,
  captureMessage,
  withScope: (fn: (scope: typeof scopeSpies) => void) => fn(scopeSpies),
}))

vi.stubGlobal('defineEventHandler', defineEventHandler)
vi.stubGlobal('setResponseHeader', vi.fn())
vi.stubGlobal('createError', createError)

vi.spyOn(console, 'error').mockImplementation(() => {})

// Mirrors the nitro `error` hook @sentry/nuxt installs
// (@sentry/nuxt build/module/runtime/hooks/captureErrorHook.js): an H3Error
// with statusCode >= 500 is auto-captured unless its `cause` already carries
// Sentry's `__sentry_captured__` marker.
const nitroErrorHookCapture = vi.fn()
async function sentryCaptureErrorHook(error: unknown): Promise<void> {
  if (error instanceof H3Error) {
    if (error.statusCode >= 300 && error.statusCode < 500)
      return
    if ('cause' in error && typeof error.cause === 'object' && error.cause !== null && '__sentry_captured__' in error.cause)
      return
  }
  nitroErrorHookCapture()
}

beforeAll(async () => {
  // The drain plugin registers its Sentry sink via the nitro plugin global;
  // resolve that global to a direct call so importing runs the registration.
  vi.stubGlobal('defineNitroPlugin', (fn: () => void) => fn())
  await import('../layers/pro-saas/server/plugins/evlog-sentry-drain')
})

function makeEvent(): H3Event {
  return { context: {} } as unknown as H3Event
}

describe('unhandled 500 Sentry dedupe', () => {
  it('reports an unhandled 500 to Sentry exactly once, through the log sink', async () => {
    captureException.mockClear()
    nitroErrorHookCapture.mockClear()

    const handler = defineProApiHandler(() => {
      throw new Error('db exploded')
    })

    const thrown = await handler(makeEvent()).catch((e: unknown) => e)

    expect(thrown).toBeInstanceOf(H3Error)
    expect((thrown as H3Error).statusCode).toBe(500)
    await sentryCaptureErrorHook(thrown)

    expect(nitroErrorHookCapture).not.toHaveBeenCalled()
    expect(captureException).toHaveBeenCalledTimes(1)
    const [captured] = captureException.mock.calls[0] ?? []
    expect(captured).toMatchObject({ message: 'db exploded' })
  })

  it.each([
    ['string', 'boom'],
    ['null', null],
  ] as const)('reports an unhandled 500 from a %s throw to Sentry exactly once', async (_label, thrownValue) => {
    captureException.mockClear()
    captureMessage.mockClear()
    nitroErrorHookCapture.mockClear()

    const handler = defineProApiHandler(() => {
      throw thrownValue
    })

    const thrown = await handler(makeEvent()).catch((e: unknown) => e)

    expect(thrown).toBeInstanceOf(H3Error)
    expect((thrown as H3Error).statusCode).toBe(500)
    await sentryCaptureErrorHook(thrown)

    expect(nitroErrorHookCapture).not.toHaveBeenCalled()
    // The sink reports the failure exactly once, via the exception or the
    // message seam; the nitro hook adds no second capture.
    const sinkReports = captureException.mock.calls.length + captureMessage.mock.calls.length
    expect(sinkReports).toBe(1)
  })
})
