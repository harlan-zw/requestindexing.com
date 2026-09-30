// Ported from nuxtseo.com's `layers/saas/app/composables/useProHeaderPageMeta.ts`.
// The resolution rule lives in `utils/pro-header-meta.ts` so it can be tested
// without a Nuxt app.
import { useRoute } from 'nuxt/app'
import { computed } from 'vue'
import { resolveProHeaderPageMeta } from '../utils/pro-header-meta'

export function useProHeaderPageMeta() {
  const route = useRoute()
  const resolved = computed(() => resolveProHeaderPageMeta(route))
  return {
    title: computed(() => resolved.value.title),
    crumbs: computed(() => resolved.value.crumbs),
  }
}
