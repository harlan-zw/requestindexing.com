<script lang="ts" setup>
const { loggedIn, user } = useUserSession()

useSeoMeta({
  title: 'Get Your Pages Indexed on Google Fast',
  description: 'Free, open-source tool to request Google indexing for your pages via the Indexing API. Track status and view Search Console data.',
})

const faqItems = [
  {
    label: 'Does it actually work?',
    icon: 'i-heroicons-bolt',
    content: 'It does not guarantee to have all of your URLs indexed quicker, but it does, on average, speed up the process.',
  },
  {
    label: 'Will I be penalized for using this?',
    icon: 'i-heroicons-shield-check',
    content: 'Nope! These are public APIs managed by Google. We just make it easier to use them.',
  },
  {
    label: 'Can I see the code?',
    icon: 'i-heroicons-code-bracket',
    content: 'Sure! The entire project is open-source and available on GitHub under the MIT license. Build your own version if you like.',
  },
]

const mockUrls = [
  { url: '/blog/getting-started', status: 'Submitted and indexed', verdict: 'pass', ago: '2 min ago' },
  { url: '/docs/configuration', status: 'Discovered - currently not indexed', verdict: 'neutral', ago: '5 min ago' },
  { url: '/guides/seo-best-practices', status: 'Submitted and indexed', verdict: 'pass', ago: '12 min ago' },
  { url: '/blog/hello-world', status: 'Crawled - currently not indexed', verdict: 'neutral', ago: '1 hr ago' },
  { url: '/changelog/v2', status: 'Submitted and indexed', verdict: 'pass', ago: '3 hrs ago' },
]

const mockSites = [
  { domain: 'nuxtseo.com', indexed: 91, total: 119 },
  { domain: 'harlanzw.com', indexed: 78, total: 112 },
  { domain: 'mdream.dev', indexed: 54, total: 204 },
]

const walkthroughSteps = [
  {
    num: '01',
    eyebrow: 'Connect',
    title: 'Sign in with your Google account',
    description: 'One-click OAuth. We read your Search Console properties — never write, never share.',
    bullets: ['Read-only access to Search Console', 'Revoke any time from your Google account', 'Tokens encrypted at rest'],
  },
  {
    num: '02',
    eyebrow: 'Sync',
    title: 'See every site in one place',
    description: 'All your verified properties, indexing rate, and Search Console metrics — no tab-switching.',
    bullets: ['Aggregate across every property you own', 'Filter by domain, path, or status', 'Historical data preserved past Google\'s 16 months'],
  },
  {
    num: '03',
    eyebrow: 'Submit',
    title: 'Push URLs to the Indexing API',
    description: 'Submit any URL from your dashboard with one click. We respect Google\'s 200/day publish quota so you don\'t have to track it yourself.',
    bullets: ['New and updated URLs', 'Google\'s 200/day quota respected automatically', 'Duplicate submissions skipped for 48 hours'],
  },
  {
    num: '04',
    eyebrow: 'Track',
    title: 'Watch the status flip to indexed',
    description: 'We poll the getMetadata endpoint and update your dashboard. No more refreshing Search Console.',
    bullets: ['Live status per URL', 'Coverage over time, not just a snapshot', 'Retained past Google\'s 16-month window'],
  },
]

const marketingTools = [
  {
    title: 'Google Index Checker',
    description: 'Instantly check if a single URL is indexed. No signup, no account.',
    icon: 'i-heroicons-magnifying-glass',
    to: '/tools/google-indexing-checker',
  },
  {
    title: 'Bulk Indexing Checker',
    description: 'Paste up to 50 URLs or a sitemap. Audit your coverage in one run and export CSV.',
    icon: 'i-heroicons-queue-list',
    to: '/tools/bulk-indexing-checker',
  },
  {
    title: 'Site Indexing Report',
    description: 'Full health report for any domain — estimated indexed pages, keyword coverage, recommendations.',
    icon: 'i-heroicons-document-chart-bar',
    to: '/tools/site-indexing-report',
  },
]
</script>

