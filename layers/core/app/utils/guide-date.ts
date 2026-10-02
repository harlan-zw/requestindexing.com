// A guide's `publishedAt` and `updatedAt` are calendar days, such as "2026-03-04".
// `new Date()` reads that string as UTC midnight. In the runtime's own zone, that
// instant falls on the previous day anywhere west of UTC. The Worker renders in
// UTC, so a browser in the Americas then hydrates a different date and Vue reports
// a mismatch. Formatting in UTC with a fixed locale gives one result everywhere.
const guideDateFormat = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })

export function formatGuideDate(day: string | undefined): string {
  if (!day)
    return ''
  const date = new Date(day)
  return Number.isNaN(date.getTime()) ? '' : guideDateFormat.format(date)
}
