import type { SessionConfig } from 'h3'
import type { DatabaseSync } from 'node:sqlite'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { parse } from 'devalue'
import { sealSession, useSession } from 'h3'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { migratedSqlite, proDatabase, seedUser } from './utils/pro-database'

// `/_ws` pushes a user's Site sync events. Its sockets live in Nitro's one
// Durable Object, which hibernates when idle: the sockets stay open, and the
// isolate's memory is wiped. These tests run Nitro's real Durable Object class
// and crossws's real adapter over a fake runtime that keeps only what
// Cloudflare keeps, each open socket and its attachment.

const NITROPACK = dirname(createRequire(createRequire(import.meta.url).resolve('nuxt/package.json')).resolve('nitropack/package.json'))
const CLOUDFLARE_RUNTIME = join(NITROPACK, 'dist/presets/cloudflare/runtime')

const SESSION: SessionConfig = { name: 'nuxt-session', password: 'a-test-password-that-is-32-chars!' }

const h = vi.hoisted(() => ({ db: null as unknown }))

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

// workerd answers an accepted upgrade with a 101 that carries the client
// socket. Node's Response refuses a status under 200.
vi.stubGlobal('Response', class extends Response {
  constructor(body?: BodyInit | null, init?: ResponseInit) {
    super(body, init?.status === 101 ? { ...init, status: 200 } : init)
    if (init?.status === 101)
      Object.defineProperty(this, 'status', { value: 101 })
  }
})

// What Cloudflare keeps for one connection while the Durable Object sleeps.
interface Connection {
  attachment: unknown
  received: unknown[]
  closed?: number
}

interface Socket {
  send: (data: string) => void
  close: (code?: number) => void
  serializeAttachment: (value: unknown) => void
  deserializeAttachment: () => unknown
}

function socketOf(connection: Connection): Socket {
  return {
    send: data => connection.received.push(parse(data)),
    close: (code) => {
      connection.closed = code
    },
    serializeAttachment: (value) => {
      connection.attachment = structuredClone(value)
    },
    deserializeAttachment: () => structuredClone(connection.attachment) ?? null,
  }
}

interface Durable {
  fetch: (request: Request) => Promise<Response>
  publish: (topic: string, data: string) => void
}

// The runtime side of the Durable Object. A wake builds a new isolate: fresh
// modules, a fresh Durable Object, and new socket objects over the same open
// connections, as Cloudflare hands back after hibernation.
function runtime() {
  const connections: Connection[] = []
  let awake: Socket[] = []
  vi.stubGlobal('WebSocketPair', class {
    0 = {}
    1: Socket
    constructor() {
      const connection: Connection = { attachment: null, received: [] }
      connections.push(connection)
      this[1] = socketOf(connection)
    }
  })

  async function wake(): Promise<Durable> {
    vi.resetModules()
    awake = connections.map(socketOf)
    const { default: hooks } = await import('../layers/core/server/routes/_ws')
    vi.doMock('cloudflare:workers', () => ({
      DurableObject: class {
        constructor(public ctx: unknown, public env: unknown) {}
      },
    }))
    vi.doMock('#nitro-internal-pollyfills', () => ({}))
    vi.doMock('#nitro-internal-virtual/public-assets', () => ({ isPublicAssetURL: () => false }))
    vi.doMock(join(NITROPACK, 'dist/runtime/index.mjs'), () => ({
      useNitroApp: () => ({ hooks: { callHook: async () => {} }, h3App: { websocket: { hooks } } }),
    }))
    vi.doMock(join(CLOUDFLARE_RUNTIME, '_module-handler.mjs'), () => ({
      createHandler: () => ({}),
      fetchHandler: () => new Response(null, { status: 404 }),
    }))
    const { $DurableObject } = await import(join(CLOUDFLARE_RUNTIME, 'cloudflare-durable.mjs'))
    const state = {
      waitUntil: () => {},
      acceptWebSocket: (socket: Socket) => awake.push(socket),
      getWebSockets: () => awake,
    }
    return new $DurableObject(state, {}) as Durable
  }

  return { connections, wake }
}

function upgradeRequest(url: string, cookie: string): Request {
  return new Request(`https://requestindexing.com${url}`, { headers: { upgrade: 'websocket', ...(cookie ? { cookie } : {}) } })
}

async function cookieFor(data: Record<string, unknown>): Promise<string> {
  const sealed = await sealSession({ context: { sessions: { [SESSION.name!]: { id: 'sid', createdAt: Date.now(), data } } } } as never, SESSION)
  return `${SESSION.name}=${sealed}`
}

// A queue job runs in its own isolate and reaches the Durable Object through
// the namespace binding. Only the instance Nitro names "server" holds sockets;
// any other name gets an empty one.
async function broadcast(durable: Durable, userPublicId: string, event: Record<string, unknown>): Promise<void> {
  const env = {
    $DurableObject: {
      idFromName: (name: string) => name,
      get: (id: string) => ({
        publish: async (topic: string, data: string) => id === 'server' ? durable.publish(topic, structuredClone(data)) : undefined,
      }),
    },
  }
  const { broadcastToUser } = await import('../layers/core/server/utils/realtime')
  await broadcastToUser(env, userPublicId, event)
}

const SYNC_FINISHED = { name: 'sites/sync-finished', entityId: 's_1', entityType: 'site', payload: { siteId: 's_1' } }

let sqlite: DatabaseSync
let signedIn: string

beforeEach(async () => {
  sqlite = migratedSqlite()
  h.db = proDatabase(sqlite)
  seedUser(sqlite, 1)
  seedUser(sqlite, 2)
  signedIn = await cookieFor({ user: { id: 1 } })
})

describe('the /_ws websocket', () => {
  it('refuses the upgrade with a 401 for a visitor without a session cookie', async () => {
    const durable = await runtime().wake()
    expect((await durable.fetch(upgradeRequest('/_ws?userId=2', ''))).status).toBe(401)
  })

  it('refuses the upgrade with a 401 for a session without a user', async () => {
    const durable = await runtime().wake()
    expect((await durable.fetch(upgradeRequest('/_ws', await cookieFor({ googleOauthState: 'x' })))).status).toBe(401)
  })

  it('closes a socket whose session names a user that no longer exists', async () => {
    const { connections, wake } = runtime()
    const durable = await wake()

    await durable.fetch(upgradeRequest('/_ws', await cookieFor({ user: { id: 99 } })))

    expect(connections.map(connection => connection.closed)).toEqual([4401])
  })

  it('pushes to the signed-in user, whatever user the URL names', async () => {
    const { connections, wake } = runtime()
    const durable = await wake()
    expect((await durable.fetch(upgradeRequest('/_ws?userId=2', signedIn))).status).toBe(101)

    await broadcast(durable, 'u_2', SYNC_FINISHED)
    await broadcast(durable, 'u_1', SYNC_FINISHED)

    expect(connections.map(connection => connection.received)).toEqual([[SYNC_FINISHED]])
  })

  it('still pushes to a socket that connected before the Durable Object hibernated', async () => {
    const { connections, wake } = runtime()
    await (await wake()).fetch(upgradeRequest('/_ws', signedIn))

    const woken = await wake()
    await broadcast(woken, 'u_1', SYNC_FINISHED)

    expect(connections.map(connection => connection.received)).toEqual([[SYNC_FINISHED]])
  })
})
