<script setup lang="ts">
useSeoMeta({
  title: 'Terms of Service',
  description: 'Terms for using Request Indexing and its free indexing checkers.',
})
</script>

<template>
  <UContainer>
    <UPage>
      <UPageHeader title="Terms of Service" description="Terms for using Request Indexing and its free indexing checkers." />
      <UPageBody class="prose">
        <h2>Agreement to terms</h2>
        <p>By using Request Indexing, you agree to these terms and to <a href="https://developers.google.com/terms" rel="noopener" target="_blank">Google's API Terms of Service</a> where they apply.</p>

        <h2>Your data</h2>
        <p>You own the Sites and data you connect. You can delete your account from your Account page at any time. Deleting your account removes every Team you own and all Sites and data in them, and queues cleanup of your record on gscdump.com. Google can keep the access you gave Request Indexing until you remove it in your <a href="https://myaccount.google.com/connections" rel="noopener" target="_blank">Google Account</a>.</p>

        <h2>Usage rules</h2>
        <p>Use Request Indexing responsibly:</p>
        <ul>
          <li>Do not abuse rate limits, scrape the service, or interfere with other users.</li>
          <li>Only submit Google Indexing API notifications for pages that meet Google's documented eligibility rules.</li>
        </ul>

        <h2>Service changes</h2>
        <p>Request Indexing is in beta and may change over time. We post significant changes on the site or notify signed-in users.</p>

        <h2>Account termination</h2>
        <p>We may suspend or terminate access if an account misuses the service or breaches these terms.</p>

        <h2>Liability and warranty</h2>
        <p>Request Indexing is provided "as is" with no warranty of any kind. Sending a notification does not guarantee that a search engine will crawl or index a page. We limit our liability to the fullest extent permitted by law.</p>

        <h2>Dispute resolution</h2>
        <p>If you have an issue, email <a href="mailto:harlan@harlanzw.com">harlan@harlanzw.com</a> so we can resolve it directly.</p>

        <h2>Updates to these terms</h2>
        <p>We post updates on this page and notify signed-in users of major changes.</p>

        <h2>Contact</h2>
        <p>Send questions or feedback to <a href="mailto:harlan@harlanzw.com">harlan@harlanzw.com</a>.</p>
      </UPageBody>
    </UPage>
  </UContainer>
</template>
