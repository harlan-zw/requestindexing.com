import { defineEventHandler, getQuery, setResponseHeader, setResponseStatus } from 'h3'
import { parseUnsubscribeAction, renderUnsubscribePage } from '../utils/unsubscribe-page'
import { parseUnsubscribeToken } from '../utils/unsubscribe-token'

// The link in an email footer. A GET only renders a confirmation form: mail
// scanners follow links, so only the signed POST changes the preference.
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = typeof query.token === 'string' ? query.token : ''
  const parsed = await parseUnsubscribeToken(token, { secret: useRuntimeConfig(event).session.password, now: new Date() })

  setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'no-store')

  if (parsed._tag === 'Err') {
    setResponseStatus(event, 400)
    return renderUnsubscribePage({ _tag: 'Invalid' })
  }
  return renderUnsubscribePage({ _tag: 'Confirm', action: parseUnsubscribeAction(query.action), email: parsed.claim.email, token })
})
