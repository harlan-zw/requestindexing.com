import { z } from 'zod'

// Wire contract for the indexing cohort comparison. Mirrors the pure model in
// `shared/index-cohorts.ts` as a discriminated union rather than a flat payload
// with nullable fields, so a consumer cannot render `cells` without also having
// the `baseline` and `coverage` that make those cells interpretable.

export const indexCohortDimensionSchema = z.enum(['section', 'lifecycle'])

export const indexCohortCellSchema = z.object({
  dimension: indexCohortDimensionSchema,
  key: z.string(),
  label: z.string(),
  pathPrefix: z.string().nullable(),
  total: z.number(),
  notIndexed: z.number(),
  rate: z.number(),
  complementRate: z.number(),
  complementTotal: z.number(),
  ciLower: z.number(),
  ciUpper: z.number(),
  overlapNotIndexed: z.number(),
})

export const indexCohortBaselineSchema = z.object({
  total: z.number(),
  notIndexed: z.number(),
  rate: z.number(),
})

/**
 * Every count that did NOT make it into `analysed`. Required, not optional:
 * ADR-0105 forbids a partial join reading as a census, and the only way to
 * guarantee the UI can say so is to make the numbers impossible to omit.
 */
export const indexCohortCoverageSchema = z.object({
  analysed: z.number(),
  excludedFragments: z.number(),
  notCrawled: z.number(),
})

export const indexCohortsResponseSchema = z.discriminatedUnion('_tag', [
  z.object({
    _tag: z.literal('no-evidence'),
    crawlSettingsId: z.number().nullable(),
    asOf: z.string().nullable(),
    reason: z.enum(['no-inspection-join', 'no-completed-crawl', 'sampled-index-state']),
    /** Set only for `sampled-index-state`: the enumerated and reported not-indexed counts. */
    sample: z.object({ enumerated: z.number(), reported: z.number() }).nullable(),
  }),
  z.object({
    _tag: z.literal('uniform'),
    crawlSettingsId: z.number().nullable(),
    asOf: z.string().nullable(),
    baseline: indexCohortBaselineSchema,
    coverage: indexCohortCoverageSchema,
    z: z.number(),
    tested: z.number(),
  }),
  z.object({
    _tag: z.literal('outliers'),
    crawlSettingsId: z.number().nullable(),
    asOf: z.string().nullable(),
    baseline: indexCohortBaselineSchema,
    coverage: indexCohortCoverageSchema,
    z: z.number(),
    tested: z.number(),
    cells: z.array(indexCohortCellSchema),
  }),
])

export type IndexCohortCell = z.infer<typeof indexCohortCellSchema>
export type IndexCohortsResponse = z.infer<typeof indexCohortsResponseSchema>

/**
 * Input fields for the `indexing_cohorts` MCP tool, shared so UI eject payloads
 * are typed by the same schema the server parses (ADR-0031). The server tool
 * adds `siteUrl: siteUrlSchema` (a server util) on top of these.
 *
 * `minSectionPages` defaults to 5 rather than 1 on purpose: the ranking is
 * sorted by rate, and a one-page section that happens to be not indexed scores
 * 100%, so a floor of 1 fills the whole head of the list with single pages and
 * buries every family worth acting on.
 */
export const indexCohortsToolFields = {
  limit: z.number().int().min(1).max(50).default(12).describe('Max route families in the ranked list. Default 12.'),
  minSectionPages: z.number().int().min(1).max(500).default(5).describe('Ignore route families holding fewer than this many crawled pages. Default 5 — below that a single not-indexed page reads as a 100% failure rate.'),
}

export const indexCohortsToolInputSchema = z.object(indexCohortsToolFields)

/** Args shape for an `indexing_cohorts` eject payload (client-side). */
export type IndexCohortsEjectArgs = z.input<typeof indexCohortsToolInputSchema> & { siteUrl?: string }
