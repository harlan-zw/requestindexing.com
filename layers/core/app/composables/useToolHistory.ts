import { useLocalStorage } from '@vueuse/core'

export interface ToolHistoryItem {
  id: string
  query: string
  tool: string
  createdAt: string
}

export function parseToolHistory(raw: string, max = 8, expectedTool?: string): ToolHistoryItem[] {
  if (!raw)
    return []

  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value))
      return []

    const result: ToolHistoryItem[] = []
    const seenQueries = new Set<string>()
    const limit = Number.isFinite(max) ? Math.max(0, Math.floor(max)) : 8
    if (limit === 0)
      return []
    for (const item of value) {
      if (!item || typeof item !== 'object')
        continue
      const candidate = item as Partial<ToolHistoryItem>
      const valid = typeof candidate.id === 'string'
        && candidate.id.trim().length > 0
        && typeof candidate.query === 'string'
        && candidate.query.trim().length > 0
        && typeof candidate.tool === 'string'
        && candidate.tool.trim().length > 0
        && (!expectedTool || candidate.tool === expectedTool)
        && typeof candidate.createdAt === 'string'
        && Number.isFinite(Date.parse(candidate.createdAt))
      if (!valid || seenQueries.has(candidate.query!))
        continue
      seenQueries.add(candidate.query!)
      result.push(candidate as ToolHistoryItem)
      if (result.length >= limit)
        break
    }
    return result
  }
  catch {
    return []
  }
}

function nextId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function useToolHistory(tool: string, max = 8) {
  const history = useLocalStorage<ToolHistoryItem[]>(`ri-tool-history:${tool}`, [], {
    initOnMounted: true,
    serializer: {
      read: raw => parseToolHistory(raw, max, tool),
      write: v => JSON.stringify(v),
    },
  })

  function push(query: string) {
    const q = query.trim()
    if (!q)
      return
    const existing = history.value.filter(item => item.query !== q)
    history.value = [
      { id: nextId(), tool, query: q, createdAt: new Date().toISOString() },
      ...existing,
    ].slice(0, max)
  }

  function clear() {
    history.value = []
  }

  return { history, push, clear }
}
