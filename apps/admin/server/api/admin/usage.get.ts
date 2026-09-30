export default defineEventHandler(async (e) => {
  await requireAdminAuth(e)
  const pool = createOAuthPool()
  return {
    // TODO(v1): re-wire metrics once the new metrics store is in place.
    signups: 0,
    webIndexingApi: await pool.usage(),
  }
})
