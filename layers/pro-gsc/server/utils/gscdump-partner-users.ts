// gscdump.com Partner Users API.
//
// Cross-org cleanup calls into gscdump.com's partner endpoints, scoped to user
// records (the teams equivalent lives in gscdump-teams-client.ts).
// gscdump.com queues an `app:user:cleanup-requested` event off DELETE so its
// own purge runs async; this just needs to fire-and-acknowledge.

import type { H3Event } from 'h3'
import { isGscdumpV1Error } from '@gscdump/sdk/v1'
import { createGscdumpPublicV1Client } from './gscdump-origin'

export interface PartnerDeleteResult {
  ok: boolean
  status?: number
  message?: string
}

export async function deletePartnerUser(event: H3Event, gscdumpUserId: string): Promise<PartnerDeleteResult> {
  const config = useRuntimeConfig()
  const apiKey = config.gscdump?.apiKey
  if (!apiKey)
    return { ok: false, message: 'NUXT_GSCDUMP_API_KEY not configured' }

  return createGscdumpPublicV1Client(event)
    .deleteUser({ params: { userId: gscdumpUserId } })
    .then(response => ({ ok: true, message: JSON.stringify(response.data) }))
    .catch((error: unknown) => ({
      ok: false,
      status: isGscdumpV1Error(error) ? error.status : undefined,
      message: error instanceof Error ? error.message : String(error),
    }))
}
