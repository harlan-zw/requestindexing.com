import { UNSUBSCRIBE_PATH } from './unsubscribe-token'

// The pages behind an unsubscribe link, ported from nuxtseo.com. A GET only
// renders a confirmation form, because mail scanners follow links. Only the
// signed POST changes the stored preference.

export type UnsubscribeAction = 'unsubscribe' | 'undo'

export type UnsubscribePage
  = | { _tag: 'Invalid' }
    | { _tag: 'Confirm', action: UnsubscribeAction, email: string, token: string }
    | { _tag: 'Done', action: UnsubscribeAction, email: string, token: string }

export function parseUnsubscribeAction(value: unknown): UnsubscribeAction {
  return value === 'undo' ? 'undo' : 'unsubscribe'
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[char]!)
}

function actionUrl(token: string, action: UnsubscribeAction, browser: boolean): string {
  const params = new URLSearchParams({ token })
  if (action === 'undo')
    params.set('action', 'undo')
  if (browser)
    params.set('browser', '1')
  return `${UNSUBSCRIBE_PATH}?${params.toString()}`
}

// Colours from DESIGN.md.
const STYLE = `
  :root { color-scheme: light dark; --bg: #f7f7eb; --card: #ffffff; --text: #1c1f0e; --muted: #6b6e54; --border: #e6e7d2; --primary: #059669; }
  @media (prefers-color-scheme: dark) { :root { --bg: #1c1f0e; --card: #262a14; --text: #f7f7eb; --muted: #b9bb9f; --border: #3a3f20; } }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.5 "DM Sans", system-ui, sans-serif; }
  main { max-width: 32rem; margin: 4rem auto; padding: 24px; background: var(--card); border: 1px solid var(--border); border-radius: 20px; }
  h1 { margin: 0 0 12px; font-size: 1.375rem; line-height: 1.25; }
  p { margin: 0 0 12px; color: var(--muted); }
  strong { color: var(--text); overflow-wrap: anywhere; }
  a { color: var(--primary); }
  button { appearance: none; border: 0; border-radius: 10px; padding: 12px 16px; background: var(--primary); color: #ffffff; font: inherit; font-weight: 600; cursor: pointer; }
  @media (max-width: 36rem) { main { margin: 16px; } }
`

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} · Request Indexing</title>
<style>${STYLE}</style>
</head>
<body><main>${body}</main></body>
</html>`
}

export function renderUnsubscribePage(page: UnsubscribePage): string {
  if (page._tag === 'Invalid') {
    return layout('Link does not work', [
      '<h1>This unsubscribe link does not work</h1>',
      '<p>The link is incomplete, or it is older than 180 days.</p>',
      '<p>Use the link in your latest email from Request Indexing. You can also reply to that email.</p>',
    ].join(''))
  }

  const email = `<strong>${escapeHtml(page.email)}</strong>`

  if (page._tag === 'Confirm') {
    const form = (label: string) => `<form method="post" action="${escapeHtml(actionUrl(page.token, page.action, true))}"><button type="submit">${label}</button></form>`
    if (page.action === 'undo') {
      return layout('Resume product updates', [
        '<h1>Resume product updates?</h1>',
        `<p>Request Indexing will send product updates to ${email} again.</p>`,
        form('Resume product updates'),
      ].join(''))
    }
    return layout('Unsubscribe', [
      '<h1>Unsubscribe from product updates?</h1>',
      `<p>Request Indexing will stop sending product updates to ${email}.</p>`,
      '<p>Emails about your account, such as Free allowance notices, still arrive.</p>',
      form('Unsubscribe'),
    ].join(''))
  }

  if (page.action === 'undo') {
    return layout('Product updates resumed', [
      '<h1>Product updates resumed</h1>',
      `<p>Request Indexing will send product updates to ${email} again.</p>`,
    ].join(''))
  }
  const undo = escapeHtml(actionUrl(page.token, 'undo', false))
  return layout('Unsubscribed', [
    '<h1>You are unsubscribed</h1>',
    `<p>${email} gets no more product updates from Request Indexing.</p>`,
    `<p>If you change your mind, <a href="${undo}">resume product updates</a>.</p>`,
  ].join(''))
}
