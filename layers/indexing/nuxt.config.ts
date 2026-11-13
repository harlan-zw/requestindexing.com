// Indexing layer (renamed from `pro-indexing`, which is now the published
// `@nuxtseo/pro-indexing` package it extends): Request Indexing's own
// indexing pages, adapter, server API, and pro-features registration.
//
// This layer opts OUT of contributing to global auto-import. Components
// defined here MUST be imported explicitly (relative paths inside the
// layer, `~~/layers/indexing/...` paths from outside).

export default defineNuxtConfig({
  components: [],
  imports: {
    dirs: [],
  },
})
