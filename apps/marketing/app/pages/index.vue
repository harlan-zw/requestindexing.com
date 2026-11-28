<script lang="ts" setup>
import { FREE_TOOLS } from '#shared/tool-registry'

// COPY.md "Landing page assets" owns every string on this page.
const { loggedIn, user } = useUserSession()

useSeoMeta({
  title: 'Request Google Indexing and See Why Pages Are Not Indexed',
  description: 'Request Google indexing for your pages, then see which URLs Google has indexed, which it has not, and the reason it gives. Free and open source.',
})

const faqItems = [
  {
    label: 'Can you force Google to index my page?',
    icon: 'i-heroicons-hand-raised',
    content: 'No. Nobody can. Google decides. Request Indexing shows the reason Google gives, so you can fix the cause.',
  },
  {
    label: 'Why is my whole Site not indexed?',
    icon: 'i-heroicons-globe-alt',
    content: 'Start with the stage where most URLs stop. The Why pages stop card on your Indexing page names it. If Google does not know the URLs, add a sitemap and link to them from your home page.',
  },
  {
    label: 'Is it safe for my Google account?',
    icon: 'i-heroicons-shield-check',
    content: 'Request Indexing uses Google\'s public APIs, your own Google sign-in, and Google\'s published limits.',
  },
  {
    label: 'Does the Indexing API work for blog posts?',
    icon: 'i-heroicons-document-text',
    content: 'Google documents it for job posting and livestream pages only. Use URL Inspection or a sitemap for other pages. IndexNow takes any page type, for Bing and other participating search engines.',
  },
  {
    label: 'What does it cost?',
    icon: 'i-heroicons-banknotes',
    content: 'Start free, within your Free allowance. No card needed.',
  },
  {
    label: 'Can I see the code?',
    icon: 'i-heroicons-code-bracket',
    content: 'Yes. The whole project is on GitHub under the MIT license. Read it, fork it, or build your own version.',
  },
]

useSchemaOrg([
  {
    '@type': 'FAQPage',
    'mainEntity': faqItems.map(faq => ({
      '@type': 'Question',
      'name': faq.label,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': faq.content,
      },
    })),
  },
])

// Google's coverage states, verbatim, as the dashboard shows them.
const mockUrls = [
  { url: '/blog/hello-world', status: 'Crawled - currently not indexed', verdict: 'neutral' },
  { url: '/guides/seo-best-practices', status: 'Submitted and indexed', verdict: 'pass' },
  { url: '/docs/configuration', status: 'Discovered - currently not indexed', verdict: 'neutral' },
  { url: '/tags/nuxt', status: 'Excluded by ‘noindex’ tag', verdict: 'neutral' },
  { url: '/changelog/v2', status: 'Submitted and indexed', verdict: 'pass' },
]

const mockSites = [
  { domain: 'nuxtseo.com', indexed: 108, total: 119 },
  { domain: 'harlanzw.com', indexed: 78, total: 112 },
  { domain: 'mdream.dev', indexed: 54, total: 204 },
]

const mockChanges = [
  { url: '/blog/hello-world', from: 'Crawled - currently not indexed', to: 'Submitted and indexed', indexed: true },
  { url: '/docs/old-setup', from: 'Submitted and indexed', to: 'Excluded by ‘noindex’ tag', indexed: false },
  { url: '/guides/sitemaps', from: 'Discovered - currently not indexed', to: 'Crawled - currently not indexed', indexed: false },
]

const stopStages = ['Inspected', 'Crawled', 'Indexable', 'Indexed']

// The five reasons and first fixes from onboarding email 02.
const stopReasons = [
  { reason: 'Google does not know the URL.', fix: 'Add it to your sitemap. Link to it from a page Google already indexed.' },
  { reason: 'Google knows the URL but has not crawled it.', fix: 'Link to it from your indexed pages. Cut thin URLs, such as empty tag pages.' },
  { reason: 'Google could not fetch the URL.', fix: 'Check robots.txt, server errors, logins, and redirects.' },
  { reason: 'A signal tells Google to skip the URL.', fix: 'Look for a noindex tag. Make sure the canonical points to the page itself.' },
  { reason: 'Google crawled the page and chose not to index it.', fix: 'Compare it with similar pages on your Site. Improve it, or merge it into the stronger page.' },
]

