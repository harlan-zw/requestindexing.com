import { defineProIndexingConfig } from '@nuxtseo/pro-indexing/shared/config'
import { PRO_INDEXING_COPY_OVERRIDES, PRO_INDEXING_ROUTES } from './pro-indexing'

// The `@nuxtseo/pro-indexing` seams: where each logical route lives here, and
// the words that differ from the section defaults.
export default {
  proIndexing: defineProIndexingConfig({
    routes: PRO_INDEXING_ROUTES,
    copy: PRO_INDEXING_COPY_OVERRIDES,
  }),
}
