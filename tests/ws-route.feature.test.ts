import type { DatabaseSync } from 'node:sqlite'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedSqlite, proDatabase, seedUser } from './utils/pro-database'

// `/_ws` pushes a user's Site sync events. The subscriber must be the signed-in
// user, whatever user id the connection URL names.
const h = vi.hoisted(() => ({
  db: null as unknown,
  sessions: new Map<string, { user?: { id: number } }>(),
  hook: vi.fn((_name: string, _callback: (message: unknown) => void) => vi.fn()),
}))

interface FakePeer {
  id: string
  request: { url: string, headers: Headers }
  send: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

vi.stubGlobal('defineWebSocketHandler', (hooks: unknown) => hooks)
vi.stubGlobal('useDrizzle', () => h.db)
vi.stubGlobal('useNitroApp', () => ({ hooks: { hook: h.hook } }))
vi.stubGlobal('getUserSession', async (peer: Pick<FakePeer, 'request'>) => h.sessions.get(peer.request.headers.get('cookie') ?? '') ?? {})
// nuxt-auth-utils answers a request without a session by throwing a 401 Response.
vi.stubGlobal('requireUserSession', async (request: FakePeer['request']) => {
  const session = h.sessions.get(request.headers.get('cookie') ?? '')
  if (!session?.user)
    throw new Response('Unauthorized', { status: 401 })
  return session
})

function peer(url: string, cookie: string): FakePeer {
  return { id: `peer-${cookie}`, request: { url, headers: new Headers({ cookie }) }, send: vi.fn(), close: vi.fn() }
}

// The route reads Nitro auto-imports at module load, so it loads after the stubs.
async function wsHooks() {
  const { default: hooks } = await import('../layers/core/server/routes/_ws')
  return hooks as unknown as {
    upgrade: (request: FakePeer['request']) => Promise<void>
    open: (peer: FakePeer) => Promise<void>
    close: (peer: FakePeer) => void
  }
}

let sqlite: DatabaseSync

beforeEach(() => {
  vi.clearAllMocks()
  sqlite = migratedSqlite()
  h.db = proDatabase(sqlite)
  seedUser(sqlite, 1)
  seedUser(sqlite, 2)
  h.sessions.set('session-1', { user: { id: 1 } })
})

describe('the /_ws websocket', () => {
  it('refuses the upgrade for a visitor without a session', async () => {
    const hooks = await wsHooks()

    await expect(hooks.upgrade(peer('/_ws?userId=2', 'no-session').request)).rejects.toMatchObject({ status: 401 })
  })

  it('subscribes the signed-in user even when the URL names another user', async () => {
    const hooks = await wsHooks()

    await hooks.open(peer('/_ws?userId=2', 'session-1'))

    expect(h.hook.mock.calls.map(([name]) => name)).toEqual(['ws:message:u_1'])
  })

  it('subscribes nobody for a visitor without a session', async () => {
    const hooks = await wsHooks()
    const visitor = peer('/_ws?userId=2', 'no-session')

    await hooks.open(visitor)

    expect(h.hook).not.toHaveBeenCalled()
    expect(visitor.close).toHaveBeenCalled()
  })

  it('stops pushing to a connection once it closes', async () => {
    const unhook = vi.fn()
    h.hook.mockReturnValueOnce(unhook)
    const hooks = await wsHooks()
    const connection = peer('/_ws', 'session-1')

    await hooks.open(connection)
    hooks.close(connection)

    expect(unhook).toHaveBeenCalledOnce()
  })
})
