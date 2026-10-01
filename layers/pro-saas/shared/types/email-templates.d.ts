// Nitro's `raw` rollup plugin imports a `.md` file as its text. The drip
// templates in `layers/pro-saas/server/emails/` load that way, and
// `vitest.config.ts` does the same for tests. This file sits in `shared/`
// because both the app and the server tsconfig include it from here.
declare module '*.md' {
  const content: string
  export default content
}
