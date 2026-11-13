// Crawl-quality-budget synthesis (Indexing Recovery Engine T3.3).
//
// A read-time synthesis that frames the whole engine in one line: of the pages
// Google spends crawl budget on, how many EARN it (are indexed / draw impressions)
// vs how many SPEND it without earning (near-duplicate template inventory). It
// composes the Tier-1 clusters (T1.2 scorecards), the indexed proxy, and the
// render-parity signal (T3.5) into the verb'd deep-link strip
// ("Crawl budget: 184 of 1,240 earning; 612 near-duplicate spending it").
//
// Pure: the Sprint-context layer feeds it the already-computed signals. No `engine`
// discriminant anywhere (ADR-0084).

export interface QualityBudgetInput {
  /** Pages the crawl reached (the budget denominator we can see). */
  totalCrawled: number
  /** Pages earning impressions (indexed proxy) — a lower bound on indexed. */
  earning: number
  /** Near-duplicate cluster sizes (T1.2) — the pages spending budget without earning. */
  clusterSizes: number[]
  /** Pages whose content only appears after JS render (render parity below threshold, T3.5). */
  lowParityPages?: number
}

export interface QualityBudget {
  totalCrawled: number
  earning: number
  /** Pages in near-duplicate clusters (deduped against double counting across clusters is the caller's job). */
  nearDuplicate: number
  lowParity: number
  /** One verb'd summary line for the deep-link strip. */
  summary: string
  /** Whether there is enough signal to show the strip (avoids a misleading 0/0). */
  hasSignal: boolean
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en').format(Math.max(0, Math.round(n)))
}

/**
 * Synthesise the crawl-quality budget. `earning` and `nearDuplicate` are clamped
 * to `totalCrawled` so the strip never reads more-than-100%. Returns `hasSignal:
 * false` when there is nothing meaningful to show (no crawl, or no quality signal),
 * so the caller can hide the strip instead of rendering "0 of 0".
 */
export function buildQualityBudget(input: QualityBudgetInput): QualityBudget {
  const totalCrawled = Math.max(0, input.totalCrawled)
  const earning = Math.max(0, Math.min(input.earning, totalCrawled))
  const nearDuplicate = Math.max(0, Math.min(input.clusterSizes.reduce((a, n) => a + Math.max(0, n), 0), totalCrawled))
  const lowParity = Math.max(0, Math.min(input.lowParityPages ?? 0, totalCrawled))

  const clauses: string[] = []
  if (totalCrawled > 0)
    clauses.push(`${fmt(earning)} of ${fmt(totalCrawled)} earning`)
  if (nearDuplicate > 0)
    clauses.push(`${fmt(nearDuplicate)} near-duplicate spending it`)
  if (lowParity > 0)
    clauses.push(`${fmt(lowParity)} render only after JavaScript`)

  return {
    totalCrawled,
    earning,
    nearDuplicate,
    lowParity,
    summary: clauses.length ? `Crawl budget: ${clauses.join('; ')}.` : 'Crawl budget: no coverage yet.',
    hasSignal: totalCrawled > 0 && (nearDuplicate > 0 || lowParity > 0 || earning < totalCrawled),
  }
}
