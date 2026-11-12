import type { SQL, SQLWrapper } from 'drizzle-orm'
import type { AdminCtx, AdminListQuery } from '../admin-shell'
import { and, asc, count, desc, eq, inArray, isNotNull, like, or } from 'drizzle-orm'
import { getUserDisplayMetaMap } from '../../../../pro-saas-auth/server/utils/auth/identity'
import { feedback } from '../../database/_surface'
import { defineAdminResource } from '../admin-shell'

interface FeedbackRow {
  id: number
  path: string
  thumb: 'up' | 'down' | null
  comment: string | null
  createdAt: Date | null
  userId: number | null
}

const sortableMap: Record<string, SQLWrapper> = {
  path: feedback.path,
  thumb: feedback.thumb,
  createdAt: feedback.createdAt,
}

export default defineAdminResource<FeedbackRow>({
  key: 'feedback',
  label: 'Feedback',
  singular: 'Feedback',
  icon: 'i-lucide-message-square-quote',
  group: 'Pro features',
  perPage: 25,
  fields: [
    { type: 'text', key: 'path', label: 'Path', sortable: true, searchable: true },
    {
      type: 'badge',
      key: 'thumb',
      label: 'Sentiment',
      sortable: true,
      badgeMap: { up: 'success', down: 'error' },
    },
    { type: 'text', key: 'comment', label: 'Comment', searchable: true },
    {
      type: 'belongsTo',
      key: 'userId',
      label: 'User',
      belongsTo: { resource: 'users', labelKey: 'name' },
    },
    { type: 'datetime', key: 'createdAt', label: 'Submitted', sortable: true },
  ],
  cards: [
    {
      key: 'total',
      type: 'metric',
      label: 'Total feedback',
      load: async ({ db }) => {
        const result = await db.select({ n: count() }).from(feedback)
        return { value: result[0]?.n ?? 0 }
      },
    },
    {
      key: 'positive',
      type: 'metric',
      label: 'Positive (thumbs up)',
      load: async ({ db }) => {
        const result = await db
          .select({ n: count() })
          .from(feedback)
          .where(eq(feedback.thumb, 'up'))
        return { value: result[0]?.n ?? 0 }
      },
    },
    {
      key: 'negative',
      type: 'metric',
      label: 'Negative (thumbs down)',
      load: async ({ db }) => {
        const result = await db
          .select({ n: count() })
          .from(feedback)
          .where(eq(feedback.thumb, 'down'))
        return { value: result[0]?.n ?? 0 }
      },
    },
  ],
  actions: [
    {
      key: 'destroy',
      label: 'Delete',
      variant: 'danger',
      batch: true,
      confirm: {
        title: 'Delete feedback?',
        body: 'This permanently removes the selected feedback entries.',
        confirmText: 'Delete',
      },
      handler: async ({ db }, rows) => {
        const ids = rows.map((r: FeedbackRow) => r.id)
        if (!ids.length)
          return
        await db.delete(feedback).where(inArray(feedback.feedbackId, ids))
        return { message: `Deleted ${ids.length} feedback entr${ids.length === 1 ? 'y' : 'ies'}` }
      },
    },
  ],
  index: async ({ db }: AdminCtx, q: AdminListQuery) => {
    const page = q.page ?? 1
    const perPage = q.perPage ?? 25
    const offset = (page - 1) * perPage

    const filters: SQL[] = [isNotNull(feedback.comment)]
    if (q.search) {
      const searchFilter = or(like(feedback.comment, `%${q.search}%`), like(feedback.path, `%${q.search}%`))
      if (searchFilter)
        filters.push(searchFilter)
    }
    const whereExpr = and(...filters)

    const orderCol = q.sort ? sortableMap[q.sort.key] : feedback.createdAt
    const order = q.sort?.dir === 'asc' ? asc(orderCol ?? feedback.createdAt) : desc(orderCol ?? feedback.createdAt)

    const [rows, totalRows] = await Promise.all([
      db.select({
        id: feedback.feedbackId,
        path: feedback.path,
        thumb: feedback.thumb,
        comment: feedback.comment,
        createdAt: feedback.createdAt,
        userId: feedback.userId,
      })
        .from(feedback)
        .where(whereExpr)
        .orderBy(order)
        .limit(perPage)
        .offset(offset),
      db.select({ n: count() }).from(feedback).where(whereExpr),
    ])
    const total = totalRows[0]?.n ?? 0

    const userIds = [...new Set(rows.map(r => r.userId).filter((id): id is number => id !== null))]
    const meta = await getUserDisplayMetaMap(db, userIds)
    const userRels: Record<string, Record<string, unknown>> = {}
    for (const id of userIds) {
      const m = meta.get(id)
      if (m)
        userRels[id] = { id, name: m.name, email: m.email, avatarUrl: m.avatarUrl }
    }

    return {
      rows,
      total: total ?? 0,
      relations: { users: userRels },
    }
  },
  show: async ({ db }, id) => {
    const [row] = await db.select().from(feedback).where(eq(feedback.feedbackId, Number(id))).limit(1)
    return (row as FeedbackRow | undefined) ?? null
  },
  destroy: async ({ db }, id) => {
    await db.delete(feedback).where(eq(feedback.feedbackId, Number(id)))
  },
})
