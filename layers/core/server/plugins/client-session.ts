import { toClientSession } from '../../shared/client-session'

// Session fetch hooks run in parallel. Parse the final response after all hooks,
// including SSR's local fetch, so old cookies cannot publish hidden credentials.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event, response) => {
    if (event.method !== 'GET' || event.path.split('?', 1)[0] !== '/api/_auth/session')
      return
    response.body = toClientSession(response.body)
  })
})
