import type { RealtimeV1Cursor, RealtimeV1Event } from '@gscdump/contracts/v1'
import type {
  GscdumpRealtimeV1CursorStore,
  GscdumpRealtimeV1Runtime,
  GscdumpRealtimeV1SocketLike,
} from '@gscdump/sdk/v1'
import { describe, expect, it } from 'vitest'
import { createGscdumpRealtimeV1Client } from '../layers/pro-gsc/app/internal/gscdump-realtime-runtime'

const STREAM = 'user:u_test' as const

async function settle(turns = 12): Promise<void> {
  for (let index = 0; index < turns; index++)
    await Promise.resolve()
}

async function settleUntil(predicate: () => boolean, turns = 200): Promise<void> {
  for (let index = 0; index < turns && !predicate(); index++)
    await Promise.resolve()
}

class FakeSocket implements GscdumpRealtimeV1SocketLike {
  readyState = 0
  protocol = ''
  onopen: ((event: unknown) => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: ((event: unknown) => void) | null = null
  onclose: ((event: { code?: number, reason?: string, wasClean?: boolean }) => void) | null = null
  readonly sent: string[] = []
  readonly closes: Array<{ code?: number, reason?: string }> = []
  onSend: ((data: string) => void) | undefined

  constructor(
    readonly url: string,
    readonly protocols: readonly string[],
  ) {}

  open(protocol = 'gscdump.v1'): void {
    this.protocol = protocol
    this.readyState = 1
    this.onopen?.({})
  }

  send(data: string): void {
    if (this.readyState !== 1)
      throw new Error('socket is not open')
    this.sent.push(data)
    this.onSend?.(data)
  }

  message(value: unknown): void {
    const data = typeof value === 'string' ? value : JSON.stringify(value)
    this.onmessage?.({ data })
  }

  error(value: unknown = new Error('opaque socket failure')): void {
    this.onerror?.(value)
  }

  serverClose(code: number, reason = ''): void {
    this.readyState = 3
    this.onclose?.({ code, reason, wasClean: code === 1000 })
  }

  close(code?: number, reason?: string): void {
    this.readyState = 3
    this.closes.push({ code, reason })
  }
}

class FakeRuntime implements GscdumpRealtimeV1Runtime {
  nowMs = Date.parse('2026-07-14T08:00:00.000Z')
  randomValue = 0
  readonly sockets: FakeSocket[] = []
  private timerId = 0
  private readonly timers = new Map<number, { at: number, handler: () => void }>()

  createSocket = (url: string, protocols: readonly string[]): FakeSocket => {
    const socket = new FakeSocket(url, protocols)
    this.sockets.push(socket)
    return socket
  }

  setTimeout = (handler: () => void, ms: number): number => {
    const id = ++this.timerId
    this.timers.set(id, { at: this.nowMs + Math.max(0, ms), handler })
    return id
  }

  clearTimeout = (handle: unknown): void => {
    this.timers.delete(handle as number)
  }

  random = (): number => this.randomValue
  now = (): number => this.nowMs

  async advance(ms: number): Promise<void> {
    const target = this.nowMs + ms
    while (true) {
      const next = [...this.timers.entries()]
        .filter(([, timer]) => timer.at <= target)
        .sort((left, right) => left[1].at - right[1].at || left[0] - right[0])[0]
      if (!next)
        break
      const [id, timer] = next
      this.timers.delete(id)
      this.nowMs = timer.at
      timer.handler()
      await settle()
    }
    this.nowMs = target
    await settle()
  }
}

class MemoryCursorStore implements GscdumpRealtimeV1CursorStore {
  readonly saves: RealtimeV1Cursor[] = []

  constructor(
    public value: RealtimeV1Cursor | null,
    private readonly rejectSave = false,
  ) {}

  load = (): RealtimeV1Cursor | null => this.value ? { ...this.value } : null

