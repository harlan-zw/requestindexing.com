import type { FetchResponse } from 'ofetch'
import { $fetch } from '#imports'

/**
 * The `/api/pro/**` fetcher, behind `useProFetch()`.
 *
 * Ported from nuxtseo.com `layers/saas/app/plugins/pro-fetch.ts` and cut to
 * this product's seams. There is no billing, no meters and no plan gate here,
 * so the limit, quota and subscription branches are gone. What remains is the
 * part every `/api/pro/**` caller needs:
 *
 *   - SSR forwards the incoming request's auth headers. Nitro's internal
 *     `$fetch` never touches the browser, so without this every `/api/pro/**`
 *     read during SSR answers 401 and the page renders its error state.
 *   - 401 on `/api/pro/**` bounces to the login page with a redirect param.
 *   - 403 on `/api/pro/**` toasts once, instead of each caller inventing copy.
 *
 * This client keeps Pro auth handling separate from the native fetch client.
 */

const PRO_API_PREFIX = '/api/pro/'
const LOGIN_ROUTE = '/login'

type ProHandledResponse = FetchResponse<unknown> & { _proHandled?: boolean }

export default defineNuxtPlugin({
  name: 'pro-saas:fetch',
  enforce: 'post',
  setup() {
    const router = useRouter()
    const toast = useToast()

    // Read the incoming cookies inside the plugin's Nuxt context, while one is
    // still active. Reading them later, inside an interceptor, is too late.
    const ssrAuthHeaders: Record<string, string | undefined> = import.meta.server
      ? useRequestHeaders(['cookie', 'authorization'])
      : {}

    const markHandled = (response: FetchResponse<unknown> | undefined) => {
      if (response)
        (response as ProHandledResponse)._proHandled = true
    }

    const proFetch = $fetch.create({
      onRequest({ options }) {
        if (!import.meta.server)
          return
        const merged = new Headers(options.headers)
        for (const [key, value] of Object.entries(ssrAuthHeaders)) {
          if (value && !merged.has(key))
            merged.set(key, value)
        }
        options.headers = merged
      },
      onResponseError({ response, request }) {
        if (!response || !import.meta.client)
          return

        const url = typeof request === 'string' ? request : ''
        if (!url.startsWith(PRO_API_PREFIX))
          return

        if (response.status === 401) {
          const current = router.currentRoute.value.fullPath
          if (!current.startsWith(LOGIN_ROUTE))
            void navigateTo(`${LOGIN_ROUTE}?redirect=${encodeURIComponent(current)}`)
          markHandled(response)
          return
        }

        if (response.status === 403) {
          toast.add({ title: 'Permission denied', color: 'warning', duration: 4000 })
          markHandled(response)
        }
      },
    })

    return {
      provide: {
        proFetch,
      },
    }
  },
})
