import { eq } from 'drizzle-orm'
import { users } from '~~/layers/core/server/db/schema'
import { sendEmail } from '~~/layers/core/server/utils/email'
import { defineJob } from '../_types'

const WelcomeEmail = `Thanks for trying out Request Indexing.

Here's the deal: You're one of the first to try it out, and I'm excited to have you on board. However, it's early days, and I'm still actively working on the project to make it the best it can be.

I'd love to hear your thoughts on how I can make Request Indexing better for you. If you need any help, have any feedback or feature requests hit reply and let me know.

P.s. You can find the source code for Request Indexing on GitHub: https://github.com/harlan-zw/requestindexing.com. Feel free to open an issue or a PR.

Cheers
Harlan`

export default defineJob({
  name: 'users/send-welcome-email',
  queue: 'default',
  async handle(payload, ctx) {
    // Kill switch: NUXT_NOTIFICATIONS_ENABLED=false holds the welcome email
    // back while legacy data is migrated. `sendEmail` does not check it,
    // because the Free allowance email must always send.
    if (!useRuntimeConfig().notificationsEnabled)
      return

    const { userId } = payload

    const user = await ctx.db.query.users.findFirst({
      where: eq(users.userId, userId),
    })

    if (!user)
      return

    await sendEmail({
      to: user.email,
      bcc: 'harlan@harlanzw.com',
      subject: 'Welcome to Request Indexing',
      textBody: WelcomeEmail,
    })
  },
})
