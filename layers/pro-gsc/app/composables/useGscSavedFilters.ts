import { useStorage } from '@vueuse/core'

/**
 * A persisted GSC table filter snapshot: search text, active preset and the
 * country and device facets. Saved filters are global rather than per site: the
 * facets they capture are generic and reusable across every site's tables.
 */
export interface GscSavedFilter {
  id: string
  label: string
  q: string
  filter: string
  country: string
  device: string
  googleBrand?: string
}

/**
 * Saved filters for the GSC table shell, backed by localStorage. Presentational
 * components stay pure, so this composable owns persistence.
 */
export function useGscSavedFilters() {
  const saved = useStorage<GscSavedFilter[]>('pro-gsc:saved-filters', [])

  function add(item: Omit<GscSavedFilter, 'id'>) {
    saved.value = [...saved.value, { ...item, id: crypto.randomUUID() }]
  }

  function remove(id: string) {
    saved.value = saved.value.filter(s => s.id !== id)
  }

  return { saved, add, remove }
}
