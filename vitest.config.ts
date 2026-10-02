import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig, defineProject } from 'vitest/config'

// `nuxt.config.ts` serves each drip email template as a `#emails/...` virtual
// module holding the Markdown text. The alias below points those ids at the
// files, and this plugin loads a `.md` file as its text.
function rawMarkdown() {
  return {
    name: 'raw-markdown',
    enforce: 'pre' as const,
    load(id: string) {
      if (id.endsWith('.md'))
        return `export default ${JSON.stringify(readFileSync(id, 'utf8'))}`
    },
  }
}

const ROOT = fileURLToPath(new URL('.', import.meta.url))

// nuxtseo.com discovers its committed workflows by suffix rather than by
// directory, so a test sits next to what it covers. Same three suffixes here:
//
//   *.client.feature.test.ts  a component or composable rendered in a DOM
//   *.feature.test.ts         a seam crossed without a browser
//   *.test.ts                 everything else: pure functions, parsers
const CLIENT_FEATURE = '**/*.client.feature.test.ts'
const FEATURE = '**/*.feature.test.ts'
const UNIT = '**/*.test.ts'

const EXCLUDE = ['**/node_modules/**', '**/.nuxt/**', '**/.output/**', '**/dist/**']

// `#shared`, `#imports`, `#components` and `#schema/pro` are Nuxt build aliases. A node-environment test
// gets no Nuxt resolver, so they are mapped here; `#schema/pro` points at the
// barrel `modules/drizzle-layers` emits, which means a test importing it needs
// `nuxt prepare` to have run at least once. That is what `postinstall` does.
function alias() {
  return [
    { find: '#schema/pro', replacement: fileURLToPath(new URL('./.nuxt/drizzle-layers/pro/schema.ts', import.meta.url)) },
    { find: '#db/pro', replacement: fileURLToPath(new URL('./.nuxt/drizzle-layers/pro/db.ts', import.meta.url)) },
    { find: '#domain-events/server', replacement: fileURLToPath(new URL('./.nuxt/domain-events/server.mjs', import.meta.url)) },
    { find: '#shared', replacement: fileURLToPath(new URL('./shared', import.meta.url)) },
    { find: '#imports', replacement: fileURLToPath(new URL('./tests/setup/nuxt-imports.ts', import.meta.url)) },
    { find: '#components', replacement: fileURLToPath(new URL('./tests/setup/nuxt-components.ts', import.meta.url)) },
    { find: /^#layers\/(.*)$/, replacement: `${ROOT}layers/$1` },
    { find: /^#emails\/(.*)$/, replacement: `${ROOT}layers/pro-saas/server/emails/$1.md` },
    { find: '~~', replacement: ROOT },
  ]
}

export default defineConfig({
  test: {
    projects: [
      defineProject({
        plugins: [rawMarkdown()],
        test: {
          name: 'unit',
          environment: 'node',
          include: [UNIT],
          exclude: [...EXCLUDE, FEATURE, CLIENT_FEATURE],
          globals: true,
        },
        resolve: { alias: alias() },
      }),
      defineProject({
        plugins: [vue(), rawMarkdown()],
        // `tests/ws-route.feature.test.ts` runs Nitro's Durable Object class.
        // Vitest must transform that runtime, so the test can stand in for its
        // `cloudflare:workers` and `#nitro-internal-*` imports. Nitro's build
        // sets `import.meta._websocket`, so the define stands in for it.
        define: { 'import.meta._websocket': 'true' },
        test: {
          name: 'feature',
          environment: 'node',
          include: [FEATURE],
          exclude: [...EXCLUDE, CLIENT_FEATURE],
          globals: true,
          server: { deps: { inline: [/nitropack\/dist\/presets\/cloudflare\/runtime\//] } },
        },
        resolve: { alias: alias() },
      }),
      defineProject({
        plugins: [vue()],
        test: {
          name: 'client',
          environment: 'happy-dom',
          include: [CLIENT_FEATURE],
          exclude: EXCLUDE,
          setupFiles: ['tests/setup/client.ts'],
          globals: true,
        },
        resolve: { alias: alias() },
      }),
    ],
  },
})
