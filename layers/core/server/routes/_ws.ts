import { eq } from 'drizzle-orm'
import { users } from '~~/layers/core/server/db/schema'
import { userTopic } from '~~/layers/core/server/utils/realtime'

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

    // The socket lives in a Durable Object that hibernates when idle, which
    // wipes this module's memory and keeps the socket open. crossws writes the
    // topic into the socket's attachment, which survives hibernation. Cloudflare
    // drops the attachment when the socket closes.
    peer.subscribe(userTopic(user.publicId))
  },
})
