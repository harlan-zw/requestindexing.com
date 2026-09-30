import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { logError, logWarn } from '../shared/logging'

const { captureException, captureMessage, setLevel } = vi.hoisted(() => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setLevel: vi.fn(),
}))

vi.mock('@sentry/cloudflare', () => ({
  captureException,
  captureMessage,
  withScope: (fn: (scope: Record<string, unknown>) => void) => fn({
    setTag: vi.fn(),
    setContext: vi.fn(),
    setFingerprint: vi.fn(),
    setLevel,
  }),
}))

vi.spyOn(console, 'warn').mockImplementation(() => {})
vi.spyOn(console, 'error').mockImplementation(() => {})

beforeAll(async () => {
  vi.stubGlobal('defineNitroPlugin', (fn: () => void) => fn())
  await import('../layers/pro-saas/server/plugins/evlog-sentry-drain')
})

beforeEach(() => {
  captureException.mockClear()
  captureMessage.mockClear()
  setLevel.mockClear()
})

describe('evlog Sentry drain level', () => {
  it('reports a warn entry carrying an error at warning level', () => {
    logWarn('gscdump.proxy.failed', new Error('Database not provisioned'), { stage: 'settings.get' })

    expect(captureException).toHaveBeenCalledTimes(1)
    expect(setLevel).toHaveBeenCalledWith('warning')
    expect(setLevel).not.toHaveBeenCalledWith('error')
  })

  it('reports an error entry carrying an error at error level', () => {
    logError('gscdump.proxy.failed', new Error('boom'))

    expect(captureException).toHaveBeenCalledTimes(1)
    expect(setLevel).toHaveBeenCalledWith('error')
  })
})
