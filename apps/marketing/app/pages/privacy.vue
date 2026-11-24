<script setup lang="ts">
useSeoMeta({
  title: 'Privacy Policy',
  description: 'We value your privacy and want to be transparent about how we handle your information.',
})
</script>

<template>
  <UContainer>
    <UPage>
      <UPageHeader title="Privacy Policy" description="We value your privacy and want to be transparent about how we handle your information." />
      <UPageBody class="prose ">
        <h2>What We Collect</h2>
        <p>We gather some basic info to make our service work better for you. This includes stuff like your email address and how you use our site. We only collect what’s necessary to improve your experience.</p>

        <h2>How We Use Your Data</h2>
        <p>Your data helps us personalize your experience and keep things running smoothly. We use it to fix bugs, improve functionality, and keep you logged in so you don’t have to bother entering your details every time.</p>

        <h2>Cookies</h2>
        <p>Yes, we use cookies. You can manage them in your browser settings if you like.</p>
        <p>When you sign in, Request Indexing sets the <code>nuxt-auth-session</code> cookie to keep you signed in. It lasts up to 90 days.</p>
        <p>The <code>pro-first-touch</code> cookie records how you first reached Request Indexing: the kind of page you landed on, such as the home page, a tool, or a guide, the time, the domain of the site that linked you, and any campaign tags (<code>utm_</code> values) in the link. It holds no URL you checked, no full referrer address, and no other part of the query string. It lasts up to 30 days. Request Indexing reads it only when a sign-in creates your account, and saves its values with your signup record. Each sign-in deletes the cookie. A later visit can set it again.</p>

        <h2>Analytics</h2>
        <p>We use the anonymous analytics provided by <a href="https://usefathom.com/" rel="nofollow" target="_blank">Fathom Analytics</a> to see how our tool is doing. This helps us scale and improve without getting nosy.</p>

        <h2>Services that receive data</h2>
        <p><a href="https://gscdump.com/" target="_blank">gscdump.com</a>: Request Indexing runs on gscdump.com. When you connect Google Search Console, Request Indexing sends gscdump.com your Google account ID, email address, and name, and the Google access you gave. gscdump.com reads and stores your Search Console data, and runs URL Inspection, sitemap, and IndexNow work for your Sites.</p>
        <p>
          <a href="https://dataforseo.com/" rel="nofollow" target="_blank">DataForSEO</a>: The free tools at <NuxtLink to="/tools">
            /tools
          </NuxtLink> send each URL or domain they check to DataForSEO, which runs a Google <code>site:</code> search for it. The Site Indexing Report also reads traffic and keyword estimates for the domain from DataForSEO.
        </p>
        <p><a href="https://postmarkapp.com/" rel="nofollow" target="_blank">Postmark</a>: Postmark delivers the emails Request Indexing sends, such as onboarding emails, Free allowance emails, and Team invitations. It receives the recipient's email address and the message.</p>

        <h2>Your Rights</h2>
        <p>You’ve got control over your info. Want to delete your account or see what data we have on you? Just hit the button on your account page or reach out to us.</p>

        <h2>Keeping Your Data Safe</h2>
        <p>We take your privacy seriously. We don’t collect sensitive info, and we encrypt authentication tokens to keep them secure. Your trust is important to us.</p>

        <h2>Changes to This Policy</h2>
        <p>We’ll let you know about any major changes to this policy via email or a notice on our site. It’s a good idea to review this page periodically to stay informed.</p>

        <h2>Got Questions?</h2>
        <p>If you have any questions about this privacy policy or how we handle your data, feel free to reach out at <a href="mailto:harlan@harlanzw.com">harlan@harlanzw.com</a>.</p>
      </UPageBody>
    </UPage>
  </UContainer>
</template>
