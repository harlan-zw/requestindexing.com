import { stringify } from 'devalue'
import { eq } from 'drizzle-orm'
import { users } from '~~/layers/core/server/db/schema'

// One unsubscribe per open connection. Keyed by peer, so two tabs of the same
// user do not overwrite each other's subscription.
const unsubscribers = new Map<string, () => void>()

export default defineWebSocketHandler({
  // Refuse the upgrade without a signed-in user. `requireUserSession` cannot:
  // an upgrade request is not an H3Event, so h3 refuses to start a session for
  // it and throws a plain Error before nuxt-auth-utils reaches its 401. crossws
  // ends the upgrade only on a Response, so that Error surfaced as a 500.
  // crossws sets `context` before this hook runs, but its type marks it optional.
  async upgrade(request) {
    const session = await getUserSession({ headers: request.headers, context: request.context ?? {} })
      // h3 throws only when it has no session to read: no cookie, or one that
      // failed to unseal. Both mean nobody is signed in, which the 401 says.
      .catch(() => null)
    if (!session?.user)
      return new Response('Unauthorized', { status: 401 })
  },

  async open(peer) {
    // The subscriber is the session's user. The client still sends `?userId=`,
    // and it is ignored: trusting it let anyone read another user's events.
    const session = await getUserSession(peer)
    const user = session.user
      ? await useDrizzle().query.users.findFirst({ where: eq(users.userId, session.user.id) })
      : undefined
    if (!user) {
      peer.close(4401, 'Unauthorized')
      return
    }

    const nitro = useNitroApp()
    const hook = nitro.hooks.hook as unknown as (name: `ws:message:${string}`, callback: (message: unknown) => void) => () => void
    unsubscribers.set(peer.id, hook(`ws:message:${user.publicId}`, (message) => {
      peer.send(stringify(message))
    }))
  },

  // TODO handle client -> server comms if needed
  // message(peer, message) {
  //
  // },

  close(peer) {
    unsubscribers.get(peer.id)?.()
    unsubscribers.delete(peer.id)
  },
})