<template>
  <div>
    <!-- Hero -->
    <div class="bg-verdant divider-tilt">
      <UContainer class="z-1 relative max-w-8xl xl:max-w-[1400px]" :ui="{ base: 'max-w-8xl xl:max-w-[1335px]!' }">
        <section class="py-5 sm:py-12 xl:py-20">
          <div class="xl:grid gap-8 lg:gap-12 xl:grid-cols-12 mx-auto w-full sm:px-6 lg:px-0 px-0">
            <div class="text-pretty mx-auto max-w-[50rem] xl:col-span-7 xl:ml-0 mb-10 xl:mb-0 flex flex-col justify-center">
              <div class="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] mb-6 mx-auto lg:mx-0 self-center lg:self-start">
                <span class="size-1.5 rounded-full bg-primary animate-pulse" />
                Free during beta &middot; Open source
              </div>
              <h1 class="font-title font-bold leading-[0.98] tracking-[-0.045em] text-default text-center text-6xl sm:text-7xl lg:text-left lg:text-[5rem] xl:text-[6rem] mb-6">
                Get your pages <span class="italic text-primary">indexed</span>
                <HeroSvg />
                <span class="whitespace-nowrap">in 48 hours</span>.
              </h1>
              <p class="text-toned max-w-2xl text-center text-lg sm:text-xl lg:text-left mb-10 leading-relaxed">
                Submit URLs straight to Google's <NuxtLink to="https://developers.google.com/search/apis/indexing-api/v3/quickstart" target="_blank" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-default rounded">
                  Indexing API
                </NuxtLink>. Track coverage across every Search Console property in one place, and keep your history past Google's 16-month window.
              </p>

              <div class="flex items-center justify-center gap-3 flex-row sm:gap-4 lg:justify-start">
                <template v-if="!loggedIn">
                  <UButton to="/pro/onboarding" external size="xl" color="primary" trailing-icon="i-heroicons-arrow-right">
                    <span>Get started<span class="hidden sm:inline"> free</span></span>
                  </UButton>
                </template>
                <template v-else>
                  <UButton to="/pro/dashboard" size="xl" color="primary">
                    <UAvatar :src="user?.avatarUrl || undefined" :alt="user?.name || user?.email || 'Account'" size="xs" />
                    Dashboard
                  </UButton>
                </template>
                <UButton size="xl" variant="ghost" color="neutral" icon="i-simple-icons-github" target="_blank" to="https://github.com/harlan-zw/requestindexing.com">
                  View source
                </UButton>
              </div>
            </div>

            <div class="hidden xl:flex xl:col-span-5 max-w-full sticky top-10 items-center justify-center">
              <div class="w-full max-w-lg">
                <div class="rounded-xl border border-default bg-elevated shadow-2xl shadow-primary-500/10 overflow-hidden relative z-10">
                  <!-- Card header -->
                  <div class="px-5 py-4 border-b border-default flex items-center justify-between bg-elevated">
                    <div class="flex items-center gap-2.5">
                      <img src="https://www.google.com/s2/favicons?domain=https://nuxtseo.com" alt="nuxtseo.com favicon" class="size-4 rounded-sm">
                      <span class="font-semibold text-default">nuxtseo.com</span>
                      <UBadge color="primary" variant="subtle" size="xs">
                        91% indexed
                      </UBadge>
                    </div>
                    <div class="flex items-center gap-1.5">
                      <span class="size-2 rounded-full bg-primary-400 animate-pulse" />
                      <span class="text-xs text-muted">Live</span>
                    </div>
                  </div>
                  <!-- Mock URL rows -->
                  <div class="divide-y divide-default bg-elevated">
                    <div
                      v-for="(item, i) in mockUrls"
                      :key="i"
                      class="px-5 py-3 flex items-center justify-between gap-4 text-sm group hover:bg-muted transition-colors animate-fade-in"
                      :style="{ '--stagger-index': i }"
                    >
                      <div class="flex items-center gap-2.5 min-w-0">
                        <UIcon
                          :name="item.verdict === 'pass' ? 'i-heroicons-check-circle' : 'i-heroicons-clock'"
                          class="size-4 shrink-0"
                          :class="item.verdict === 'pass' ? 'text-primary' : 'text-amber-400'"
                        />
                        <span class="truncate text-toned font-mono text-xs">{{ item.url }}</span>
                      </div>
                      <span class="text-muted text-xs whitespace-nowrap hidden sm:block">{{ item.ago }}</span>
                    </div>
                  </div>
                  <!-- Card footer -->
                  <div class="px-5 py-3 bg-muted border-t border-default flex items-center justify-between">
                    <span class="text-xs text-muted">5 of 119 pages</span>
                    <span class="text-xs text-primary font-medium">3 indexed today</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </UContainer>
    </div>

    <div class="bg-default pt-20">
      <!-- Features — editorial bento -->
      <section class="max-w-7xl mx-auto px-6 lg:px-8 py-16 sm:py-24">
        <div class="max-w-3xl mb-12 lg:mb-16">
          <span class="text-xs text-primary font-semibold uppercase tracking-[0.2em] mb-5 block">
            Why it works
          </span>
          <h2 class="font-title text-4xl sm:text-5xl lg:text-6xl font-semibold text-default tracking-[-0.035em] leading-[1.02]">
            Indexing shouldn't be <span class="italic text-primary">luck</span>.
          </h2>
          <p class="text-toned text-lg sm:text-xl mt-6 max-w-2xl leading-relaxed">
            Three levers most SEO tools leave on the table: direct API submission, unified multi-site visibility, and retention that outlasts Google's 16-month window.
          </p>
        </div>

        <div class="grid lg:grid-cols-6 gap-4 lg:gap-5">
          <!-- Dominant feature: Request Indexing -->
          <div class="lg:col-span-4 rounded-2xl border border-default bg-elevated p-8 sm:p-10 relative overflow-hidden group">
            <div class="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
            <div class="relative">
              <div class="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] mb-6">
                <UIcon name="i-heroicons-bolt-solid" class="size-3.5" />
                Indexing API
              </div>
              <h3 class="font-title text-2xl sm:text-3xl font-semibold text-default tracking-[-0.02em] mb-3 leading-[1.1]">
                Submit directly. Skip the queue.
              </h3>
              <p class="text-toned leading-relaxed max-w-xl mb-8">
                Google's Indexing API notifies the crawler immediately. New pages and updated content get picked up in hours, not weeks of hoping Discover stumbles on your sitemap.
              </p>
              <div class="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
                <span class="inline-flex items-center gap-2 text-default">
                  <UIcon name="i-heroicons-check-circle" class="size-4 text-primary" />
                  <span class="font-medium">200 requests/day</span>
                </span>
                <span class="inline-flex items-center gap-2 text-default">
                  <UIcon name="i-heroicons-check-circle" class="size-4 text-primary" />
                  <span class="font-medium">Per-page status</span>
                </span>
                <span class="inline-flex items-center gap-2 text-default">
                  <UIcon name="i-heroicons-check-circle" class="size-4 text-primary" />
                  <span class="font-medium">One click from your dashboard</span>
                </span>
              </div>
            </div>
          </div>

          <!-- Supporting: Unified Dashboard -->
          <div class="lg:col-span-2 rounded-2xl border border-default bg-elevated p-8 relative overflow-hidden">
            <UIcon name="i-heroicons-chart-bar-square" class="size-7 text-primary mb-5" />
            <h3 class="font-title text-xl font-semibold text-default tracking-[-0.015em] mb-2">
              Every site, one tab
            </h3>
            <p class="text-toned text-sm leading-relaxed">
              Verified Search Console properties, indexing rate, and impressions in a single dashboard. No more switching accounts to compare.
            </p>
          </div>

          <!-- Supporting: Data Retention (spans 2) -->
          <div class="lg:col-span-2 rounded-2xl border border-default bg-elevated p-8">
            <UIcon name="i-heroicons-archive-box" class="size-7 text-primary mb-5" />
            <h3 class="font-title text-xl font-semibold text-default tracking-[-0.015em] mb-2">
              History beyond 16 months
            </h3>
            <p class="text-toned text-sm leading-relaxed">
              Search Console only shows the last <NuxtLink to="https://gscdump.com/learn-google-search-console/limits/16-month-data-retention" target="_blank" class="underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
                16 months
              </NuxtLink>, and older days age out every day. We keep it as long as you need, searchable and exportable.
            </p>
          </div>

          <!-- Supporting: Open Source -->
          <div class="lg:col-span-2 rounded-2xl border border-default bg-elevated p-8">
            <UIcon name="i-simple-icons-github" class="size-7 text-primary mb-5" />
            <h3 class="font-title text-xl font-semibold text-default tracking-[-0.015em] mb-2">
              Open, portable, yours
            </h3>
            <p class="text-toned text-sm leading-relaxed">
              MIT on GitHub. Self-host on Cloudflare with your own Google OAuth app if you'd rather own the full stack.
            </p>
          </div>

          <!-- Supporting: Sitemaps -->
          <div class="lg:col-span-2 rounded-2xl border border-default bg-elevated p-8">
            <UIcon name="i-heroicons-map" class="size-7 text-primary mb-5" />
            <h3 class="font-title text-xl font-semibold text-default tracking-[-0.015em] mb-2">
              Sitemaps, tracked
            </h3>
            <p class="text-toned text-sm leading-relaxed">
              What you declared, what Google discovered, and what drifted between the two: one view instead of Search Console's own report.
            </p>
          </div>
        </div>
      </section>

      <!-- How It Works -->
      <UPageSection
        headline="How it works"
        title="From Search Console to indexed in four steps"
        description="Connect your Google account once, submit URLs to the Indexing API, and watch Google pick them up. No dark arts, no waiting for Discover to find your page."
        :ui="{ container: 'max-w-7xl', title: 'font-title' }"
      >
        <div class="mt-12 lg:mt-16 grid gap-14 lg:gap-24">
          <template v-for="(step, i) in walkthroughSteps" :key="step.num">
            <div class="grid lg:grid-cols-12 gap-8 lg:gap-16 items-center min-w-0">
              <div class="lg:col-span-5 min-w-0" :class="[i % 2 === 1 ? 'lg:order-2' : '']">
                <div class="flex items-center gap-3 mb-5">
                  <span class="inline-flex size-10 rounded-full bg-primary/10 text-primary font-mono text-sm font-semibold items-center justify-center">
                    {{ step.num }}
                  </span>
                  <span class="text-xs text-muted font-semibold uppercase tracking-[0.2em]">{{ step.eyebrow }}</span>
                </div>
                <h3 class="font-title text-2xl sm:text-3xl font-semibold text-default mb-3 tracking-[-0.02em] leading-[1.15]">
                  {{ step.title }}
                </h3>
                <p class="text-toned leading-relaxed mb-6">
                  {{ step.description }}
                </p>
                <ul class="space-y-2.5 text-sm text-muted">
                  <li v-for="bullet in step.bullets" :key="bullet" class="flex items-start gap-2.5">
                    <UIcon name="i-heroicons-check" class="size-4 text-primary mt-0.5 shrink-0" />
                    <span>{{ bullet }}</span>
                  </li>
                </ul>
              </div>
              <div class="lg:col-span-7 min-w-0" :class="[i % 2 === 1 ? 'lg:order-1' : '']">
                <!-- Step 1: Google sign-in -->
                <div v-if="i === 0" class="rounded-xl border border-default bg-elevated shadow-lg overflow-hidden">
                  <div class="flex items-center gap-2 px-5 py-3 border-b border-default bg-muted/60">
                    <div class="flex gap-1.5">
                      <span class="size-2.5 rounded-full bg-red-400" />
                      <span class="size-2.5 rounded-full bg-amber-400" />
                      <span class="size-2.5 rounded-full bg-primary/70" />
                    </div>
                    <span class="text-xs text-muted font-mono ml-2 truncate">accounts.google.com</span>
                  </div>
                  <div class="p-7 sm:p-10 text-center">
                    <UIcon name="i-simple-icons-google" class="size-8 mx-auto mb-4 text-blue-500" />
                    <p class="text-default font-semibold mb-1">
                      Choose an account
                    </p>
                    <p class="text-muted text-sm mb-6">
                      to continue to Request Indexing
                    </p>
                    <div class="space-y-2 mb-6 max-w-xs mx-auto">
                      <button type="button" class="w-full inline-flex items-center gap-3 rounded-md border border-default px-4 py-3 bg-default hover:bg-muted transition-colors text-left cursor-default">
                        <GoogleSvg class="size-5 shrink-0" />
                        <div class="flex-1 min-w-0">
                          <div class="text-sm font-medium text-default truncate">
                            harlan@example.com
                          </div>
                          <div class="text-xs text-muted truncate">
                            Harlan Wilton
                          </div>
                        </div>
                        <UIcon name="i-heroicons-check" class="size-4 text-primary" />
                      </button>
                    </div>
                    <p class="text-xs text-muted">
                      Read-only access to Search Console
                    </p>
                  </div>
                </div>
                <!-- Step 2: Sites list -->
                <div v-else-if="i === 1" class="rounded-xl border border-default bg-elevated shadow-lg overflow-hidden">
                  <div class="px-5 py-3.5 border-b border-default flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <UIcon name="i-ph-globe-duotone" class="size-4 text-muted" />
                      <span class="text-sm font-semibold text-default">Your sites</span>
                    </div>
                    <UBadge color="neutral" variant="subtle" size="xs">
                      3 verified
                    </UBadge>
                  </div>
                  <div class="divide-y divide-default">
                    <div v-for="site in mockSites" :key="site.domain" class="px-5 py-4 flex items-center gap-4 hover:bg-muted/60 transition-colors">
                      <img :src="`https://www.google.com/s2/favicons?domain=${site.domain}&sz=64`" :alt="`${site.domain} favicon`" class="size-6 rounded shrink-0">
                      <div class="flex-1 min-w-0">
                        <div class="text-sm font-medium text-default truncate">
                          {{ site.domain }}
                        </div>
                        <div class="text-xs text-muted">
                          {{ site.indexed }} of {{ site.total }} indexed
                        </div>
                      </div>
                      <div class="flex items-center gap-3 shrink-0">
                        <div class="w-20 h-1.5 rounded-full bg-muted overflow-hidden hidden sm:block">
                          <div class="h-full bg-primary" :style="{ width: `${Math.round((site.indexed / site.total) * 100)}%` }" />
                        </div>
                        <span class="text-xs font-mono text-muted tabular-nums">{{ Math.round((site.indexed / site.total) * 100) }}%</span>
                      </div>
                    </div>
                  </div>
                </div>
                <!-- Step 3: Code block -->
                <div v-else-if="i === 2" class="rounded-xl border border-default bg-elevated shadow-lg overflow-hidden">
                  <div class="flex items-center gap-2 px-5 py-3 border-b border-default bg-muted/60">
                    <UIcon name="i-heroicons-command-line" class="size-4 text-muted" />
                    <span class="text-xs font-mono text-muted truncate">POST /v3/urlNotifications:publish</span>
                    <UBadge color="primary" variant="subtle" size="xs" class="ml-auto">
                      200 OK
                    </UBadge>
                  </div>
                  <pre class="px-5 py-5 text-xs sm:text-sm font-mono text-toned overflow-x-auto leading-relaxed min-w-0"><code><span class="text-muted"># Submit a URL to the Indexing API</span>
