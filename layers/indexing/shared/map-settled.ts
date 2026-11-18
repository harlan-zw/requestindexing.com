/**
 * `map` with at most `limit` calls in flight. Each call settles on its own: a
 * rejected call becomes `onError(item, error)`, so one failure never loses the
 * other results.
 *
 * Once `signal` aborts, no new call starts and the result rejects with the
 * signal's reason. Calls already in flight get the same signal and should stop
 * on it. A cancelled caller discards the result, so starting more work only
 * spends requests.
 */
export async function mapSettled<T, R>(
  items: readonly T[],
  options: { limit: number, signal?: AbortSignal },
  run: (item: T, signal: AbortSignal | undefined) => Promise<R>,
  onError: (item: T, error: unknown) => R,
): Promise<R[]> {
  const { limit, signal } = options
  const results: R[] = Array.from({ length: items.length })
  let next = 0
  async function worker() {
    while (next < items.length && !signal?.aborted) {
      const index = next++
      const item = items[index]!
      results[index] = await run(item, signal).catch((error: unknown) => onError(item, error))
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, limit), items.length) }, worker))
  signal?.throwIfAborted()
  return results
}
