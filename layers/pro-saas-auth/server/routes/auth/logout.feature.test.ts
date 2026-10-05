import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const clear = vi.fn()
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('clearUserSession', clear)

const { default: logout } = await import('./logout.get')

function event(path = '/auth/logout') {
  const request = new IncomingMessage(new Socket())
  request.url = path
  return createEvent(request, new ServerResponse(request))
}

beforeEach(() => {
  clear.mockReset()
})

describe('logout route', () => {
  it('waits for the session to clear before redirecting home', async () => {
    let finish!: () => void
    clear.mockReturnValue(new Promise<void>((resolve) => {
      finish = resolve
    }))
    const request = event()
    const pending = logout(request)
    expect(request.node.res.getHeader('location')).toBeUndefined()
    finish()
    await pending
    expect(request.node.res.getHeader('location')).toBe('/')
  })

  it('does not redirect if clearing the session fails', async () => {
    clear.mockRejectedValue(new Error('Session storage unavailable'))
    const request = event()
    await expect(logout(request)).rejects.toThrow('Session storage unavailable')
    expect(request.node.res.getHeader('location')).toBeUndefined()
  })

  it('returns to a single invitation after signing out', async () => {
    const request = event('/auth/logout?redirect=/team-invitations/abc_DEF-123')
    await logout(request)
    expect(request.node.res.getHeader('location')).toBe('/team-invitations/abc_DEF-123')
  })

  it.each(['https://evil.test', '//evil.test', '/auth/google', '/team-invitations/a/../../auth/google'])('rejects unsafe logout destinations: %s', async (redirect) => {
    const request = event(`/auth/logout?redirect=${encodeURIComponent(redirect)}`)
    await logout(request)
    expect(request.node.res.getHeader('location')).toBe('/')
  })
})
