// Pro Indexing layer: Google indexing coverage, issues, sitemaps, URLs. Owns
// the indexing site feature, its UI, server API, and pro-features registration.
//
// This layer opts OUT of contributing to global auto-import. Components
// defined here MUST be imported explicitly (relative paths inside the
// layer, `~~/layers/pro-indexing/...` paths from outside).

export default defineNuxtConfig({
  components: [],
  imports: {
    dirs: [],
  },
})
