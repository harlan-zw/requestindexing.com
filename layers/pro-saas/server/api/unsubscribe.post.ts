import { defineEventHandler, getQuery, setResponseHeader } from 'h3'
import { optIn, optOut } from '../utils/email-optouts'
import { parseUnsubscribeAction, renderUnsubscribePage } from '../utils/unsubscribe-page'
import { parseUnsubscribeToken } from '../utils/unsubscribe-token'

// RFC 8058 one-click POST, and the confirmation form from the GET page, which
// adds `browser=1`. Ported from nuxtseo.com. Only a valid signed token changes
// the stored preference. A one-click request with a bad token gets the same
// empty 200 as a good one, so a caller learns nothing from the answer.
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const token = typeof query.token === 'string' ? query.token : ''
  const browser = query.browser === '1'
  const now = new Date()
  const parsed = await parseUnsubscribeToken(token, { secret: useRuntimeConfig(event).session.password, now })

  setResponseHeader(event, 'Cache-Control', 'no-store')

  if (parsed._tag === 'Err') {
    if (!browser)
      return ''
    setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8')
    return renderUnsubscribePage({ _tag: 'Invalid' })
  }

  const db = useDrizzle(event)
  const action = parseUnsubscribeAction(query.action)
  if (action === 'undo')
    await optIn(db, parsed.claim)
  else
    await optOut(db, { ...parsed.claim, source: browser ? 'link' : 'list-unsubscribe', now })

  if (!browser)
    return ''
  setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8')
  return renderUnsubscribePage({ _tag: 'Done', action, email: parsed.claim.email, token })
})
