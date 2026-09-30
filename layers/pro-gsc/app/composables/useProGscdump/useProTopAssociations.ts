import type { GscSearchType } from '@gscdump/contracts'
import type { MaybeRefOrGetter, Ref } from 'vue'
import type { AssociationInput } from '../../../shared/analytics-requests'
import { computed, onScopeDispose, ref, toValue, watch } from 'vue'
import { logWarn } from '~~/shared/logging'
import { associationRequest } from '../../../shared/analytics-requests'
import { operatorFreeKeyword } from '../../../shared/search-operator-queries'
import { selectTopAssociations } from '../../../shared/top-associations'
import { useProGscFilters } from '../useProGscFilters'
import { useProGscdump } from './useProGscdump'

/**
 * Resolve the top associated entity for a table page in ONE read: the top page
 * for each query, or the top query for each page.
 *
 * nuxtseo.com answers the whole page in a single windowed scan. The `top-
 * association` operation this app had been using takes one identifier per call,
 * so a 25-row table issued 25 requests behind one pending flag and no cell
 * rendered until the slowest of them returned — the blank "Top page" column.
 * One grouped `(dimension, counterpart)` report replaces the fan-out; the
 * rank-1 pick is a pure function over the rows it returns.
 *
 * Keys already resolved for the current site and window are never requested
 * again, so paging through a load-more table costs only the new rows.
 */
export interface UseProTopAssociationsOptions {
  gscdumpSiteId: MaybeRefOrGetter<string | null | undefined>
  range: MaybeRefOrGetter<{ start: string, end: string }>
  /** Dimension the table rows are keyed by. The top of the other is returned. */
  group: 'query' | 'queryCanonical' | 'page'
  /** Visible row keys. */
  keys: MaybeRefOrGetter<readonly string[]>
  /** Search type slice. Defaults to the control bar's picker. */
  searchType?: MaybeRefOrGetter<GscSearchType | undefined>
}

export function useProTopAssociations(opts: UseProTopAssociationsOptions): {
  map: Ref<Map<string, string>>
  pending: Ref<boolean>
} {
  const gscdump = useProGscdump()
  const map = ref<Map<string, string>>(new Map())
  const pending = ref(false)
  const filters = useProGscFilters()
  const searchType = computed(() => toValue(opts.searchType) ?? filters.searchType.value)
  // Grouping by a query dimension returns the top page, and the reverse.
  const topDimension = opts.group === 'page' ? 'query' : 'page'
  const cached = new Map<string, string | null>()
  let cacheScope = ''

  const _keys = computed(() => {
    const seen = new Set<string>()
    for (const k of toValue(opts.keys)) {
      if (k)
        seen.add(k)
    }
    return [...seen]
  })

  // Async, so a request the contract rejects becomes a rejection the caller
  // logs, like a failed read.
  async function readAssociations(siteId: string, input: AssociationInput) {
    return gscdump.queryAnalyticsReport({ params: { siteId }, body: associationRequest(input) }, true)
  }

  let token = 0
  onScopeDispose(() => token++)
  watch(
    [() => toValue(opts.gscdumpSiteId), () => toValue(opts.range), _keys, searchType],
    async ([siteId, range, keys, slice]) => {
      const current = ++token
      const nextScope = siteId ? `${siteId}:${slice}:${range?.start}:${range?.end}:${opts.group}` : ''
      if (nextScope !== cacheScope) {
        cached.clear()
        cacheScope = nextScope
      }
      if (!import.meta.client || !siteId || !keys.length || !range?.start || !range?.end) {
        map.value = new Map()
        pending.value = false
        return
      }
      const missing = keys.filter(k => !cached.has(k))
      if (missing.length) {
        pending.value = true
        // Silent: an unresolved association renders as a dash in its own cell,
        // which says more than a toast over the whole table. The failure is
        // logged rather than dropped.
        const response = await readAssociations(siteId, { searchType: slice, group: opts.group, keys: missing, range })
          .catch((cause: unknown) => {
            logWarn('gscdump.table_cell.unresolved', cause, { read: 'top-association', group: opts.group })
            return null
          })
        if (current !== token)
          return

        const top = selectTopAssociations((response?.rows ?? []) as unknown as Record<string, unknown>[], {
          groupField: opts.group,
          topField: topDimension,
        })
        for (const key of missing) {
          const value = top.get(key) ?? null
          // An operator string is not a ranking, so it must never be offered as
          // a page's top keyword.
          cached.set(key, topDimension === 'query' ? operatorFreeKeyword(value) : value)
        }
      }
      const next = new Map<string, string>()
      for (const k of keys) {
        const v = cached.get(k)
        if (v)
          next.set(k, v)
      }
      map.value = next
      pending.value = false
    },
    { immediate: true, deep: true },
  )

  return { map, pending }
}
