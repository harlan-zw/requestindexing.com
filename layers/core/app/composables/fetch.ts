import type { SiteFleetRow } from '~~/layers/core/app/types'
import { computed, getCurrentScope, watch } from 'vue'
import { createLogoutHandler } from '~~/layers/core/app/composables/auth'
import { clearNuxtData, useAsyncData, useNuxtApp, useNuxtData, useState } from '#imports'
import { useCallerState } from '#layers/pro-saas/app/composables/useCaller'

interface SiteRoster {
  sites: SiteFleetRow[]
}

interface RosterReadOwner {
  scope: string
  revision: number
}

interface RosterOwnership extends RosterReadOwner {
  caller: 'unconfirmed' | 'confirmed'
  value: { _tag: 'Empty' } | ({ _tag: 'Owned' } & RosterReadOwner)
}

function isRosterTransportFailure(error: unknown): boolean {
  // Nuxt adds a synthetic status to native errors. Inspect its original
  // cause, while preserving every actual HTTP refusal as a refusal.
  const cause = error instanceof Error ? error.cause ?? error : error
  if (!cause || typeof cause !== 'object')
    return false
  const request = cause as { status?: number, statusCode?: number, response?: unknown, cause?: unknown }
  if (request.status != null || request.statusCode != null || request.response != null)
    return false
  const source = request.cause ?? cause
  if (!(source instanceof Error))
    return false
  return source.name === 'TimeoutError' || (source instanceof TypeError
    && /failed to fetch|fetch failed|network request failed|networkerror|load failed/i.test(source.message))
}

/**
 * The `useAsyncData` key of the Team's Site roster. The dashboard layout, its
 * sidebar, and every page that lists Sites share this one entry, so a change
 * to the roster updates all of them at once.
 */
export const SITES_DATA_KEY = 'sites'

export async function fetchSites() {
  const toast = useToast()
  const { user, session, loggedIn } = useUserSession()
  const caller = useCallerState()
  const nuxtApp = useNuxtApp()
  const identity = computed(() => {
    const sealed = session.value?.user
    const currentCaller = sealed && caller.value?.user.id === sealed.id ? caller.value : null
    return {
      // A matching first Caller does not invalidate an SSR seed. A changed
      // principal or either Team selection retires it synchronously.
      scope: JSON.stringify([
        loggedIn.value,
        sealed?.id ?? null,
        sealed?.currentTeamId ?? null,
        currentCaller?.currentTeamId ?? sealed?.currentTeamId ?? null,
        currentCaller ? null : caller.value?.user.id ?? null,
      ]),
      canRetain: loggedIn.value && !!sealed && currentCaller?.currentTeamId != null,
    }
  })
  // Only provenance is stored here. Nuxt owns the one roster value.
  const ownership = useState<RosterOwnership>('sites:read-owner', () => ({
    scope: identity.value.scope,
    revision: 0,
    caller: identity.value.canRetain ? 'confirmed' : 'unconfirmed',
    value: { _tag: 'Empty' },
  }))
  const { data: previous } = useNuxtData<SiteRoster>(SITES_DATA_KEY)
  if (import.meta.client) {
    (getCurrentScope() ?? nuxtApp._scope).run(() => watch([() => identity.value.scope, () => identity.value.canRetain], ([scope, canRetain]) => {
      const caller = canRetain ? 'confirmed' : 'unconfirmed'
      const lostCaller = ownership.value.caller === 'confirmed' && !canRetain
      if (ownership.value.scope === scope && !lostCaller) {
        ownership.value.caller = caller
        return
      }
      ownership.value = { scope, revision: ownership.value.revision + 1, caller, value: { _tag: 'Empty' } }
      clearNuxtData(SITES_DATA_KEY)
    }, { immediate: true, flush: 'sync' }))
  }
  const logout = createLogoutHandler()
  const fetchFn = useRequestFetch()
  return useAsyncData<SiteRoster | undefined>(SITES_DATA_KEY, async (_, { signal }) => {
    const owner: RosterReadOwner = { scope: ownership.value.scope, revision: ownership.value.revision }
    const isCurrent = () => !signal.aborted && ownership.value.scope === owner.scope && ownership.value.revision === owner.revision
    // Nuxt registers its pending promise after invoking the handler. Let that
    // finish before a synchronous transport hook can retire this owner.
    await Promise.resolve()
    if (!isCurrent())
      throw new DOMException('The Site roster owner changed.', 'AbortError')
    const result = await fetchFn<SiteRoster>(`/api/sites/list`, {
      signal: import.meta.client ? signal : undefined,
      query: {
        teamId: user.value?.currentTeamId,
      },
      async onResponseError(res) {
        if (!isCurrent())
          return
        if ([401].includes(res.response.status)) {
          await logout(true)
          toast.add({
            id: 'unauthorized-error',
            title: 'Oops, looks like session has expired.',
            description: 'Please login again to continue.',
            color: 'error',
          })
        }
        else { toast.add({ id: 'unauthorized-error', title: 'Error fetching Sites', description: res.error?.message, color: 'error' }) }
      },
    })
    if (!isCurrent())
      throw new DOMException('The Site roster owner changed.', 'AbortError')
    ownership.value.value = { _tag: 'Owned', ...owner }
    return result
  }, {
    timeout: import.meta.client ? 25_000 : undefined,
    default: () => {
      const error = nuxtApp.payload._errors[SITES_DATA_KEY]
      const owner = ownership.value
      if (import.meta.client && identity.value.canRetain && owner.value._tag === 'Owned'
        && owner.scope === identity.value.scope && owner.value.scope === owner.scope && owner.value.revision === owner.revision
        && isRosterTransportFailure(error)) {
        return previous.value
      }
      owner.value = { _tag: 'Empty' }
      return undefined
    },
    // The dashboard layout and most dashboard pages both call `fetchSites()`.
    // On the server, Nuxt runs the handler again for the second call, so every
    // signed-in render read the roster twice, one after the other: 1.6 to
    // 1.9 s each in production (Workers Logs, 2026-10-01). Within one server
    // render the roster cannot change, so the second call reuses the first
    // answer. The browser keeps Nuxt's default: hydration reuses the payload,
    // and a client navigation reads the roster again.
    getCachedData: (key, nuxtApp, ctx) => {
      const owner = ownership.value
      if (owner.value._tag !== 'Owned' || owner.scope !== identity.value.scope
        || owner.value.scope !== owner.scope || owner.value.revision !== owner.revision) {
        return undefined
      }
      if (import.meta.server && ctx.cause === 'initial')
        return nuxtApp.payload.data[key]
      if (nuxtApp.isHydrating)
        return nuxtApp.payload.data[key]
      if (ctx.cause !== 'refresh:manual' && ctx.cause !== 'refresh:hook')
        return nuxtApp.static.data[key]
      return undefined
    },
  })
}
