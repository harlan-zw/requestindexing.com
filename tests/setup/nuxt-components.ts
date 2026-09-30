// `#components` is a Nuxt build alias. A vitest run has no Nuxt, so vitest.config
// resolves it here. It exports nothing: a test that mounts a component importing
// `#components` replaces this module with `vi.mock('#components', ...)`.
export {}
