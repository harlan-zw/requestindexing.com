import type { OAuthPoolToken } from './layers/core/app/types'
import process from 'node:process'
import { resolve } from 'path'
import { globbySync } from 'globby'
import { externalCheckin } from './shared/checkin-external'
import { CLOUDFLARE_REQUIRED_SECRETS } from './shared/cloudflare'
import { runtimeOnlyRouteRules } from './shared/routes'
import { SENTRY_DSN } from './shared/sentry'

const tokens: Partial<OAuthPoolToken>[] = process.env.NUXT_OAUTH_POOL ? JSON.parse(process.env.NUXT_OAUTH_POOL) : []

// read all the folders at the server/app path
const recursiveServerAppFolders = globbySync('**/*', {
  cwd: resolve('./layers/core/server/app'),
  onlyDirectories: true,
  deep: 4,
  absolute: true,
})

export default defineNuxtConfig({
  checkin: { external: externalCheckin },
  alias: {
    h3: resolve('./node_modules/h3/dist/index.mjs'),
  },
  extends: [
    './apps/marketing',
    './apps/admin',
    './apps/brand-kit',
    './layers/design-system',
    './layers/pro-shell',
    './layers/pro-saas-auth',
    './layers/pro-saas',
    './layers/pro-gsc',
    './layers/pro-indexing',
    './layers/core',
  ],
  nuxtDx: {
    report: true,
  },

  nuxtSentry: {
    dsn: SENTRY_DSN,
    project: 'request-indexing',
  },

  drizzleLayers: {
    databases: {
      // One D1, named `pro` to match nuxtseo.com, so its server code imports
      // `#schema/pro` here too.
      pro: { dbFrom: './layers/core/server/utils/drizzle.ts' },
    },
  },

  modules: [
    './modules/drizzle-layers',
    '@harlan-zw/nuxt-domain-events',
    '@harlan-zw/nuxt-use-query',
    '@harlan-zw/nuxt-cloudflare',
    '@harlan-zw/nuxt-checkin',
    '@harlan-zw/nuxt-wide-events',
    '@harlan-zw/nuxt-dx',
    'nuxt-auth-utils',
    '@nuxt/image',
    '@nuxt/ui',
    '@vueuse/nuxt',
    '@harlan-zw/comark-content',
    '@nuxtjs/seo',
    'nuxt-ai-ready',
    'nuxt-skew-protection',
    '@nuxt/scripts',
    'nitro-cloudflare-dev',
    (_, nuxt) => {
      nuxt.options.nitro!.virtual = nuxt.options.nitro!.virtual || {}
      nuxt.options.nitro.virtual['#app/token-pool.mjs'] = `export const tokens = ${JSON.stringify(tokens)}`
    },
    '@nuxt/fonts',
    '@sentry/nuxt/module',
    '@harlan-zw/nuxt-sentry',
  ],

  nuxtCloudflare: {
    kvCache: { binding: 'CACHE' },
    requiredSecrets: CLOUDFLARE_REQUIRED_SECRETS,
  },

  wideEvents: {
    service: 'request-indexing',
    request: true,
    fields: [],
    exclude: [
      '/__comark_content/**',
      '/_ipx/**',
      '/_nuxt/**',
      '/api/_nuxt_icon/**',
    ],
  },

  domainEvents: {
    observer: 'layers/pro-saas/server/utils/domain-event-observer.ts',
    allowEmptyEvents: [
      'pro:gsc:webhook',
      'pro:integration:linked',
      'pro:user:deleted',
    ],
  },

  compatibilityDate: '2026-08-11',

  // `layers/design-system` turns auto-imports off so every file in it imports
  // explicitly, the way nuxtseo.com writes them. Nuxt merges layer config into
  // one graph, so that switch would reach the whole app; re-assert it here.
  // The design-system files keep their explicit imports either way.
  imports: { autoImport: true },

  hooks: {
    // Dev-only server routes never reach a production bundle. Scanned handlers
    // are a separate list from declared ones, so both are filtered. Each
    // handler also 404s unless `import.meta.dev`; this is the second lock, so a
    // missing guard in one file cannot ship an open door.
    'nitro:config': function (config) {
      // Dev-only server routes are never scanned into a production build. Each
      // handler also 404s unless `import.meta.dev`; this is the second lock, so
      // a missing guard in one file cannot ship an open door.
      if (!config.dev) {
        config.ignore = config.ignore || []
        config.ignore.push('api/_dev/**')
      }
      config.typescript = config.typescript || {}
      config.typescript.tsConfig = config.typescript.tsConfig || {}
      config.typescript.tsConfig.include = config.typescript.tsConfig.include || []
      config.typescript.tsConfig.include.push(resolve('./layers/core/server/hooks.d.ts'))
    },
  },

  site: {
    url: 'https://requestindexing.com',
    name: 'Request Indexing',
    description: 'Monitor and request Google indexing for your pages',
    defaultLocale: 'en',
    indexable: true,
  },

  sitemap: {
    zeroRuntime: true,
    exclude: [
      '/_alt/**',
      '/dashboard/**',
      '/pro/**',
      '/api/**',
      '/auth/**',
      '/kit/**',
    ],
  },

  ogImage: {
    zeroRuntime: true,
  },

  robots: {
    disallow: [
      '/_alt/**',
      '/dashboard/**',
      '/pro/**',
      '/api/**',
      '/auth/**',
      '/kit/**',
    ],
  },

  schemaOrg: {
    identity: {
      type: 'Organization',
      name: 'Request Indexing',
      logo: '/favicon.svg',
    },
  },

  linkChecker: {
    enabled: false,
    runOnBuild: false,
  },

  seo: {
    redirectToCanonicalSiteUrl: false,
    // Unhead deprecates every `twitter:*` meta tag. X reads Open Graph metadata
    // now. This flag stops `nuxt-seo-utils` and `nuxt-og-image` emitting them.
    automaticTwitterTags: false,
  },

  // `@harlan-zw/nuxt-sentry` sets `sourcemap.client` when a Sentry auth token is
  // present, and deliberately leaves the server alone, where Nuxt defaults to true.
  // Without this the server bundle ships its own source maps.
  sourcemap: {
    server: false,
  },

  devtools: { enabled: true },

  skewProtection: {
    // `ws` rides Nitro's Durable Object websocket (cloudflare-durable preset +
    // nitro.experimental.websocket, both set below), so the server pushes its
    // deploy version and the client detects a stale build on reconnect.
    updateStrategy: 'ws',
    // `prompt` surfaces the update instead of reloading under the user, which
    // matters on a dashboard where a reload can interrupt work. Rendered by
    // `SkewNotification` in layers/core/app/app.vue; without that component this
    // strategy detects the stale build and then does nothing visible.
    reloadStrategy: 'prompt',
  },

  aiReady: {
    database: { type: 'd1', bindingName: 'DB' },
  },

  // `prerender: false` comes from `RUNTIME_ONLY_ROUTE_PREFIXES` so the same list
  // that keeps a route out of the prerender also keeps the site-wide OG image
  // off it. `ogImage.zeroRuntime` cannot render at runtime, so the two must
  // never disagree.
  routeRules: {
    ...runtimeOnlyRouteRules(),
    '/_alt/**': { robots: false, prerender: false },
    // The legacy sign-up door. `/pro/onboarding` is the one entry now, so the
    // old path keeps its inbound links and search results alive.
    '/get-started': { redirect: { to: '/pro/onboarding', statusCode: 301 } },
    // The Site picker moved under the Sites roster, matching nuxtseo.com.
    '/pro/dashboard/team/sites': { redirect: { to: '/pro/dashboard/sites/connect', statusCode: 301 } },
    // The all-sites indexing page moved to nuxtseo.com's route.
    '/pro/dashboard/web-indexing': { redirect: { to: '/pro/dashboard/indexing', statusCode: 301 } },
    // `/dashboard/**` and `/account/**` are 301'd to the one tree by
    // `layers/pro-saas/server/middleware/00-legacy-dashboard.ts`. A route rule
    // can only swap the prefix, and several of those pages moved further.
  },

  nitro: {
    alias: {
      'h3': resolve('./node_modules/h3/dist/index.mjs'),
      '~/server': resolve('./layers/core/server'),
      // `#schema` aggregates pro-saas's typed drizzle surface. `#schema/pro`
      // and `#db/pro` come from `modules/drizzle-layers` instead.
      '#schema': resolve('./layers/pro-saas/server/database/_surface.ts'),
    },
    prerender: {
      crawlLinks: true,
      routes: ['/'],
      failOnError: true,
    },
    preset: 'cloudflare-durable',
    cloudflare: {
      deployConfig: true,
      // Pins the worker to nodejs_compat v1. Nothing in the bundle needs v2's
      // fuller `node:stream` since the googleapis/jws chain was removed. To
      // move to v2, put `nodejs_compat_v2` in `wrangler.toml` instead; the
      // module resolves the flag pair Cloudflare accepts.
      nodeCompat: true,
      // Deploy values the authored `wrangler.toml` already carries are not
      // repeated here. @harlan-zw/nuxt-cloudflare reads that file and writes
      // them into the generated config, so a second copy only invites drift.
      wrangler: {
        logpush: true,
        triggers: {
          // Every cron in `scheduledTasks` below must be listed here too, or
          // Cloudflare never fires it.
          crons: ['0 0 * * *', '30 * * * *'],
        },
        vars: {
          NUXT_PUBLIC_BASE_URL: 'https://requestindexing.com',
          // An OAuth client id is public (it ships in every authorize redirect),
          // so it is a default here rather than a build-time requirement. It
          // used to fall back to '', which meant any build run without the env
          // var silently deployed a Worker that could not start a Google
          // sign-in at all.
          NUXT_OAUTH_GOOGLE_CLIENT_ID: process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID
            || '32479086022-b2upoo15sfpo0fpmgdgi95fh6oths219.apps.googleusercontent.com',
          // Kill switch for the welcome email and the daily site-sync fan-out.
          // Set to 'false' while migrating legacy data, so no welcome email is
          // sent and no bulk sync is queued. The Free allowance email ignores
          // this switch and always sends.
          NUXT_NOTIFICATIONS_ENABLED: process.env.NUXT_NOTIFICATIONS_ENABLED || 'false',
        },
        durable_objects: {
          bindings: [
            { name: '$DurableObject', class_name: '$DurableObject' },
          ],
        },
        migrations: [
          { tag: 'v1', new_classes: ['$DurableObject'] },
        ],
        queues: {
          producers: [
            { queue: 'ri-default', binding: 'QUEUE_DEFAULT' },
            { queue: 'ri-dlq', binding: 'QUEUE_DLQ' },
          ],
          consumers: [
            { queue: 'ri-default', max_batch_size: 1, max_batch_timeout: 10, max_concurrency: 5, max_retries: 3, dead_letter_queue: 'ri-dlq' },
            { queue: 'ri-dlq', max_batch_size: 1, max_batch_timeout: 60, max_concurrency: 1, max_retries: 3 },
          ],
        },
      },
    },
    devStorage: {
      cache: { driver: 'memory' },
    },
    sourceMap: false,
    experimental: {
      asyncContext: true,
      websocket: true,
      tasks: true,
    },
    scheduledTasks: {
      // Daily at midnight UTC.
      '0 0 * * *': ['sync.daily'],
      // Hourly, off the hour so it never shares a tick with the daily sync.
      // Links sites whose property was verified, or whose grant was repaired
      // in gscdump, after the user last connected Google.
      '30 * * * *': ['reconcile-gscdump-onboarding'],
    },
    imports: {
      // See the root `imports` block: the design-system layer turns auto-imports
      // off for the whole graph, so the server side re-asserts it too.
      autoImport: true,
      dirs: recursiveServerAppFolders,
    },
    externals: {
      inline: ['drizzle-orm'],
    },
  },

  icon: {
    serverBundle: 'remote',
    clientBundle: {
      scan: true,
    },
  },

  app: {
    pageTransition: {
      name: 'page',
      mode: 'out-in',
    },
    head: {
      templateParams: {
        separator: '·',
      },
      script: [
        {
          'src': 'https://cdn.usefathom.com/script.js',
          'data-spa': 'auto',
          'data-site': 'UHBNWPCP',
          'defer': true,
        },
      ],
      meta: [
        { name: 'theme-color', content: '#18181b', media: '(prefers-color-scheme: dark)' },
        { name: 'theme-color', content: 'white', media: '(prefers-color-scheme: light)' },
      ],
    },
  },

  vite: {
    optimizeDeps: {
      include: [
        '@gscdump/sdk/v1',
        'motion-v',
        'reka-ui',
      ],
      // `@nuxt/ui` pins `@tanstack/vue-table@8`, this repo depends on v9 for the
      // design-system table. Vite's pre-bundler flattens both onto the hoisted
      // `@tanstack/table-core@9`, and v8's `createTable` import then resolves to
      // nothing, so every page rendering a `UTable` 500s in dev. Serving them
      // from source keeps each package on its own `table-core`.
      exclude: [
        '@tanstack/vue-table',
        '@tanstack/table-core',
      ],
    },
  },

  runtimeConfig: {
    checkinToken: '',
    // Gates the welcome email and the daily sync fan-out. The Free allowance
    // email always sends. Override with NUXT_NOTIFICATIONS_ENABLED.
    notificationsEnabled: true,
    key: '', // .env NUXT_KEY
    session: {
      password: '',
      maxAge: 60 * 60 * 24 * 90, // 3mo
    },
    postmark: {
      apiKey: '',
    },
    gscdump: {
      apiUrl: 'https://gscdump.com/api',
      apiKey: '',
      webhookSecret: '',
      // Where gscdump delivers webhooks for sites we register. Override via
      // NUXT_GSCDUMP_WEBHOOK_URL in dev/preview (e.g. a tunnel); the default
      // silently points non-prod registrations at prod otherwise.
      webhookUrl: 'https://requestindexing.com/api/webhooks/gscdump',
    },
    dataforseo: {
      login: '',
      password: '',
      // Daily ceiling (USD) for ALL DataForSEO tool spend combined, counted
      // from the provider's measured per-response cost in the `cache` KV.
      // Once spent, the public tools answer 429 for the rest of the UTC day.
      // NUXT_DATAFORSEO_DAILY_BUDGET_USD.
      dailyBudgetUsd: '5',
    },
    public: {
      baseUrl: 'https://requestindexing.com',
      indexing: {
        usageLimitPerUser: 15,
      },
      // Nav rows that are declared but not shipped. `bing` covers both Bing
      // surfaces: gscdump has not released the partner operations they read,
      // so the rows stay out of the sidebar until NUXT_PUBLIC_FEATURES_BING
      // is set. See layers/pro-shell/shared/manifest.ts.
      features: {
        bing: false,
      },
    },
    indexing: {
      maxUsersPerOAuth: 100,
    },
  },
})
