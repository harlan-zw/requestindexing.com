import type { MaybeRefOrGetter } from 'vue'
import { computed, toValue } from 'vue'
import { parseReportingDay } from './formatting'

// Calendar-aware tick planning for time-series charts. Picks tick positions +
// label format based on the span:
//   ≤ 10 days   → every day, "Mon 12"
//   ≤ 35 days   → ~5 evenly-spaced ticks, "Jan 12"
//   ≤ 120 days  → every ~2 weeks (aligned to data), "Jan 12"
//   > 120 days  → first-of-month ticks, "Jan"; year suffix on Jan/first when span spans years
// Extracted from ProGraphGsc / ProGraphAnalytics / GraphIndexing, which had
// identical copies of this logic.

export interface ChartTickPlan {
  indices: number[]
  format: (date: Date, i: number, firstYear: number) => string
}

export interface UseChartTickPlanOptions {
  /** Reactive ISO date strings (one per data point). */
  dates: MaybeRefOrGetter<string[]>
  /** Cap on tick count for long spans (default 14 — thins to ~12 if exceeded). */
  maxTicks?: number
  /**
   * Reactive plot-area width in px (wire `useElementSize` on the chart wrap).
   * The span heuristics assume a desktop-width plot; when a width is known,
   * ticks whose estimated labels would collide are dropped. First and last
   * always stay, so the consumers' inward-anchored edge labels keep marking
   * the window ends. Unknown (0/undefined, e.g. SSR before measurement)
   * keeps the pure span plan.
   */
  width?: MaybeRefOrGetter<number | undefined>
}

// Ticks label reporting-day buckets ("YYYY-MM-DD"), not instants — force UTC so
// the label never drifts with the viewer's timezone (cf. parseReportingDay, ADR-0082).
const weekdayDayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
const monthDayFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })
const monthFmt = new Intl.DateTimeFormat(undefined, { month: 'short', timeZone: 'UTC' })
const monthYearFmt = new Intl.DateTimeFormat(undefined, { month: 'short', year: '2-digit', timeZone: 'UTC' })

// Axis labels render at 11px; ~6.5px per glyph over-estimates the real advance
// slightly, so thinning leaves visible air instead of touching labels.
const LABEL_GLYPH_PX = 6.5
const MIN_LABEL_GAP_PX = 8

/**
 * Greedy left-to-right thinning: a tick survives only when its label clears the
 * previously kept one. Every consumer anchors the first tick inward (start) and
 * the last (end), so those labels claim their full width on the inner side;
 * middle labels claim half a width each side. The final tick always renders;
 * middle ticks yield to it when the two would collide.
 */
function fitTickIndices(
  indices: number[],
  labelWidth: (index: number) => number,
  posOf: (index: number) => number,
): number[] {
  if (indices.length <= 2)
    return indices.slice()
  const fits = (a: number, b: number, aIsFirst: boolean, bIsLast: boolean): boolean => {
    const aRight = posOf(a) + labelWidth(a) / (aIsFirst ? 1 : 2)
    const bLeft = posOf(b) - labelWidth(b) / (bIsLast ? 1 : 2)
    return bLeft - aRight >= MIN_LABEL_GAP_PX
  }
  const kept: number[] = [indices[0]!]
  for (let k = 1; k < indices.length - 1; k++) {
    const idx = indices[k]!
    if (fits(kept.at(-1)!, idx, kept.length === 1, false))
      kept.push(idx)
  }
  const last = indices.at(-1)!
  while (kept.length > 1 && !fits(kept.at(-1)!, last, kept.length === 1, true))
    kept.pop()
  kept.push(last)
  return kept
}

