import type { GscdumpIndexingUrlsResponse } from '#layers/pro-gsc/shared/gscdump-api'
import { createGscdumpV1Client } from '@gscdump/sdk/v1'
import { firstPageIndexingUrlsParams } from '#layers/indexing/app/utils/indexing-urls-first-page'
import { indexingUrlsQueryKey } from '#layers/pro-gsc/app/composables/useProGscdump/useProGscdumpIndexing'

/** How long the server render waits for the first page before it goes without. */
const FIRST_PAGE_TIMEOUT_MS = 800

/**
 * Seed the URLs table's clean first page into the SSR payload.
 *
 * The server reads the first page through the same gscdump v1 proxy the
 * browser uses, with the reader's own session cookie, and writes the response
 * under the key the table's query computes. The table then renders the rows in
 * the server HTML, and hydration reuses them instead of fetching again.
 *
 * nuxtseo.com does this in `middleware/indexing-urls-first-page.ts`, which
 * reads the Site from its dashboard store. Here the dashboard layout already
 * resolved the Site before the page renders, so the page calls this directly.
 *
 * One attempt, bounded by a timeout: a slow or failing upstream must not hold
 * the HTML. Call the returned function on the server only.
 */
export function useIndexingUrlsFirstPageSeed() {
  const nuxtApp = useNuxtApp()
  const event = useRequestEvent()
  const fetchForRequest = useRequestFetch()

  return async (siteId: string, pageSize: number): Promise<void> => {
    if (!event)
      return
    const params = firstPageIndexingUrlsParams(pageSize)
    const client = createGscdumpV1Client({
      apiRoot: '/api/_gscdump',
      credential: 'session-proxy',
      retry: { maxAttempts: 1 },
      // Forward the current session cookie and leave the body for the SDK.
      // The in-process fetch can drop aborts, so the timeout races it.
      fetch: (request, init) => {
        const headers = new Headers(init?.headers)
        headers.delete('authorization')
        return fetchForRequest.raw(String(request), {
          ...init,
          method: 'GET',
          headers,
          responseType: 'stream',
          ignoreResponseError: true,
          retry: 0,
        })
      },
    })

    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`No response in ${FIRST_PAGE_TIMEOUT_MS} ms`)), FIRST_PAGE_TIMEOUT_MS)
    })
    await Promise.race([client.listSiteIndexingUrls({ params: { siteId }, query: params }), timeout])
      .then((response) => {
        nuxtApp.payload.data[indexingUrlsQueryKey(siteId, params)] = response.data as GscdumpIndexingUrlsResponse
      })
      .catch((error: unknown) => {
        // Handled by fallback: with no seed, the table fetches in the browser
        // and shows its own error state if that read fails too.
        console.warn('[indexing-urls] First page prefetch failed. The table fetches it in the browser instead.', error)
      })
      .finally(() => clearTimeout(timer))
  }
}