const features = [
  {
    title: 'Send pages with IndexNow',
    description: 'IndexNow notifies Bing and other participating search engines about any page type. Google is not one of them. Once your key is verified, Request Indexing sends new and changed sitemap URLs for you.',
    icon: 'i-heroicons-paper-airplane',
  },
  {
    title: 'Every sitemap URL, with its reason',
    description: 'Request Indexing inspects the URLs in your sitemaps with URL Inspection, within your Free allowance. Each URL shows Google\'s verdict and reason.',
    icon: 'i-heroicons-document-magnifying-glass',
  },
  {
    title: 'What changed',
    description: 'Coverage over time, and the URLs whose verdict changed in the last 28 days.',
    icon: 'i-heroicons-arrows-right-left',
  },
  {
    title: 'Watched URLs',
    description: 'Keep scheduled URL Inspection evidence for pages you choose. This does not request indexing.',
    icon: 'i-heroicons-eye',
  },
  {
    title: 'Sitemaps',
    description: 'What you declared, what Google discovered, and what drifted between the two.',
    icon: 'i-heroicons-map',
  },
]

const walkthroughSteps = [
  {
    num: '01',
    eyebrow: 'Connect',
    title: 'Sign in with your Google account',
    description: 'One OAuth sign-in. We read your Search Console data. The only changes we make there are a sitemap submission and a property you add and verify.',
    bullets: [
      'Read-only Search Console access during setup',
      'Remove access any time in your Google Account',
      'Indexing API uses a separate Google grant when needed',
    ],
  },
  {
    num: '02',
    eyebrow: 'Sync',
    title: 'Connect your Sites',
    description: 'Choose verified Search Console properties to connect as Sites, with each Site\'s indexing rate and Search Console metrics in one list.',
    bullets: [
      'Totals across every Site you connect, within your Free allowance',
      'Filter by domain, path, or status',
    ],
  },
  {
    num: '03',
    eyebrow: 'Send',
    title: 'Send new and changed pages with IndexNow',
    description: 'Publish your IndexNow key file and verify the key. Automatic sending then sends new and changed sitemap URLs after each sitemap update.',
    bullets: [
      'Bing and other participating search engines. Google is not one of them.',
      'Any page type on your site.',
      'A receipt records the notification outcome.',
      'For job posting and livestream pages only, you can also submit to Google\'s Indexing API.',
    ],
  },
  {
    num: '04',
    eyebrow: 'Track',
    title: 'See what Google decided',
    description: 'Your dashboard shows the index status Google reports for each URL, read through gscdump. No more refreshing Search Console.',
    bullets: ['Status per URL', 'Coverage over time', 'Indexed, not indexed, and the reason Google gives'],
  },
]

const marketingTools = FREE_TOOLS.map(tool => ({
  title: tool.title,
  description: tool.shortDescription,
  icon: tool.icon,
  to: tool.path,
}))

const learnGuides = [
  {
    title: 'Why is my page not indexed?',
    description: 'Search Console gives a reason for each page Google did not index. Learn what each reason means, and the first fix to try.',
    icon: 'i-heroicons-question-mark-circle',
    to: '/why-is-my-page-not-indexed',
    action: 'Read the reasons',
  },
  {
    title: 'Why is my site not indexed?',
    description: 'Check the site-wide causes first: robots.txt, noindex, sitemaps, and how to find where your URLs stop.',
    icon: 'i-heroicons-globe-alt',
    to: '/why-is-my-site-not-indexed',
    action: 'Check your site',
  },
  {
    title: 'How to set up IndexNow',
    description: 'Publish a key file, verify it, and notify Bing and other participating search engines when pages change.',
    icon: 'i-heroicons-paper-airplane',
    to: '/indexnow-setup',
    action: 'Set up IndexNow',
  },
  {
    title: 'Indexing API for blog posts',
    description: 'Ordinary blog posts are outside Google\'s supported Indexing API use. Learn what to use instead, and what an accepted request proves.',
    icon: 'i-heroicons-document-text',
    to: '/indexing-api-for-blog-posts',
    action: 'Read the answer',
  },
  {
    title: 'How the Indexing API works',
    description: 'What the API supports, what a notification response means, when Google requires approval, and how it differs from URL Inspection.',
    icon: 'i-heroicons-book-open',
    to: '/google-indexing-api',
    action: 'Read the guide',
  },
  {
    title: 'Quota & rate limits',
    description: '200 publish requests a day, 180 metadata reads a minute, the Pacific Time reset, and how a tool\'s own limit differs.',
    icon: 'i-lucide-gauge',
    to: '/google-indexing-api-quota',
    action: 'Read limits',
  },
]