export function useChartTickPlan(opts: UseChartTickPlanOptions) {
  const maxTicks = opts.maxTicks ?? 14

  function spanPlan(dates: string[], len: number): ChartTickPlan {
    if (len <= 1)
      return { indices: [0], format: d => monthDayFmt.format(d) }
    if (len <= 10)
      return { indices: dates.map((_, i) => i), format: d => weekdayDayFmt.format(d) }
    if (len <= 35) {
      const step = Math.max(1, Math.ceil(len / 5))
      const indices: number[] = []
      for (let i = 0; i < len; i += step) indices.push(i)
      if (indices.at(-1) !== len - 1)
        indices.push(len - 1)
      return { indices, format: d => monthDayFmt.format(d) }
    }
    if (len <= 120) {
      // Anchor at index 0 (chart left edge) and step by 14 days. Earlier
      // Monday-snap variant pushed the first tick rightward, leaving the
      // leftmost label visually detached from the data start.
      const indices: number[] = []
      for (let i = 0; i < len; i += 14) indices.push(i)
      return { indices, format: d => monthDayFmt.format(d) }
    }

    // Long span: first-of-month ticks.
    const indices: number[] = []
    let lastMonth = ''
    for (let i = 0; i < len; i++) {
      const m = dates[i]?.slice(0, 7) ?? ''
      if (m !== lastMonth) {
        indices.push(i)
        lastMonth = m
      }
    }
    if (indices.length < 2)
      return { indices: [0, Math.floor(len / 2), len - 1], format: d => monthDayFmt.format(d) }
    // Drop the first tick if the second is within 5 days — happens when the
    // series starts late in a month and the next month's first-of-month tick
    // would render right on top of it.
    if (indices.length > 2 && indices[1]! - indices[0]! < 5)
      indices.shift()

    // Thin out at very long spans so the axis doesn't crowd.
    if (indices.length > maxTicks) {
      const keep = Math.ceil(indices.length / 12)
      return {
        indices: indices.filter((_, i) => i % keep === 0),
        format: (d, i, firstYear) => (d.getUTCMonth() === 0 || i === 0) && d.getUTCFullYear() !== firstYear
          ? monthYearFmt.format(d)
          : monthFmt.format(d),
      }
    }
    return {
      indices,
      format: (d, i, _firstYear) => (d.getUTCMonth() === 0 && i > 0) || (i === 0 && d.getUTCMonth() !== 0 && indices.length > 6)
        ? monthYearFmt.format(d)
        : monthFmt.format(d),
    }
  }

  const tickPlan = computed<ChartTickPlan>(() => {
    const dates = toValue(opts.dates)
    const len = dates.length
    const base = spanPlan(dates, len)

    const width = toValue(opts.width)
    if (!width || width <= 0 || len < 3 || base.indices.length <= 2)
      return base

    // Estimate each label's pixel width from the plan's own formatting so the
    // pass tracks whichever branch ran. `i`/`firstYear` only steer the
    // month-vs-monthYear choice. The pass estimates label widths and never renders them.
    const firstYear = Number(dates[base.indices[0]!]?.slice(0, 4) ?? 0)
    const labelWidth = (idx: number): number => {
      const date = dates[idx]
      if (!date)
        return 0
      const label = base.format(parseReportingDay(date), base.indices.indexOf(idx), firstYear)
      return label.length * LABEL_GLYPH_PX
    }
    const posOf = (idx: number): number => idx / (len - 1) * width
    return { indices: fitTickIndices(base.indices, labelWidth, posOf), format: base.format }
  })

  const firstTickYear = computed(() => {
    const dates = toValue(opts.dates)
    const first = tickPlan.value.indices[0]
    // No ticks → `format` never runs, so a stable sentinel (not a clock read,
    // which would risk an SSR≠client year boundary) is enough.
    if (first == null || !dates[first])
      return 0
    return Number(dates[first]!.slice(0, 4))
  })

  /** Use as Unovis `tickFormat` for an x-axis indexed by row position. */
  function tickFormat(d: number): string {
    const dates = toValue(opts.dates)
    const idx = Math.round(d)
    const date = dates[idx]
    if (!date)
      return ''
    const tickIdx = tickPlan.value.indices.indexOf(idx)
    return tickPlan.value.format(parseReportingDay(date), tickIdx, firstTickYear.value)
  }

  return { tickPlan, firstTickYear, tickFormat }
}
