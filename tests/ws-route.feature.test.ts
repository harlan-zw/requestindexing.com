import type { SessionConfig } from 'h3'
import type { DatabaseSync } from 'node:sqlite'
import { sealSession, useSession } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedSqlite, proDatabase, seedUser } from './utils/pro-database'

// `/_ws` pushes a user's Site sync events. The subscriber must be the signed-in
// user, whatever user id the connection URL names.
const h = vi.hoisted(() => ({
  db: null as unknown,
  hook: vi.fn((_name: string, _callback: (message: unknown) => void) => vi.fn()),
}))

const SESSION: SessionConfig = { name: 'nuxt-session', password: 'a-test-password-that-is-32-chars!' }

interface Request { url: string, headers: Headers, context?: Record<string, unknown> }

interface FakePeer {
  id: string
  request: Request
  context: Record<string, unknown>
  send: ReturnType<typeof vi.fn>
  close: ReturnType<typeof vi.fn>
}

// nuxt-auth-utils reads the session through h3, so this is its reader over the
// real h3 session code. h3 cannot start a session on an upgrade request, which
// is not an H3Event, so a request without a cookie throws.
async function getUserSession(event: { headers?: Headers, request?: Request, context?: Record<string, unknown> }) {
  const session = await useSession(event as never, SESSION)
  return { ...session.data, id: session.id }
}
vi.stubGlobal('getUserSession', getUserSession)
vi.stubGlobal('defineWebSocketHandler', (hooks: unknown) => hooks)
vi.stubGlobal('useDrizzle', () => h.db)
vi.stubGlobal('useNitroApp', () => ({ hooks: { hook: h.hook } }))

async function cookieFor(data: Record<string, unknown>): Promise<string> {
  const sealed = await sealSession({ context: { sessions: { [SESSION.name!]: { id: 'sid', createdAt: Date.now(), data } } } } as never, SESSION)
  return `${SESSION.name}=${sealed}`
}

function peer(url: string, cookie: string): FakePeer {
  const headers = new Headers(cookie ? { cookie } : {})
  return { id: `peer-${cookie}`, request: { url, headers }, context: {}, send: vi.fn(), close: vi.fn() }
}

// The route reads Nitro auto-imports at module load, so it loads after the stubs.
async function wsHooks() {
  const { default: hooks } = await import('../layers/core/server/routes/_ws')
  return hooks as unknown as {
    upgrade: (request: Request) => Promise<Response | void>
    open: (peer: FakePeer) => Promise<void>
    close: (peer: FakePeer) => void
  }
}

// What crossws 0.3 does with the hook's outcome: a returned or thrown Response
// ends the upgrade with that response, and any other throw becomes a 500.
async function upgrade(request: Request): Promise<number | 'upgraded'> {
  const hooks = await wsHooks()
  const outcome = await hooks.upgrade(request).then(
    result => result,
    (error: { response?: unknown }) => {
      const response = error?.response ?? error
      return response instanceof Response ? response : 500
    },
  )
  if (outcome === 500)
    return 500
  return outcome instanceof Response && !outcome.ok ? outcome.status : 'upgraded'
}

let sqlite: DatabaseSync
let signedIn: string

beforeEach(async () => {
  vi.clearAllMocks()
  sqlite = migratedSqlite()
  h.db = proDatabase(sqlite)
  seedUser(sqlite, 1)
  seedUser(sqlite, 2)
  signedIn = await cookieFor({ user: { id: 1 } })
})

describe('the /_ws websocket', () => {
  it('refuses the upgrade with a 401 for a visitor without a session cookie', async () => {
    expect(await upgrade(peer('/_ws?userId=2', '').request)).toBe(401)
  })

  it('refuses the upgrade with a 401 for a session without a user', async () => {
    expect(await upgrade(peer('/_ws', await cookieFor({ googleOauthState: 'x' })).request)).toBe(401)
  })

  it('upgrades a signed-in user', async () => {
    expect(await upgrade(peer('/_ws', signedIn).request)).toBe('upgraded')
  })

  it('subscribes the signed-in user even when the URL names another user', async () => {
    const hooks = await wsHooks()

    await hooks.open(peer('/_ws?userId=2', signedIn))

    expect(h.hook.mock.calls.map(([name]) => name)).toEqual(['ws:message:u_1'])
  })

  it('subscribes nobody for a visitor without a session', async () => {
    const hooks = await wsHooks()
    const visitor = peer('/_ws?userId=2', await cookieFor({}))

    await hooks.open(visitor)

    expect(h.hook).not.toHaveBeenCalled()
    expect(visitor.close).toHaveBeenCalled()
  })

  it('stops pushing to a connection once it closes', async () => {
    const unhook = vi.fn()
    h.hook.mockReturnValueOnce(unhook)
    const hooks = await wsHooks()
    const connection = peer('/_ws', signedIn)

    await hooks.open(connection)
    hooks.close(connection)

    expect(unhook).toHaveBeenCalledOnce()
  })
})
