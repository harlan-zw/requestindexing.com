import { defineCheck, fail, pass, unavailable, warn } from '@harlan-zw/nuxt-checkin/server'
import { resolveCloudflareBindings } from '@harlan-zw/nuxt-cloudflare/bindings'

const ADMIN_FEEDBACK_URL = 'https://requestindexing.com/admin/feedback'

interface FeedbackCountsRow {
  count?: unknown
  oldest_created_at?: unknown
  tool_thumbs_down?: unknown
  tool_thumbs_up?: unknown
}

interface D1Binding {
  prepare: (statement: string) => {
    first: () => Promise<FeedbackCountsRow | null>
  }
}

const ANONYMOUS_THUMBS_PREDICATE = 'comment IS NULL AND user_id IS NULL AND COALESCE(json_extract(metadata, \'$.source\'), \'\') IN (\'tool-feedback\', \'site-feedback\')'

const FEEDBACK_TRIAGE_SQL = [
  'SELECT',
  `  COALESCE(SUM(CASE WHEN NOT (${ANONYMOUS_THUMBS_PREDICATE}) THEN 1 ELSE 0 END), 0) AS count,`,
  `  MIN(CASE WHEN NOT (${ANONYMOUS_THUMBS_PREDICATE}) THEN created_at END) AS oldest_created_at,`,
  `  COALESCE(SUM(CASE WHEN (${ANONYMOUS_THUMBS_PREDICATE}) AND thumb = 'down' THEN 1 ELSE 0 END), 0) AS tool_thumbs_down,`,
  `  COALESCE(SUM(CASE WHEN (${ANONYMOUS_THUMBS_PREDICATE}) AND thumb = 'up' THEN 1 ELSE 0 END), 0) AS tool_thumbs_up`,
  'FROM feedback',
  'WHERE status = \'new\'',
].join(' ')

function parseNonNegativeCount(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}

export default defineCheck({
  id: 'request-indexing.feedback',
  async run({ event, collect }) {
    const env = event ? resolveCloudflareBindings<{ DB?: D1Binding }>(event) : undefined
    const db = env?.DB
    if (typeof db?.prepare !== 'function')
      return unavailable('D1 binding is unavailable.')

    let row: FeedbackCountsRow | null
    try {
      row = await collect(db, 'cloudflare.d1-feedback', async () => {
        const result = await db.prepare(FEEDBACK_TRIAGE_SQL).first()
        return { value: result, metrics: { requests: 1 } }
      })
    }
    catch (error) {
      return fail(`The feedback triage query failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    if (!row)
      return fail('The feedback triage query returned no row.')

    const newCount = parseNonNegativeCount(row.count)
    const toolThumbsDown = parseNonNegativeCount(row.tool_thumbs_down)
    const toolThumbsUp = parseNonNegativeCount(row.tool_thumbs_up)
    if (newCount === null || toolThumbsDown === null || toolThumbsUp === null)
      return fail('The feedback triage query returned an invalid count.')

    if (newCount > 0) {
      const oldestCreatedAt = typeof row?.oldest_created_at === 'number' && Number.isFinite(row.oldest_created_at)
        ? new Date(row.oldest_created_at * 1000).toISOString()
        : null
      return warn(
        `${newCount} untriaged feedback ${newCount === 1 ? 'report awaits' : 'reports await'} review.`,
        { newCount, oldestCreatedAt, toolThumbsDown, toolThumbsUp, adminUrl: ADMIN_FEEDBACK_URL },
      )
    }

    return pass({ newCount: 0, toolThumbsDown, toolThumbsUp })
  },
})
