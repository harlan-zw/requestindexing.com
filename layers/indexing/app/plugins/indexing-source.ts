import { PRO_INDEXING_SOURCE_KEY } from '@nuxtseo/pro-indexing/app/composables/useIndexingSource'
import { useRequestIndexingSource } from '#layers/indexing/app/composables/useRequestIndexingSource'

/**
 * Provides Request Indexing's IndexingSource to every shared indexing section.
 * A Site page reads it as is. The fleet pages provide their own, with the
 * Portfolio capabilities, and the URLs page provides one without `inspect`
 * for a view-only Team role.
 */
export default defineNuxtPlugin({
  name: 'indexing:source',
  setup(nuxtApp) {
    nuxtApp.vueApp.provide(PRO_INDEXING_SOURCE_KEY, useRequestIndexingSource())
  },
})