// A link before punctuation holds its text in `{{ }}`. Plain text on its own
// line keeps a trailing space inside the link, which renders "GitHub ."
const linkClass = 'underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors'
</script>

<template>
  <div>
    <ProAccountDeletedModal />

    <!-- Hero -->
    <div class="bg-verdant divider-tilt">
      <UContainer class="z-1 relative max-w-8xl xl:max-w-[1400px]" :ui="{ base: 'max-w-8xl xl:max-w-[1335px]!' }">
        <section class="py-5 sm:py-12 xl:py-20">
          <div class="xl:grid gap-8 lg:gap-12 xl:grid-cols-12 mx-auto w-full sm:px-6 lg:px-0 px-0">
            <div class="text-pretty mx-auto max-w-[50rem] xl:col-span-7 xl:ml-0 mb-10 xl:mb-0 flex flex-col justify-center">
              <div class="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] mb-6 mx-auto lg:mx-0 self-center lg:self-start">
                <span class="size-1.5 rounded-full bg-primary animate-pulse" />
                Start free &middot; Open source
              </div>
              <h1 class="font-title font-bold leading-[0.98] tracking-[-0.045em] text-default text-center text-6xl sm:text-7xl lg:text-left lg:text-[5rem] xl:text-[6rem] mb-6">
                Get your pages <span class="italic text-primary">indexed</span>.
                <HeroSvg />
              </h1>
              <p class="text-toned max-w-2xl text-center text-lg sm:text-xl lg:text-left mb-4 leading-relaxed">
                Send new and changed pages to Bing and other search engines with IndexNow, automatically once your key is verified. For Google, see which pages it indexed, and the reason it gives for the rest.
              </p>
              <p class="text-default max-w-2xl text-center text-base sm:text-lg lg:text-left mb-10 leading-relaxed font-medium">
                Nobody can force Google to index a page. Request Indexing shows what Google decided, and why.
              </p>

              <div class="flex flex-wrap items-center justify-center gap-3 sm:gap-4 lg:justify-start">
                <template v-if="!loggedIn">
                  <UButton to="/pro/onboarding" external rel="noopener" size="xl" color="primary" trailing-icon="i-heroicons-arrow-right">
                    <span>Get started<span class="hidden sm:inline"> free</span></span>
                  </UButton>
                </template>
                <template v-else>
                  <UButton to="/pro/dashboard" size="xl" color="primary">
                    <UAvatar :src="user?.avatarUrl || undefined" :alt="user?.name || user?.email || 'Account'" size="xs" />
                    Dashboard
                  </UButton>
                </template>
                <UButton size="xl" variant="ghost" color="neutral" icon="i-heroicons-magnifying-glass" to="/tools/google-indexing-checker">
                  Check one URL free
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
                      <span class="size-2 rounded-full bg-primary-400" />
                      <span class="text-xs text-muted">Example</span>
                    </div>
                  </div>
                  <!-- Mock URL rows: each shows Google's reason -->
                  <div class="divide-y divide-default bg-elevated">
                    <div
                      v-for="(item, i) in mockUrls"
                      :key="i"
                      class="px-5 py-3 flex items-start gap-2.5 text-sm group hover:bg-muted transition-colors animate-fade-in"
                      :style="{ '--stagger-index': i }"
                    >
                      <UIcon
                        :name="item.verdict === 'pass' ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-circle'"
                        class="size-4 shrink-0 mt-0.5"
                        :class="item.verdict === 'pass' ? 'text-primary' : 'text-amber-400'"
                      />
                      <div class="min-w-0 flex-1">
                        <div class="truncate text-toned font-mono text-xs">
                          {{ item.url }}
                        </div>
                        <div class="truncate text-xs mt-0.5" :class="item.verdict === 'pass' ? 'text-muted' : 'text-default font-medium'">
                          {{ item.status }}
                        </div>
                      </div>
                    </div>
                  </div>
                  <!-- Card footer -->
                  <div class="px-5 py-3 bg-muted border-t border-default flex items-center justify-between gap-4">
                    <span class="text-xs text-muted">5 of 119 sitemap URLs</span>
                    <span class="text-xs text-muted">Reason from URL Inspection</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </UContainer>
    </div>

    <div class="bg-default pt-20">
      <!-- Where Google's own button is -->
      <section class="max-w-7xl mx-auto px-6 lg:px-8 py-16 sm:py-24">
        <div class="grid lg:grid-cols-12 gap-8 lg:gap-16 items-start">
          <div class="lg:col-span-5">
            <span class="text-xs text-primary font-semibold uppercase tracking-[0.2em] mb-5 block">
              Where Google's own button is
            </span>
            <h2 class="font-title text-3xl sm:text-4xl lg:text-5xl font-semibold text-default tracking-[-0.035em] leading-[1.05]">
              Google's Request indexing button is in Search Console.
            </h2>
          </div>
          <div class="lg:col-span-7 space-y-6">
            <p class="text-toned text-lg leading-relaxed">
              Open URL Inspection in Search Console, paste the full URL, and select Request indexing. A request asks Google to crawl the URL. Google sets a daily limit on these requests.
            </p>
            <NuxtLink to="/request-indexing-google-search-console" class="group inline-flex items-center gap-2 font-medium text-primary">
              How to Request Indexing in Google Search Console
              <UIcon name="i-heroicons-arrow-right" class="size-4 shrink-0 group-hover:translate-x-1 transition-transform" />
            </NuxtLink>
            <p class="text-toned leading-relaxed border-l-2 border-primary/40 pl-4">
              Request Indexing reads Google's verdict for the URLs in your sitemaps, so you do not inspect them one by one.
            </p>
          </div>
        </div>
      </section>

      <!-- Why pages stop -->
      <section class="max-w-7xl mx-auto px-6 lg:px-8 py-16 sm:py-24 border-t border-default">
        <div class="max-w-3xl mb-10">
          <span class="text-xs text-primary font-semibold uppercase tracking-[0.2em] mb-5 block">
            Why pages stop
          </span>
          <h2 class="font-title text-4xl sm:text-5xl font-semibold text-default tracking-[-0.035em] leading-[1.05]">
            Find the stage where your pages stop.
          </h2>
          <p class="text-toned text-lg mt-6 leading-relaxed">
            The Why pages stop card follows your inspected URLs through four stages. Start at the biggest drop.
          </p>
        </div>

        <ol class="flex flex-wrap items-center gap-2 mb-10" aria-label="Indexing stages">
          <li v-for="(stage, i) in stopStages" :key="stage" class="flex items-center gap-2">
            <span class="inline-flex items-center gap-2 rounded-full border border-default bg-elevated px-3 py-1.5 text-sm font-medium text-default">
              <span class="font-mono text-xs text-muted">{{ i + 1 }}</span>
              {{ stage }}
            </span>
            <UIcon v-if="i < stopStages.length - 1" name="i-heroicons-arrow-right" class="size-4 text-muted shrink-0" />
          </li>
        </ol>

        <div class="rounded-2xl border border-default bg-elevated overflow-hidden">
          <table class="w-full text-left">
            <thead class="hidden sm:table-header-group bg-muted/60 border-b border-default">
              <tr>
                <th scope="col" class="px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted w-2/5">
                  Reason
                </th>
                <th scope="col" class="px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted">
                  First fix
                </th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="row in stopReasons" :key="row.reason" class="block sm:table-row">
                <th scope="row" class="block sm:table-cell px-5 sm:px-6 pt-4 sm:py-4 text-default font-semibold align-top">
                  {{ row.reason }}
                </th>
                <td class="block sm:table-cell px-5 sm:px-6 pt-1 pb-4 sm:py-4 text-toned align-top">
                  <span class="sm:hidden text-xs font-semibold uppercase tracking-[0.15em] text-muted block mb-1">First fix</span>
                  {{ row.fix }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-8">
          <UButton to="/pro/onboarding" external rel="noopener" size="lg" color="primary" variant="soft" trailing-icon="i-heroicons-arrow-right">
            See this for your Site
          </UButton>
        </div>
      </section>

      <!-- What you get -->
      <section class="max-w-7xl mx-auto px-6 lg:px-8 py-16 sm:py-24 border-t border-default">
        <div class="max-w-3xl mb-12">
          <span class="text-xs text-primary font-semibold uppercase tracking-[0.2em] mb-5 block">
            What you get
          </span>
          <h2 class="font-title text-4xl sm:text-5xl font-semibold text-default tracking-[-0.035em] leading-[1.05]">
            IndexNow for Bing and others. Google's reason for each sitemap URL.
          </h2>
        </div>

        <div class="grid sm:grid-cols-2 xl:grid-cols-5 gap-4 lg:gap-5">
          <div
            v-for="feature in features"
            :key="feature.title"
            class="rounded-2xl border border-default bg-elevated p-6 sm:last:col-span-2 xl:last:col-span-1"
          >
            <UIcon :name="feature.icon" class="size-7 text-primary mb-5" />
            <h3 class="font-title text-lg font-semibold text-default tracking-[-0.015em] mb-2 leading-snug">
              {{ feature.title }}
            </h3>
            <p class="text-toned text-sm leading-relaxed">
              {{ feature.description }}
            </p>
          </div>
        </div>

        <p class="text-toned text-sm mt-8 max-w-3xl">
          Request Indexing also keeps your Search Console history past Google's <NuxtLink to="https://gscdump.com/learn-google-search-console/limits/16-month-data-retention" target="_blank" :class="linkClass">
            {{ '16-month window' }}
          </NuxtLink>, within your Free allowance.
        </p>
      </section>

      <!-- How It Works -->
      <UPageSection
        headline="How it works"
        title="From Search Console to Google's answer in four steps"
        description="Connect Google once. After your IndexNow key is verified, Request Indexing sends new and changed sitemap URLs with IndexNow. It shows what Google reports for each URL."
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
                      View Search Console data for your verified sites
                    </p>
                  </div>
                </div>
                <!-- Step 2: Sites list -->
                <div v-else-if="i === 1" class="rounded-xl border border-default bg-elevated shadow-lg overflow-hidden">
                  <div class="px-5 py-3.5 border-b border-default flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <UIcon name="i-ph-globe-duotone" class="size-4 text-muted" />
                      <span class="text-sm font-semibold text-default">Your Sites</span>
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
                <!-- Step 3: the IndexNow protocol request -->
                <div v-else-if="i === 2" class="rounded-xl border border-default bg-elevated shadow-lg overflow-hidden">
                  <div class="flex items-center gap-2 px-5 py-3 border-b border-default bg-muted/60">
                    <UIcon name="i-heroicons-command-line" class="size-4 text-muted" />
                    <span class="text-xs font-mono text-muted truncate">POST api.indexnow.org/indexnow</span>
                    <UBadge color="neutral" variant="subtle" size="xs" class="ml-auto">
                      Example
                    </UBadge>
                  </div>
                  <pre class="px-5 py-5 text-xs sm:text-sm font-mono text-toned overflow-x-auto leading-relaxed min-w-0"><code><span class="text-muted"># The IndexNow request. Request Indexing sends it for you.</span>
<span class="text-primary">curl</span> <span class="text-default">-X POST</span> <span class="text-primary">https://api.indexnow.org/indexnow</span> \
  <span class="text-default">-H</span> <span class="text-toned">"Content-Type: application/json; charset=utf-8"</span> \
  <span class="text-default">--data</span> <span class="text-toned">'{
    "host": "www.example.com",
    "key": "8d7a3c1e6f2b4a90",
    "urlList": [
      "https://www.example.com/blog/new-post",
      "https://www.example.com/pricing"
    ]
  }'</span></code></pre>
                </div>
                <!-- Step 4: URL Inspection changes -->
                <div v-else class="rounded-xl border border-default bg-elevated shadow-lg overflow-hidden">
                  <div class="px-5 py-3.5 border-b border-default flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <UIcon name="i-heroicons-arrows-right-left" class="size-4 text-muted" />
                      <span class="text-sm font-semibold text-default">What changed</span>
                    </div>
                    <span class="text-xs text-muted">Example</span>
                  </div>
                  <div class="divide-y divide-default">
                    <div v-for="change in mockChanges" :key="change.url" class="px-5 py-3.5 flex items-start gap-3 text-sm" :class="change.indexed ? 'bg-primary/5' : ''">
                      <UIcon
                        :name="change.indexed ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-circle'"
                        class="size-4 shrink-0 mt-0.5"
                        :class="change.indexed ? 'text-primary' : 'text-amber-400'"
                      />
                      <div class="flex-1 min-w-0">
                        <div class="text-default font-mono text-xs truncate font-medium">
                          {{ change.url }}
                        </div>
                        <div class="text-xs text-muted mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                          <span>{{ change.from }}</span>
                          <UIcon name="i-heroicons-arrow-right" class="size-3 shrink-0" />
                          <span class="text-toned">{{ change.to }}</span>
                        </div>
                      </div>
                      <UBadge :color="change.indexed ? 'primary' : 'neutral'" variant="subtle" size="xs" class="shrink-0">
                        {{ change.indexed ? 'Indexed' : 'Not indexed' }}
                      </UBadge>
                    </div>
                  </div>
                  <div class="px-5 py-3 bg-muted/60 border-t border-default">
                    <span class="text-xs text-muted">Illustrative example. Each row is a change in Google's URL Inspection result.</span>
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
        description="Three single-purpose tools for a quick answer. No account and no email."
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
            View all free indexing checkers
          </UButton>
        </div>
      </UPageSection>

      <!-- Learn section: featured + supporting -->
      <section class="max-w-7xl mx-auto px-6 lg:px-8 py-16 sm:py-24">
        <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12 lg:mb-16">
          <div class="max-w-2xl">
            <span class="text-xs text-primary font-semibold uppercase tracking-[0.2em] mb-5 block">
              Learn
            </span>
            <h2 class="font-title text-4xl sm:text-5xl font-semibold text-default tracking-[-0.035em] leading-[1.05]">
              Learn how to ask Google, and how to read its answer.
            </h2>
          </div>
          <UButton
            to="/guides"
            variant="ghost"
            color="neutral"
            trailing-icon="i-heroicons-arrow-right"
            class="self-start lg:self-auto"
          >
            Browse all guides
          </UButton>
        </div>

        <div class="grid lg:grid-cols-3 gap-4 lg:gap-5">
          <!-- Featured -->
          <NuxtLink
            to="/request-indexing-google-search-console"
            class="lg:row-span-3 rounded-2xl border border-default bg-elevated p-8 sm:p-10 group relative overflow-hidden flex flex-col justify-between min-h-[320px]"
          >
            <div class="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent pointer-events-none" />
            <div class="relative">
              <UBadge color="primary" variant="subtle" size="sm" class="mb-6">
                Start here
              </UBadge>
              <h3 class="font-title text-2xl sm:text-3xl font-semibold text-default tracking-[-0.02em] mb-3 leading-[1.1]">
                How to Request Indexing in Google Search Console
              </h3>
              <p class="text-toned leading-relaxed max-w-md">
                Request indexing for one URL with Search Console's URL Inspection tool: the steps, who can do it, the daily limit, and what a request does not prove.
              </p>
            </div>
            <div class="relative flex items-center gap-2 mt-8 text-primary font-medium">
              Read the guide
              <UIcon name="i-heroicons-arrow-right" class="size-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </NuxtLink>

          <!-- Supporting -->
          <NuxtLink
            v-for="guide in learnGuides"
            :key="guide.to"
            :to="guide.to"
            class="rounded-2xl border border-default bg-elevated p-6 sm:p-7 group"
          >
            <UIcon :name="guide.icon" class="size-7 text-primary mb-5" />
            <h3 class="font-title text-lg font-semibold text-default tracking-[-0.015em] mb-1.5">
              {{ guide.title }}
            </h3>
            <p class="text-toned text-sm leading-relaxed mb-4">
              {{ guide.description }}
            </p>
            <div class="flex items-center gap-1.5 text-sm text-primary font-medium">
              {{ guide.action }}
              <UIcon name="i-heroicons-arrow-right" class="size-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </NuxtLink>
        </div>

        <p class="text-toned mt-8 max-w-2xl">
          Weighing another tool? Read <NuxtLink to="/comparisons" :class="linkClass">
            how Request Indexing compares with Indexly and SEO Gets
          </NuxtLink> or what replaces the closed Tag Parrot.
        </p>
      </section>

      <!-- Trust -->
      <section class="max-w-7xl mx-auto px-6 lg:px-8 py-16 sm:py-20 border-y border-default">
        <div class="grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          <div class="lg:col-span-5">
            <span class="text-xs text-primary font-semibold uppercase tracking-[0.2em] mb-5 block">
              Built in the open
            </span>
            <h2 class="font-title text-3xl sm:text-4xl font-semibold text-default tracking-[-0.03em] leading-[1.1]">
              Who builds it, and what it can touch.
            </h2>
          </div>
          <div class="lg:col-span-7 grid sm:grid-cols-2 gap-8 lg:gap-10">
            <div>
              <UIcon name="i-simple-icons-github" class="size-6 text-primary mb-3" />
              <div class="font-title text-base font-semibold text-default mb-1.5 tracking-[-0.01em]">
                Open source, MIT
              </div>
              <p class="text-muted text-sm leading-relaxed">
                Read every line on <NuxtLink to="https://github.com/harlan-zw/requestindexing.com" target="_blank" :class="linkClass">
                  {{ 'GitHub' }}
                </NuxtLink>.
              </p>
            </div>
            <div>
              <UIcon name="i-heroicons-user-circle" class="size-6 text-primary mb-3" />
              <div class="font-title text-base font-semibold text-default mb-1.5 tracking-[-0.01em]">
                Built by Harlan Wilton
              </div>
              <p class="text-muted text-sm leading-relaxed">
                Maintainer of <NuxtLink to="https://nuxtseo.com" target="_blank" :class="linkClass">
                  {{ 'Nuxt SEO' }}
                </NuxtLink>. Building Request Indexing since 2024.
              </p>
            </div>
            <div>
              <UIcon name="i-heroicons-key" class="size-6 text-primary mb-3" />
              <div class="font-title text-base font-semibold text-default mb-1.5 tracking-[-0.01em]">
                What it changes in Search Console
              </div>
              <p class="text-muted text-sm leading-relaxed">
                We read your Search Console data. The only changes we make there are a sitemap submission and a property you add and verify.
              </p>
            </div>
            <div>
              <UIcon name="i-heroicons-trash" class="size-6 text-primary mb-3" />
              <div class="font-title text-base font-semibold text-default mb-1.5 tracking-[-0.01em]">
                Delete any time
              </div>
              <p class="text-muted text-sm leading-relaxed">
                Deleting your account removes every Team you own and all Sites and data in them. You also lose access to Teams you joined. Google can keep the access you gave Request Indexing. Remove it in your <NuxtLink to="https://myaccount.google.com/connections" target="_blank" :class="linkClass">
                  {{ 'Google Account' }}
                </NuxtLink>.
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
        <UAccordion :items="faqItems" type="multiple" />
      </UPageSection>

      <!-- CTA -->
      <UPageSection :ui="{ container: 'max-w-4xl' }">
        <UPageCTA
          title="Find out which of your pages Google has indexed"
          description="Free and open source."
          variant="subtle"
          :links="[
            { label: 'Get started free', to: '/pro/onboarding', color: 'primary', size: 'xl', trailingIcon: 'i-heroicons-arrow-right' },
            { label: 'View on GitHub', to: 'https://github.com/harlan-zw/requestindexing.com', target: '_blank', variant: 'ghost', color: 'neutral', size: 'xl', icon: 'i-simple-icons-github' },
          ]"
        />
      </UPageSection>
    </div>
  </div>
</template>
