import type { CompareMode } from '../composables/useGscPeriod'

// Aligning a comparison overlay means pairing each current-period day with its
// counterpart in the compare window. The right counterpart depends on the
// compare mode:
//   - 'previous' → the SAME ordinal day of the preceding window, i.e. a fixed
//     whole-day offset back (period length). Calendar-day matching is wrong here
//     (the prev window is days, not a year, away).
//   - 'year' → the SAME calendar day one year earlier (Feb 15 → Feb 15), which a
//     fixed day offset can't express exactly across a leap boundary.
// Deriving the offset from the WINDOW DEFINITION (not the data) keeps alignment
// correct even when the compare window's most recent day has no rows.

const DAY_MS = 86_400_000

export function toUtcDay(s: string): number {
  const [y = 0, m = 1, d = 1] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function fromUtcDay(ms: number): string {
  const dt = new Date(ms)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/** Maps a current ISO date (`YYYY-MM-DD`) to its compare-period counterpart. */
export type CompareAligner = (currentDate: string) => string

/** Same calendar day one year earlier — exact for year-over-year (no leap drift). */
export function calendarYearAligner(): CompareAligner {
  return (date) => {
    const [y, m, d] = date.split('-')
    return `${Number(y) - 1}-${m}-${d}`
  }
}

/** Fixed whole-day shift back — correct for the immediately-preceding period. */
export function offsetAligner(offsetDays: number): CompareAligner {
  return date => fromUtcDay(toUtcDay(date) - offsetDays * DAY_MS)
}

/**
 * Pick the aligner for a compare mode. `'year'` uses calendar matching;
 * everything else uses the fixed `offsetDays`. Returns `null` when there is no
 * usable strategy (no comparison, or `'previous'` with an unknown offset), in
 * which case `alignPrev` leaves rows un-paired.
 */
export function resolveCompareAligner(mode: CompareMode | undefined, offsetDays: number | null): CompareAligner | null {
  if (mode === 'year')
    return calendarYearAligner()
  if (offsetDays != null)
    return offsetAligner(offsetDays)
  return null
}

/**
 * Fallback offset when no window definition is available: anchor on the most
 * recent day of each series (most likely populated; `stableData` lands the end
 * on a complete day). Less robust than the window-derived offset — a compare
 * window whose last day has no rows skews it — so prefer `computeCompareOffsetDays`.
 */
export function anchorOffsetDays(current: { date: string }[], prev: { date: string }[]): number | null {
  const lastCur = current.at(-1)
  const lastPrev = prev.at(-1)
  if (!lastCur || !lastPrev)
    return null
  return Math.round((toUtcDay(lastCur.date) - toUtcDay(lastPrev.date)) / DAY_MS)
}

/**
 * Merge prev rows onto current rows by date, using `aligner` to find each
 * current day's counterpart. A current day with no matching prev row is left
 * un-paired (the overlay simply has no point there — correct for gaps).
 */
export function alignPrev<C extends { date: string }, P extends { date: string }>(
  current: C[],
  prev: P[] | null | undefined,
  aligner: CompareAligner | null,
): Array<C & { prev?: P }> {
  if (!current.length)
    return []
  if (!prev?.length || !aligner)
    return current.slice()
  const byDate = new Map<string, P>()
  for (const row of prev) byDate.set(row.date, row)
  return current.map((row) => {
    const match = byDate.get(aligner(row.date))
    return match ? { ...row, prev: match } : row
  })
}
