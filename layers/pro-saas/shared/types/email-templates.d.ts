// `nuxt.config.ts` serves each drip email template in
// `layers/pro-saas/server/emails/` as a `#emails/<sequence>/<file>` virtual
// module, and `vitest.config.ts` aliases the same ids. Each one default
// exports the Markdown text. This file sits in `shared/` because both the app
// and the server tsconfig include it from here.
declare module '#emails/*' {
  const content: string
  export default content
}
