export interface PrefetchChunk {
  src?: string
  imports?: string[]
  prefetch?: boolean
}

export function disableDeferredPrefetch(manifest: Record<string, PrefetchChunk>, source: string): void {
  const entries = Object.entries(manifest)
    .filter(([id, chunk]) => id === source || chunk.src === source || chunk.src?.endsWith(`/${source}`))
    .map(([id]) => id)
  if (!entries.length)
    throw new Error(`Deferred entry is missing: ${source}`)

  const visited = new Set<string>()
  const pending = [...entries]
  while (pending.length) {
    const id = pending.pop()!
    if (visited.has(id))
      continue
    visited.add(id)
    const chunk = manifest[id]
    if (!chunk)
      throw new Error(`Deferred dependency is missing: ${id}`)
    // Keep navigation preloads. Only speculative downloads leave the graph.
    chunk.prefetch = false
    pending.push(...chunk.imports ?? [])
  }
}
