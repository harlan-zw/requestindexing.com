// The realtime stream's resume cursor, kept across page loads.
//
// Ported from nuxtseo.com `layers/pro/gsc/app/internal/gscdump-realtime-cursor.ts`.
// The SDK's default store lives in memory, so every full page load started the
// stream with no cursor. The SDK then asks for a resync, and the resync here
// re-reads every Nuxt data key on the page. The 2026-10-01 replay measured it:
// each page made every read twice and minted two realtime tickets, and Connect
// a Site showed "Reading your Search Console properties." for 10 to 13 s.
//
// nuxtseo.com also checks the cursor against a stream head read during SSR.
// This app's integration route reads no head. The SDK still compares the stored
// cursor with the ticket's head, and resyncs on another stream or a cursor
// ahead of the head, so a wrong cursor costs one resync, never a missed event.
import type { RealtimeV1Cursor } from '@gscdump/contracts/v1'
import type { GscdumpRealtimeV1CursorStore } from '@gscdump/sdk/v1'

export interface CursorStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

/** `createRealtimeV1Schemas().cursor`, passed in so this module stays free of zod. */
export interface GscdumpCursorSchemas {
  cursor: { safeParse: (raw: unknown) => { success: true, data: RealtimeV1Cursor } | { success: false } }
}

export function gscdumpCursorStorageKey(scope: string): string {
  return `requestindexing:gscdump:v1:cursor:${scope}`
}

/**
 * A cursor store for one signed-in account. `scope` keeps one account from
 * resuming another account's stream in a shared browser.
 *
 * Storage can refuse every call (a private window, blocked site data). The
 * stream then runs as it did before this store: it resyncs on each page load.
 */
export function createGscdumpCursorStore(
  schemas: GscdumpCursorSchemas,
  scope: string,
  storage: CursorStorage,
): GscdumpRealtimeV1CursorStore {
  const key = gscdumpCursorStorageKey(scope)

  function forget(): void {
    try {
      storage.removeItem(key)
    }
    catch {
      // Ignorable: storage that refuses removal also refuses reads, so the
      // value can never be loaded.
    }
  }

  return {
    load(): RealtimeV1Cursor | null {
      let raw: string | null
      try {
        raw = storage.getItem(key)
      }
      catch {
        // Ignorable: no cursor means one resync, the behaviour before this store.
        return null
      }
      if (!raw)
        return null
      let value: unknown
      try {
        value = JSON.parse(raw)
      }
      catch {
        forget()
        return null
      }
      const parsed = schemas.cursor.safeParse(value)
      if (!parsed.success) {
        forget()
        return null
      }
      return parsed.data
    },
    save(cursor): void {
      try {
        storage.setItem(key, JSON.stringify(cursor))
      }
      catch {
        // Ignorable: the next page load starts without a cursor and resyncs once.
      }
    },
  }
}
