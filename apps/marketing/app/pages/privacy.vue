<script setup lang="ts">
useSeoMeta({
  title: 'Privacy Policy',
  description: 'How Request Indexing collects, stores, and deletes your account and site data.',
})
</script>

<template>
  <UContainer>
    <UPage>
      <UPageHeader title="Privacy Policy" description="How Request Indexing collects, stores, and deletes your account and site data." />
      <UPageBody class="prose">
        <h2>What we collect</h2>
        <p>When you sign in with Google or GitHub, Request Indexing stores your name, email address, avatar URL, and provider account ID. If you connect a Site or answer the optional About you card, we store your Team, Site list, and optional onboarding answers.</p>
        <p>
          The free tools at <NuxtLink to="/tools">
            /tools
          </NuxtLink> work without an account. We hash your IP address for rate limiting and DataForSEO spend accounting.
        </p>

        <h2>How we use your data</h2>
        <p>We use your data to keep you signed in, show Search Console and Bing evidence for the Sites you connect, send the Indexing API and IndexNow notifications you trigger, send account and onboarding emails, and diagnose production errors.</p>

        <h2>Cookies and browser storage</h2>
        <p>When you sign in, Request Indexing sets the <code>nuxt-auth-session</code> cookie to keep you signed in. It lasts up to 90 days.</p>
        <p>The <code>pro-first-touch</code> cookie records how you first reached Request Indexing: the kind of page you landed on, such as the home page, a tool, or a guide, the time, the domain of the site that linked you, and any campaign tags (<code>utm_</code> values) in the link. It holds no URL you checked, no full referrer address, and no other part of the query string. It lasts up to 30 days. Request Indexing reads it only when a sign-in creates your account, and saves its values with your signup record. Each sign-in deletes the cookie. A later visit can set it again.</p>
        <p>During Google or GitHub sign-in, short-lived cookies (<code>auth-source</code>, <code>auth-redirect</code>, and <code>auth-intent</code>) last up to 10 minutes to finish the OAuth redirect. Dashboard preferences, such as sidebar collapse state and date filters, and recent free-tool checks are stored in your browser.</p>

        <h2>Analytics</h2>
        <p>We use <a href="https://usefathom.com/" rel="nofollow noopener" target="_blank">Fathom Analytics</a> for cookieless, aggregate traffic counts.</p>

        <h2>Services that receive data</h2>
        <p><a href="https://gscdump.com/" rel="noopener" target="_blank">gscdump.com</a>: Request Indexing runs on gscdump.com. When you connect Google Search Console, the Google Indexing API, or Bing Webmaster Tools, Request Indexing sends gscdump.com your account details and the access you gave. gscdump.com reads and stores your Search Console and Bing data, and runs URL Inspection, sitemap, Google Indexing API, and IndexNow work for your Sites.</p>
        <p>
          <a href="https://dataforseo.com/" rel="nofollow noopener" target="_blank">DataForSEO</a>: The free tools at <NuxtLink to="/tools">
            /tools
          </NuxtLink> send each URL or domain they check to DataForSEO, which runs a Google <code>site:</code> search for it. The Site Indexing Report also reads traffic and keyword estimates for the domain from DataForSEO.
        </p>
        <p><a href="https://postmarkapp.com/" rel="nofollow noopener" target="_blank">Postmark</a>: Postmark delivers the emails Request Indexing sends, such as onboarding emails, Free allowance emails, and Team invitations. It receives the recipient's email address and the message.</p>
        <p><a href="https://www.cloudflare.com/" rel="nofollow noopener" target="_blank">Cloudflare</a>: Request Indexing runs on Cloudflare Workers, D1, KV, Queues, and Durable Objects. Request logs and application storage run on Cloudflare.</p>
        <p><a href="https://sentry.io/" rel="nofollow noopener" target="_blank">Sentry</a>: Sentry receives client and server error reports from production so we can fix bugs.</p>
        <p>Google and GitHub: You sign in with Google or GitHub OAuth. Google also provides Search Console, Site Verification, and the Indexing API when you grant access. When you connect Bing Webmaster Tools and link a Site, gscdump.com reads Bing crawl and performance data for that Site.</p>

        <h2>Deleting your account</h2>
        <p>You can delete your account from your Account page at any time. Deleting your account removes every Team you own and all Sites and data in them. You also lose access to Teams you joined.</p>
        <p>gscdump.com, which Request Indexing runs on, deletes the record it keeps for your account. Your API keys stop working.</p>
        <p>Google can keep the access you gave Request Indexing. Remove it in your <a href="https://myaccount.google.com/connections" rel="noopener" target="_blank">Google Account</a>.</p>

        <h2>Changes to this policy</h2>
        <p>We post updates on this page. For major changes, we notify signed-in users by email or an in-app notice.</p>

        <h2>Questions</h2>
        <p>Email <a href="mailto:harlan@harlanzw.com">harlan@harlanzw.com</a> with questions about this privacy policy or your data.</p>
      </UPageBody>
    </UPage>
  </UContainer>
</template>
