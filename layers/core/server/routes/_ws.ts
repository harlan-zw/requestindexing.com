import { eq } from 'drizzle-orm'
import { defineWebSocketHandler } from 'nitro/h3'
import { users } from '~~/layers/core/server/db/schema'
import { userTopic } from '~~/layers/core/server/utils/realtime'

export default defineWebSocketHandler({
  async upgrade(request) {
    const session = await getUserSession(request)
    if (!session.user)
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