<span class="text-primary">curl</span> <span class="text-default">-X POST</span> \
  <span class="text-default">-H</span> <span class="text-toned">"Content-Type: application/json"</span> \
  <span class="text-default">-H</span> <span class="text-toned">"Authorization: Bearer $TOKEN"</span> \
  <span class="text-default">--data</span> <span class="text-toned">'{
    "url": "https://example.com/new-page",
    "type": "URL_UPDATED"
  }'</span> \
  <span class="text-primary">indexing.googleapis.com/v3/urlNotifications:publish</span></code></pre>
                </div>
                <!-- Step 4: Status flip -->
                <div v-else class="rounded-xl border border-default bg-elevated shadow-lg overflow-hidden">
                  <div class="px-5 py-3.5 border-b border-default flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <UIcon name="i-heroicons-clock" class="size-4 text-muted" />
                      <span class="text-sm font-semibold text-default">Indexing timeline</span>
                    </div>
                    <span class="text-xs text-muted font-mono">today</span>
                  </div>
                  <div class="divide-y divide-default">
                    <div class="px-5 py-3.5 flex items-center gap-3 text-sm">
                      <UIcon name="i-heroicons-arrow-up-tray" class="size-4 text-muted shrink-0" />
                      <span class="flex-1 text-toned font-mono text-xs truncate">/blog/new-post</span>
                      <UBadge color="neutral" variant="subtle" size="xs">
                        Submitted
                      </UBadge>
                      <span class="text-xs text-muted font-mono hidden sm:inline">09:14</span>
                    </div>
                    <div class="px-5 py-3.5 flex items-center gap-3 text-sm">
                      <UIcon name="i-heroicons-magnifying-glass" class="size-4 text-muted shrink-0" />
                      <span class="flex-1 text-toned font-mono text-xs truncate">/blog/new-post</span>
                      <UBadge color="neutral" variant="subtle" size="xs">
                        Crawled
                      </UBadge>
                      <span class="text-xs text-muted font-mono hidden sm:inline">10:42</span>
                    </div>
                    <div class="px-5 py-3.5 flex items-center gap-3 text-sm bg-primary/5">
                      <UIcon name="i-heroicons-check-circle" class="size-4 text-primary shrink-0" />
                      <span class="flex-1 text-default font-mono text-xs truncate font-medium">/blog/new-post</span>
                      <UBadge color="primary" variant="subtle" size="xs">
                        Indexed
                      </UBadge>
                      <span class="text-xs text-muted font-mono hidden sm:inline">14:28</span>
                    </div>
                  </div>
                  <div class="px-5 py-3 bg-muted/60 border-t border-default flex items-center justify-between">
                    <span class="text-xs text-muted">Average: 5h 14m from submit to indexed</span>
                    <UIcon name="i-heroicons-bolt-solid" class="size-3.5 text-primary" />
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </UPageSection>

      <!-- Free Tools -->
      <UPageSection
        headline="Free tools"
        title="Check indexing without signing up"
        description="Three single-purpose tools for when you just need an answer. No account, no email, no tracking."
        :ui="{ container: 'max-w-7xl', title: 'font-title' }"
      >
        <UPageGrid>
          <UPageCard
            v-for="tool in marketingTools"
            :key="tool.to"
            :title="tool.title"
            :description="tool.description"
            :icon="tool.icon"
            :to="tool.to"
            spotlight
            spotlight-color="primary"
            variant="outline"
          />
        </UPageGrid>
        <div class="flex justify-center mt-8">
          <UButton to="/tools" variant="ghost" color="neutral" trailing-icon="i-heroicons-arrow-right">
            View all tools
          </UButton>
        </div>
      </UPageSection>

      <!-- Learn Section — featured + supporting -->
      <section class="max-w-7xl mx-auto px-6 lg:px-8 py-16 sm:py-24">
        <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12 lg:mb-16">
          <div class="max-w-2xl">
            <span class="text-xs text-primary font-semibold uppercase tracking-[0.2em] mb-5 block">
              Learn
            </span>
            <h2 class="font-title text-4xl sm:text-5xl font-semibold text-default tracking-[-0.035em] leading-[1.05]">
              Understand the API, then automate it.
            </h2>
          </div>
          <UButton
            to="/guides"
            variant="ghost"
            color="neutral"
            trailing-icon="i-heroicons-arrow-right"
            class="self-start lg:self-auto"
          >
            All guides
          </UButton>
        </div>

        <div class="grid lg:grid-cols-3 gap-4 lg:gap-5">
          <!-- Featured -->
          <NuxtLink
            to="/google-indexing-api"
            class="lg:row-span-2 rounded-2xl border border-default bg-elevated p-8 sm:p-10 group relative overflow-hidden flex flex-col justify-between min-h-[320px]"
          >
            <div class="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent pointer-events-none" />
            <div class="relative">
              <UBadge color="primary" variant="subtle" size="sm" class="mb-6">
                Start here
              </UBadge>
              <h3 class="font-title text-2xl sm:text-3xl font-semibold text-default tracking-[-0.02em] mb-3 leading-[1.1]">
                The complete Google Indexing API guide
              </h3>
              <p class="text-toned leading-relaxed max-w-md">
                How the API works, authentication, quotas, error codes, plus working code samples in curl, TypeScript, and Python. One read, production-ready.
              </p>
            </div>
            <div class="relative flex items-center gap-2 mt-8 text-primary font-medium">
              Read the guide
              <UIcon name="i-heroicons-arrow-right" class="size-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </NuxtLink>

          <!-- Supporting 1 -->
          <NuxtLink
            to="/google-indexing-api-tutorial"
            class="rounded-2xl border border-default bg-elevated p-6 sm:p-7 group"
          >
            <UIcon name="i-heroicons-academic-cap" class="size-7 text-primary mb-5" />
            <h3 class="font-title text-lg font-semibold text-default tracking-[-0.015em] mb-1.5">
              Step-by-step tutorial
            </h3>
            <p class="text-toned text-sm leading-relaxed mb-4">
              Set up a GCP project, create a service account, connect to Search Console, and make your first API call.
            </p>
            <div class="flex items-center gap-1.5 text-sm text-primary font-medium">
              Follow tutorial
              <UIcon name="i-heroicons-arrow-right" class="size-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </NuxtLink>

          <!-- Supporting 2 -->
          <NuxtLink
            to="/google-indexing-api-node-js"
            class="rounded-2xl border border-default bg-elevated p-6 sm:p-7 group"
          >
            <UIcon name="i-simple-icons-nodedotjs" class="size-7 text-primary mb-5" />
            <h3 class="font-title text-lg font-semibold text-default tracking-[-0.015em] mb-1.5">
              Node.js implementation
            </h3>
            <p class="text-toned text-sm leading-relaxed mb-4">
              Error handling, batch requests, retry logic, and production-ready patterns you can drop into your deploy pipeline.
            </p>
            <div class="flex items-center gap-1.5 text-sm text-primary font-medium">
              See the code
              <UIcon name="i-heroicons-arrow-right" class="size-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </NuxtLink>

          <!-- Supporting 3 -->
          <NuxtLink
            to="/bulk-submit-urls-google-indexing-api"
            class="rounded-2xl border border-default bg-elevated p-6 sm:p-7 group"
          >
            <UIcon name="i-heroicons-queue-list" class="size-7 text-primary mb-5" />
            <h3 class="font-title text-lg font-semibold text-default tracking-[-0.015em] mb-1.5">
              Bulk URL submission
            </h3>
            <p class="text-toned text-sm leading-relaxed mb-4">
              Submit hundreds of URLs a day within Google's quota. Batching, throttling, and failure recovery patterns.
            </p>
            <div class="flex items-center gap-1.5 text-sm text-primary font-medium">
              Read pattern
              <UIcon name="i-heroicons-arrow-right" class="size-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </NuxtLink>

          <!-- Supporting 4 -->
          <NuxtLink
            to="/google-indexing-api-quota"
            class="rounded-2xl border border-default bg-elevated p-6 sm:p-7 group"
          >
            <UIcon name="i-lucide-gauge" class="size-7 text-primary mb-5" />
            <h3 class="font-title text-lg font-semibold text-default tracking-[-0.015em] mb-1.5">
              Quota & rate limits
            </h3>
            <p class="text-toned text-sm leading-relaxed mb-4">
              The 200 requests/day cap, the 180 req/min getMetadata limit, and how to stay under both without throttling errors.
            </p>
            <div class="flex items-center gap-1.5 text-sm text-primary font-medium">
              Read limits
              <UIcon name="i-heroicons-arrow-right" class="size-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </NuxtLink>
        </div>
      </section>

      <!-- Data Retention — pull quote dominant -->
      <section class="relative py-16 sm:py-24">
        <div class="max-w-7xl mx-auto px-6 lg:px-8 grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          <div class="lg:col-span-5">
            <span class="text-xs text-primary font-semibold uppercase tracking-[0.2em] mb-5 block">
              Data preservation
            </span>
            <h2 class="font-title text-4xl sm:text-5xl font-semibold text-default tracking-[-0.035em] leading-[1.05] mb-6">
              Google is deleting<br>your data.
            </h2>
            <p class="text-toned text-lg leading-relaxed mb-8 max-w-md">
              After 16 months, your Search Console history is gone. Seasonal patterns, year-over-year comparisons, the whole picture &mdash; wiped.
            </p>
            <div class="space-y-4">
              <div class="flex items-start gap-3">
                <UIcon name="i-heroicons-archive-box" class="size-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <div class="text-default font-semibold mb-0.5">
                    Retain forever
                  </div>
                  <div class="text-muted text-sm">
                    Your data is kept for as long as you need it. Export anytime.
                  </div>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <UIcon name="i-heroicons-finger-print" class="size-5 text-primary mt-0.5 shrink-0" />
                <div>
                  <div class="text-default font-semibold mb-0.5">
                    Own your data
                  </div>
                  <div class="text-muted text-sm">
                    Export it, or delete it. It's yours.
                  </div>
                </div>
              </div>
            </div>
          </div>

          <figure class="lg:col-span-7 relative">
            <div class="absolute -top-6 -left-2 text-primary/20 font-title text-[10rem] leading-none select-none pointer-events-none" aria-hidden="true">
              &ldquo;
            </div>
            <blockquote class="relative pl-12 lg:pl-16">
              <p class="font-title text-2xl sm:text-3xl lg:text-4xl text-default tracking-[-0.02em] leading-[1.2] font-medium">
                Search Console keeps data for the last 16 months. As a result, SEO reports in Analytics also include a maximum of 16 months of data.
              </p>
              <footer class="mt-6 flex items-center gap-3">
                <UIcon name="i-simple-icons-google" class="size-5 text-blue-500" />
                <NuxtLink
                  to="https://support.google.com/analytics/answer/1308621"
                  target="_blank"
                  class="text-sm text-muted hover:text-default transition-colors"
                >
                  Google Analytics Documentation &rarr;
                </NuxtLink>
              </footer>
            </blockquote>
          </figure>
        </div>
      </section>

      <!-- Trust Strip -->
      <section class="max-w-7xl mx-auto px-6 lg:px-8 py-16 sm:py-20 border-y border-default">
        <div class="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          <div class="lg:col-span-5">
            <span class="text-xs text-primary font-semibold uppercase tracking-[0.2em] mb-5 block">
              Built in the open
            </span>
            <h2 class="font-title text-3xl sm:text-4xl font-semibold text-default tracking-[-0.03em] leading-[1.1]">
              No paywall, no surveillance, no lock-in.
            </h2>
          </div>
          <div class="lg:col-span-7 grid sm:grid-cols-3 gap-8 lg:gap-10">
            <div>
              <UIcon name="i-heroicons-check-badge" class="size-6 text-primary mb-3" />
              <div class="font-title text-base font-semibold text-default mb-1.5 tracking-[-0.01em]">
                MIT
              </div>
              <p class="text-muted text-sm leading-relaxed">
                Released on GitHub. Built with Nuxt by a Nuxt core team member.
              </p>
            </div>
            <div>
              <UIcon name="i-heroicons-eye-slash" class="size-6 text-primary mb-3" />
              <div class="font-title text-base font-semibold text-default mb-1.5 tracking-[-0.01em]">
                Minimal data
              </div>
              <p class="text-muted text-sm leading-relaxed">
                We collect what's needed to make the product work. Delete it any time.
              </p>
            </div>
            <div>
              <UIcon name="i-heroicons-lock-closed" class="size-6 text-primary mb-3" />
              <div class="font-title text-base font-semibold text-default mb-1.5 tracking-[-0.01em]">
                Encrypted
              </div>
              <p class="text-muted text-sm leading-relaxed">
                At rest and in transit for every sensitive field, including OAuth tokens.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- FAQ -->
      <UPageSection
        title="Questions?"
        :ui="{ container: 'max-w-3xl', title: 'font-title' }"
      >
        <UAccordion :items="faqItems" multiple />
      </UPageSection>

      <!-- CTA -->
      <UPageSection :ui="{ container: 'max-w-4xl' }">
        <UPageCTA
          title="Start indexing your pages today"
          description="Free, open-source, and takes less than a minute to set up."
          variant="subtle"
          :links="[
            { label: 'Get Started Free', to: '/pro/onboarding', color: 'primary', size: 'xl', trailingIcon: 'i-heroicons-arrow-right' },
            { label: 'View on GitHub', to: 'https://github.com/harlan-zw/requestindexing.com', target: '_blank', variant: 'ghost', color: 'neutral', size: 'xl', icon: 'i-simple-icons-github' },
          ]"
        />
      </UPageSection>
    </div>
  </div>
</template>