  save = async (cursor: RealtimeV1Cursor): Promise<void> => {
    this.saves.push({ ...cursor })
    if (this.rejectSave)
      throw new Error('cursor store unavailable')
    this.value = { ...cursor }
  }
}

function ticket(
  runtime: FakeRuntime,
  sequence: string,
  serial = 1,
  streamId: RealtimeV1Cursor['streamId'] = STREAM,
): unknown {
  return {
    data: {
      socketUrl: 'wss://gscdump.com/ws/v1',
      protocol: 'gscdump.v1',
      protocolVersion: 1,
      ticket: `gscdump.ticket.v1.payload${serial}.signature${serial}`,
      expiresAt: new Date(runtime.nowMs + 60_000).toISOString(),
      head: { streamId, sequence },
      maxConnectionSeconds: 900,
    },
    meta: { requestId: `req_ticket_${serial}`, surface: 'realtime', version: '1.0' },
  }
}

function ready(
  runtime: FakeRuntime,
  headSequence: string,
  replayFloorSequence = '0',
  expiresInMs = 600_000,
  streamId: RealtimeV1Cursor['streamId'] = STREAM,
): unknown {
  return {
    type: 'ready',
    protocolVersion: 1,
    connectionId: 'conn_test',
    streamId,
    head: { streamId, sequence: headSequence },
    replayFloor: { streamId, sequence: replayFloorSequence },
    limits: { maxBatchEvents: 20, maxUnackedEvents: 500 },
    heartbeat: { ping: 'ping', pong: 'pong' },
    expiresAt: new Date(runtime.nowMs + expiresInMs).toISOString(),
  }
}

function durableEvent(
  sequence: string,
  options: {
    data?: RealtimeV1Event['data']
    eventVersion?: number
    id?: string
    name?: string
    resource?: string
    streamId?: RealtimeV1Cursor['streamId']
  } = {},
): Extract<RealtimeV1Event, { delivery: 'durable' }> {
  return {
    type: 'event',
    protocolVersion: 1,
    eventVersion: options.eventVersion ?? 1,
    id: options.id ?? `evt_${sequence}`,
    name: options.name ?? 'site.lifecycle.changed',
    cursor: { streamId: options.streamId ?? STREAM, sequence },
    subject: { type: 'site', id: 's_test' },
    changes: [{ type: options.resource ?? 'site.lifecycle', id: 's_test', kind: 'updated' }],
    occurredAt: '2026-07-14T08:00:00.000Z',
    correlationId: null,
    delivery: 'durable',
    data: options.data ?? {},
  }
}

function ackSequences(socket: FakeSocket): string[] {
  return socket.sent
    .filter(value => value.startsWith('{'))
    .map(value => JSON.parse(value) as { type: string, cursor?: RealtimeV1Cursor })
    .filter(frame => frame.type === 'ack')
    .map(frame => frame.cursor!.sequence)
}

// Import the application's facade, which resolves the installed @gscdump/sdk/v1 export.
// Do not replace this with copied SDK source: this guards the published package consumed by Request Indexing.
describe('installed SDK heartbeat liveness', () => {
  it('keeps delivered pongs live while an authoritative resync is pending', async () => {
    const runtime = new FakeRuntime()
    const store = new MemoryCursorStore(null)
    const errors: string[] = []
    let finishRead!: () => void
    const pendingRead = new Promise<void>((resolve) => {
      finishRead = resolve
    })
    const client = createGscdumpRealtimeV1Client({
      runtime,
      cursorStore: store,
      ticketProvider: () => ticket(runtime, '0'),
      applyEvent: async () => {},
      resync: () => pendingRead,
      onObservation: (observation) => {
        if (observation.type === 'error')
          errors.push(observation.error.code)
      },
    })
    await client.start()
    const socket = runtime.sockets[0]!
    socket.onSend = (value) => {
      if (value === 'ping')
        socket.message('pong')
    }
    socket.open()
    socket.message(ready(runtime, '0'))
    await settle()
    await runtime.advance(100_000)

    expect(socket.sent.filter(value => value === 'ping')).toHaveLength(4)
    expect(errors).toEqual([])
    expect(socket.closes).toEqual([])
    expect(runtime.sockets).toHaveLength(1)
    expect(store.saves).toEqual([])
    expect(ackSequences(socket)).toEqual([])
    expect(client.getSnapshot().freshness).toBe('resyncing')

    finishRead()
    await settle()
    expect(store.value).toEqual({ streamId: STREAM, sequence: '0' })
    await runtime.advance(0)
    expect(runtime.sockets).toHaveLength(2)
    client.stop()
  })

  it('handles pongs during slow effects without acknowledging or reordering application events', async () => {
    const runtime = new FakeRuntime()
    const store = new MemoryCursorStore({ streamId: STREAM, sequence: '0' })
    const effects: string[] = []
    let finishEffect!: () => void
    const pendingEffect = new Promise<void>((resolve) => {
      finishEffect = resolve
    })
    const client = createGscdumpRealtimeV1Client({
      runtime,
      cursorStore: store,
      ticketProvider: () => ticket(runtime, '0'),
      applyEvent: async (event) => {
        effects.push(event.id)
        if (event.id === 'evt_1')
          await pendingEffect
      },
      resync: async () => {},
    })
    await client.start()
    const socket = runtime.sockets[0]!
    socket.onSend = (value) => {
      if (value === 'ping')
        socket.message('pong')
    }
    socket.open()
    socket.message(ready(runtime, '0'))
    await settle()
    socket.message(durableEvent('1'))
    socket.message(durableEvent('2'))
    await settle()
    await runtime.advance(100_000)

    expect(effects).toEqual(['evt_1'])
    expect(ackSequences(socket)).toEqual([])
    expect(store.saves).toEqual([])
    expect(socket.closes).toEqual([])
    expect(client.getSnapshot().error).toBeNull()

    finishEffect()
    await settleUntil(() => ackSequences(socket).length === 2)
    expect(effects).toEqual(['evt_1', 'evt_2'])
    expect(ackSequences(socket)).toEqual(['1', '2'])
    expect(store.saves.map(cursor => cursor.sequence)).toEqual(['1', '2'])
    client.stop()
  })

  it('does not treat pongs from an obsolete socket as current liveness', async () => {
    const runtime = new FakeRuntime()
    const client = createGscdumpRealtimeV1Client({
      runtime,
      cursorStore: new MemoryCursorStore({ streamId: STREAM, sequence: '0' }),
      ticketProvider: () => ticket(runtime, '0'),
      applyEvent: async () => {},
      resync: async () => {},
    })
    await client.start()
    const first = runtime.sockets[0]!
    first.open()
    first.message(ready(runtime, '0'))
    await settle()
    const obsoleteMessage = first.onmessage!
    first.serverClose(1012)
    await runtime.advance(500)
    const current = runtime.sockets[1]!
    current.open()
    current.message(ready(runtime, '0'))
    await settle()
    for (let index = 0; index < 2; index++) {
      await runtime.advance(25_000)
      obsoleteMessage({ data: 'pong' })
    }
    await runtime.advance(25_000)
    expect(client.getSnapshot().error?.code).toBe('heartbeat_stale')
    expect(current.closes).toHaveLength(1)
    client.stop()
  })

  it('still rejects a current connection that genuinely receives no pongs', async () => {
    const runtime = new FakeRuntime()
    const client = createGscdumpRealtimeV1Client({
      runtime,
      cursorStore: new MemoryCursorStore({ streamId: STREAM, sequence: '0' }),
      ticketProvider: () => ticket(runtime, '0'),
      applyEvent: async () => {},
      resync: async () => {},
    })
    await client.start()
    const socket = runtime.sockets[0]!
    socket.open()
    socket.message(ready(runtime, '0'))
    await settle()
    await runtime.advance(75_000)
    expect(client.getSnapshot().error?.code).toBe('heartbeat_stale')
    expect(socket.closes).toHaveLength(1)
    client.stop()
  })
})
