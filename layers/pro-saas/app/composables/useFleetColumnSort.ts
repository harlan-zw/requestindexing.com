import { computed, ref } from 'vue'

/**
 * Column sort for a fleet "By site" table. Ported from nuxtseo.com's
 * `useOverviewColumnSort`.
 *
 * Clicking a metric header cycles default direction, then reversed, then off.
 * A Site missing a value sorts last in either direction.
 */
export function useFleetColumnSort<Key extends string>(
  getValue: (siteId: string, key: Key) => number | null,
  defaultDir: (key: Key) => 'asc' | 'desc' = () => 'desc',
) {
  const sortKey = ref<Key | null>(null)
  const sortDir = ref<'asc' | 'desc'>('desc')

  function toggleSort(key: Key) {
    if (sortKey.value !== key) {
      sortKey.value = key
      sortDir.value = defaultDir(key)
    }
    else if (sortDir.value === defaultDir(key)) {
      sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
    }
    else {
      sortKey.value = null
    }
  }

  const sortComparator = computed(() => {
    const key = sortKey.value
    if (!key)
      return null
    const dir = sortDir.value === 'asc' ? 1 : -1
    return (a: { id: string }, b: { id: string }) => {
      const av = getValue(a.id, key)
      const bv = getValue(b.id, key)
      if (av == null && bv == null)
        return 0
      if (av == null)
        return 1
      if (bv == null)
        return -1
      return (av - bv) * dir
    }
  })

  return { sortKey, sortDir, toggleSort, sortComparator }
}
