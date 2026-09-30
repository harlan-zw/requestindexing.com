import { z } from 'zod'

// §8.B — the sitemap-liveness signal. The ONLY first-class health input that
// actively probes the sitemap file for reachability rather than trusting GSC /
// gscdump's last-good cache (which serves stale URLs while the live sitemap is
// dead — the unhead incident). Cross-engine by construction: probing
// `/sitemap.xml` is not Google-specific, so this carries NO engine field
// ([[ADR-0084]] — the contract is computed, engine added only when real).

/** Probe outcome for a single sitemap URL. */
export const sitemapLivenessStatusSchema = z.enum(['reachable', 'timeout', 'error'])
export type SitemapLivenessStatus = z.infer<typeof sitemapLivenessStatusSchema>

export const sitemapLivenessSchema = z.object({
  /** Live-probe verdict. `timeout` = the 15s probe aborted; `error` = non-2xx / network. */
  status: sitemapLivenessStatusSchema,
  /** HTTP status when a response came back; null on timeout / network error. */
  statusCode: z.number().nullable(),
  /** Wall-clock of the probe (ms) — surfaces "timing out (>30s)" style evidence. */
  durationMs: z.number(),
  /** ISO timestamp the probe ran (drives "checked just now" / freshness). */
  checkedAt: z.string(),
  /**
   * The sitemap the verdict is about, after redirects. Absent when no request
   * left, and on a response cached before the field existed.
   */
  url: z.string().optional(),
  /** URLs parsed from a reachable, valid sitemap. Absent on timeout / error / unparsable. */
  urlCount: z.number().optional(),
  /** Non-fatal validator warnings (e.g. internal routes in sitemap). */
  warnings: z.array(z.string()).optional(),
  /**
   * Content-validation errors from the shared sitemap validator (invalid lastmod
   * format, missing namespace, duplicate URLs, over-limit). Distinct from `status`:
   * the sitemap is reachable, its CONTENT is what Google will choke on.
   */
  validationErrors: z.array(z.string()).optional(),
  /**
   * The subset of `validationErrors` that make Google reject the sitemap or skip
   * its URLs (malformed XML, missing namespace, over-limit, nested index) — the
   * "does Google care" gate. Advisory errors (invalid lastmod, duplicate URLs) are
   * excluded. The `indexing.sitemap_content_error` timeline episode fires on this.
   */
  criticalValidationErrors: z.array(z.string()).optional(),
})

export type SitemapLiveness = z.infer<typeof sitemapLivenessSchema>

// §5.5 — the multi-site sitemap-liveness ROLLUP (VISION-6). An agency must see
// "which sites have a dead sitemap" across the whole fleet WITHOUT visiting each
// (15s × N live probes is a non-starter). So this reads the PERSISTED Timeline
// episodes the background indexing listener already writes, not a live probe:
//   - a site is `unreachable` when it has an OPEN `indexing.sitemap_unreachable`
//     episode (a `timeline_entries` row with that kind + `endedAt IS NULL`).
//   - `errors` mirrors OPEN `indexing.sitemap_error` (GSC-reported parse errors)
//     — the softer state.
// Each array is the set of the caller's team site UUIDs (`sites.id` = the
// episode `scopeId`) currently in that state. A site may appear in both.
export const sitemapLivenessRollupSchema = z.object({
  /** Team site UUIDs with an OPEN `indexing.sitemap_unreachable` episode. */
  unreachable: z.array(z.string()),
  /** Team site UUIDs with an OPEN `indexing.sitemap_error` episode. */
  errors: z.array(z.string()),
})

export type SitemapLivenessRollup = z.infer<typeof sitemapLivenessRollupSchema>
