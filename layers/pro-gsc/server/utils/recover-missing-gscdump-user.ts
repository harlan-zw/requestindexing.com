export type MissingGscdumpUserRecovery
  = | { _tag: 'NotMissing' }
    | { _tag: 'Recovered', userId: string, apiKey: string }
    | { _tag: 'Failed', error: unknown }

/** A missing engine user needs a new identity, not a key for the old identity. */
export async function recoverMissingGscdumpUser(
  updateError: unknown,
  register: () => Promise<{ userId: string, apiKey?: string }>,
): Promise<MissingGscdumpUserRecovery> {
  if (typeof updateError !== 'object' || updateError === null)
    return { _tag: 'NotMissing' }
  const error = updateError as Record<string, unknown>
  const status = error.statusCode ?? error.status
  const data = error.data
  if (status !== 404 || typeof data !== 'object' || data === null || !('code' in data) || data.code !== 'user_not_found')
    return { _tag: 'NotMissing' }

  return register()
    .then(({ userId, apiKey }): MissingGscdumpUserRecovery => apiKey
      ? { _tag: 'Recovered', userId, apiKey }
      : { _tag: 'Failed', error: new Error('gscdump registration returned no API key') })
    .catch((error: unknown): MissingGscdumpUserRecovery => ({ _tag: 'Failed', error }))
}
