import type { DatabaseSync } from 'node:sqlite'
import { createRequire, registerHooks } from 'node:module'
import { dirname, join } from 'node:path'
import { parse } from 'devalue'
import { mockEvent } from 'nitro/h3'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
// eslint-disable-next-line antfu/no-import-dist, antfu/no-import-node-modules-by-path -- auth-utils exports its Nuxt module only
import { getUserSession, setUserSession, USER_SESSION_COOKIE_NAME } from '../node_modules/nuxt-auth-utils/dist/runtime/server/utils/session.js'
import { migratedSqlite, proDatabase, seedUser } from './utils/pro-database'

// `/_ws` pushes a user's Site sync events. Its sockets live in Nitro's one
// Durable Object, which hibernates when idle: the sockets stay open, and the
// isolate's memory is wiped. These tests run Nitro's real Durable Object class
// and crossws's real adapter over a fake runtime that keeps only what
// Cloudflare keeps, each open socket and its attachment.

const NITRO = dirname(createRequire(import.meta.url).resolve('nitro/package.json'))

const h = vi.hoisted(() => ({ db: null as unknown }))

vi.mock('nuxt/internal/server-runtime-config', () => ({ useRuntimeConfig: () => ({ appSecret: 'websocket-test-secret-32-characters-long' }) }))
vi.stubGlobal('getUserSession', getUserSession)
vi.stubGlobal('useDrizzle', () => h.db)

const nativeHooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'cloudflare:workers')
      return { url: new URL('./setup/cloudflare-durable.ts', import.meta.url).href, shortCircuit: true }
    return nextResolve(specifier, context)
  },
})
afterAll(() => nativeHooks.deregister())

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
  readyState?: number
  sendError?: Error
}

interface Socket {
  readonly readyState: number
  send: (data: string) => void
  close: (code?: number) => void
  serializeAttachment: (value: unknown) => void
  deserializeAttachment: () => unknown
}

function socketOf(connection: Connection): Socket {
  return {
    get readyState() { return connection.closed ? 3 : connection.readyState ?? 1 },
    send: (data) => {
      if (connection.sendError)
        throw connection.sendError
      connection.received.push(parse(data))
    },
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
    const { default: socketHandler } = await import('../layers/core/server/routes/_ws')
    vi.doMock(join(NITRO, 'dist/runtime/internal/app.mjs'), () => ({
      useNitroApp: () => ({ fetch: () => new Response(null, { status: 404 }) }),
      useNitroHooks: () => ({ callHook: () => undefined }),
      async resolveWebsocketHooks(request: Request) {
        return (await socketHandler(mockEvent(request)) as Response & { crossws: unknown }).crossws
      },
    }))
    vi.doMock(join(NITRO, 'dist/runtime/internal/task.mjs'), () => ({ runCronTasks: () => Promise.resolve() }))
    const { $DurableObject } = await import('#test/nitro-cloudflare-durable')
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
  const event = mockEvent('https://requestindexing.com/_ws')
  await setUserSession(event, data)
  const cookie = event.res.headers.getSetCookie().findLast(value => value.startsWith(`${USER_SESSION_COOKIE_NAME}=`))!
  return cookie.split(';')[0]!
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
  it.each([2, 3])('skips a socket in state %s and reaches the next subscriber after hibernation', async (readyState) => {
    const { connections, wake } = runtime()
    const durable = await wake()
    await durable.fetch(upgradeRequest('/_ws', signedIn))
    await durable.fetch(upgradeRequest('/_ws', signedIn))
    connections[0]!.readyState = readyState
    connections[0]!.sendError = new Error('Socket is closing')
    await broadcast(await wake(), 'u_1', SYNC_FINISHED)
    expect(connections.map(connection => connection.received)).toEqual([[], [SYNC_FINISHED]])
  })

  it('reports a send failure and delivers to the remaining subscribers', async () => {
    const { connections, wake } = runtime()
    const durable = await wake()
    await durable.fetch(upgradeRequest('/_ws', signedIn))
    await durable.fetch(upgradeRequest('/_ws', signedIn))
    const error = new Error('Socket send failed')
    connections[0]!.sendError = error
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await broadcast(await wake(), 'u_1', SYNC_FINISHED)
    expect(connections.map(connection => connection.received)).toEqual([[], [SYNC_FINISHED]])
    expect(warning).toHaveBeenCalledWith(error)
    warning.mockRestore()
  })

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
