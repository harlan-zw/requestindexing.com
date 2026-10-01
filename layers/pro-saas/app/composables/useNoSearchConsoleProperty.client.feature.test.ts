import type { MaybeRefOrGetter } from 'vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp, ref, toValue } from 'vue'
import { useNoSearchConsoleProperty } from './useNoSearchConsoleProperty'

// What `/api/pro/gsc-properties` answers, and whether the page let it run.
const read = {
  data: ref<unknown>(null),
  status: ref<'idle' | 'pending' | 'success' | 'error'>('idle'),
  enabled: (): boolean => false,
}
const session = ref<Record<string, unknown>>({})

Object.assign(globalThis, {
  useUserSession: () => ({ session }),
  useLazyFetch: (_url: string, options: { enabled: MaybeRefOrGetter<boolean> }) => {
    read.enabled = () => toValue(options.enabled)
    return { data: read.data, status: read.status }
  },
})

const apps: ReturnType<typeof createApp>[] = []

function use(active: MaybeRefOrGetter<boolean>) {
  let result: ReturnType<typeof useNoSearchConsoleProperty> | undefined
  const app = createApp({
    setup() {
      result = useNoSearchConsoleProperty(active)
      return () => null
    },
  })
  app.mount(document.createElement('div'))
  apps.push(app)
  return result!
}

beforeEach(() => {
  session.value = { gscConnected: true, gscEmail: 'agent@example.com' }
  read.data.value = { connected: true, properties: [] }
  read.status.value = 'success'
})

afterEach(() => {
  for (const app of apps.splice(0))
    app.unmount()
})

describe('a page with no Site', () => {
  // The 2026-10-01 replay, N6: the pages said "Connect a Site" and only
  // Connect a Site said the account had no property.
  it('reads the property list and says the Google account holds no property', () => {
    const noProperty = use(true)

    expect(read.enabled()).toBe(true)
    expect(noProperty.value).toBe(true)
  })

  it('keeps its Connect a Site prompt while the list loads, when a property exists, and when the read fails', () => {
    const noProperty = use(true)

    read.status.value = 'pending'
    read.data.value = null
    expect(noProperty.value).toBe(false)

    read.status.value = 'success'
    read.data.value = { connected: true, properties: [{ siteUrl: 'sc-domain:example.com', permissionLevel: 'siteOwner' }] }
    expect(noProperty.value).toBe(false)

    read.data.value = { connected: true, properties: [], error: { reason: 'GSCDUMP_ERROR', message: 'Request Indexing could not read your Search Console properties. Try again.' } }
    expect(noProperty.value).toBe(false)

    read.status.value = 'error'
    expect(noProperty.value).toBe(false)
  })
})

describe('the property read', () => {
  it('never runs for a page with Sites', () => {
    const hasSites = ref(true)
    const noProperty = use(() => !hasSites.value)

    expect(read.enabled()).toBe(false)
    expect(noProperty.value).toBe(false)

    hasSites.value = false
    expect(read.enabled()).toBe(true)
  })

  it('never runs without a Search Console connection, so the page asks for Google instead', () => {
    session.value = { gscConnected: false }
    const noProperty = use(true)

    expect(read.enabled()).toBe(false)
    expect(noProperty.value).toBe(false)
  })
})
