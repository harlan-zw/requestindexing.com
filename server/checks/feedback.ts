import { defineCheck, fail, pass, unavailable, warn } from '@harlan-zw/nuxt-checkin/server'
import { resolveCloudflareBindings } from '@harlan-zw/nuxt-cloudflare/bindings'

const ADMIN_FEEDBACK_URL = 'https://requestindexing.com/admin/feedback'

interface D1Binding {
  prepare: (statement: string) => {
    first: () => Promise<{ count?: unknown, oldest_created_at?: unknown } | null>
  }
}

export default defineCheck({
  id: 'request-indexing.feedback',
  async run({ event, collect }) {
    const env = event ? resolveCloudflareBindings<{ DB?: D1Binding }>(event) : undefined
    const db = env?.DB
    if (typeof db?.prepare !== 'function')
      return unavailable('D1 binding is unavailable.')

    let row: { count?: unknown, oldest_created_at?: unknown } | null
    try {
      row = await collect(db, 'cloudflare.d1-feedback', async () => {
        const result = await db.prepare('SELECT COUNT(*) AS count, MIN(created_at) AS oldest_created_at FROM feedback WHERE status = \'new\'').first()
        return { value: result, metrics: { requests: 1 } }
      })
    }
    catch (error) {
      return fail(`The feedback triage query failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    const newCount = typeof row?.count === 'number' ? row.count : Number(row?.count ?? 0)
    if (!Number.isFinite(newCount) || newCount < 0)
      return fail('The feedback triage query returned an invalid count.')

    if (newCount > 0) {
      const oldestCreatedAt = typeof row?.oldest_created_at === 'number' && Number.isFinite(row.oldest_created_at)
        ? new Date(row.oldest_created_at * 1000).toISOString()
        : null
      return warn(
        `${newCount} untriaged feedback ${newCount === 1 ? 'report awaits' : 'reports await'} review.`,
        { newCount, oldestCreatedAt, adminUrl: ADMIN_FEEDBACK_URL },
      )
    }

    return pass({ newCount: 0 })
  },
})
