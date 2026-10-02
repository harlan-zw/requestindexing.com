import { stringify } from 'devalue'
import { logWarn } from '~~/shared/logging'

// Every `/_ws` socket lives in one Durable Object. Nitro's `cloudflare-durable`
// preset fixes its binding and instance names in
// `nitropack/dist/presets/cloudflare/runtime/cloudflare-durable.mjs`.
const DURABLE_BINDING = '$DurableObject'
const DURABLE_INSTANCE = 'server'

// The part of the binding this module calls. `publish` is an RPC method on
// Nitro's Durable Object class, which `patches/nitropack@2.13.4.patch` changes
// to read each socket's topics from its attachment.
interface SocketNamespace {
  idFromName: (name: string) => unknown
  get: (id: unknown) => { publish: (topic: string, data: string) => Promise<void> }
}

/** The topic every `/_ws` socket of one signed-in user subscribes to. */
export function userTopic(userPublicId: string): string {
  return `user:${userPublicId}`
}

/**
 * Send an event to every open `/_ws` socket of one user.
 *
 * The caller is usually a queue job, which runs in another isolate. Only the
 * Durable Object holds the sockets, so the event goes to it over RPC.
 *
 * A lost event costs the user one dashboard refresh, so a failure is logged
 * and never fails the job.
 */
export async function broadcastToUser(env: Record<string, unknown>, userPublicId: string, event: Record<string, unknown>): Promise<void> {
  async function publish(): Promise<void> {
    const namespace = env[DURABLE_BINDING] as SocketNamespace | undefined
    if (!namespace)
      throw new Error(`The Durable Object binding "${DURABLE_BINDING}" is missing.`)
    await namespace.get(namespace.idFromName(DURABLE_INSTANCE)).publish(userTopic(userPublicId), stringify(event))
  }
  await publish().catch(error => logWarn('realtime.publish_failed', error, { userPublicId, event: event.name }))
}
