<script setup lang="ts">
const toast = useToast()
const links = [
  {
    label: 'Request Indexing',
    children: [
      {
        label: 'Get started',
        to: '/pro/onboarding',
      },
    ],
  },
  {
    label: 'Guides',
    children: [
      {
        label: 'Google Indexing API',
        to: '/google-indexing-api',
      },
      {
        label: 'Setup Tutorial',
        to: '/google-indexing-api-tutorial',
      },
      {
        label: 'Node.js Guide',
        to: '/google-indexing-api-node-js',
      },
      {
        label: 'Bulk URL Submission',
        to: '/bulk-submit-urls-google-indexing-api',
      },
      {
        label: 'API for Blog Posts',
        to: '/indexing-api-for-blog-posts',
      },
      {
        label: 'Quota & Rate Limits',
        to: '/google-indexing-api-quota',
      },
    ],
  },
  {
    label: 'Tools',
    children: [
      {
        label: 'Google Index Checker',
        to: '/tools/google-indexing-checker',
      },
      {
        label: 'Bulk Indexing Checker',
        to: '/tools/bulk-indexing-checker',
      },
      {
        label: 'Site Indexing Report',
        to: '/tools/site-indexing-report',
      },
    ],
  },
  {
    label: 'Resources',
    children: [
      {
        label: 'Docs',
        to: 'https://github.com/harlan-zw/requestindexing.com',
        target: '_blank',
      },
      {
        label: 'Privacy',
        to: '/privacy',
      },
      {
        label: 'Terms',
        to: '/terms',
      },
    ],
  },
  {
    label: 'Project',
    children: [
      {
        label: 'Report a bug',
        to: 'https://github.com/harlan-zw/requestindexing.com/issues/new?assignees=&labels=pending+triage&projects=&template=bug_report.yml',
        target: '_blank',
      },
      {
        label: 'Roadmap',
        to: 'https://github.com/harlan-zw/requestindexing.com/issues?q=is%3Aopen+label%3Aenhancement+sort%3Aupdated-desc',
        target: '_blank',
      },
      {
        label: 'Changelog',
        to: 'https://github.com/harlan-zw/requestindexing.com/releases',
        target: '_blank',
      },
      {
        label: 'Built on gscdump',
        to: 'https://gscdump.com',
        target: '_blank',
      },
      {
        label: 'Built with Nuxt UI Pro',
        to: 'https://ui.nuxt.com/pro?aff=5zj9e',
        target: '_blank',
      },
    ],
  },
]

interface JSConfettiApi {
  addConfetti: (options?: { emojis: string[] }) => void
}
declare global {
  interface Window {
    JSConfetti: { new (): JSConfettiApi }
  }
}
function toaster() {
  const $script = useScript<JSConfettiApi>({
    key: 'confetti',
    src: 'https://cdn.jsdelivr.net/npm/js-confetti@latest/dist/js-confetti.browser.js',
  }, {
    use() {
      return new window.JSConfetti()
    },
  })
  $script.proxy.addConfetti({ emojis: ['🍞'] })
  toast.add({
    title: 'So you like easters eggs? 🥚',
    description: 'How about some bread? 🍞',
  })
}
</script>

<template>
  <!-- The top slot ships no gutter of its own, so the first column sat flush
       against the viewport edge. These match the page container. -->
  <UFooter :ui="{ top: 'px-4 sm:px-6 lg:px-8' }">
    <template #top>
      <UFooterColumns :columns="links" />
    </template>

    <template #left>
      <p class="text-muted text-sm">
        Copyright © {{ new Date().getFullYear() }}. All rights reserved.
      </p>
    </template>

    <template #right>
      <UButton color="neutral" title="Bread" variant="link" target="_blank" class="group" @click="toaster">
        <div class="hidden group-hover:block h-0">
          <Icon name="noto:bread" class="text-xl  " />
        </div>
      </UButton>

      <UColorModeButton size="sm" />

      <UButton color="neutral" title="Twitter" variant="link" to="https://twitter.com/harlan_zw" target="_blank">
        <UIcon name="i-simple-icons-twitter" class="text-xl" />
      </UButton>
      <UButton color="neutral" title="GitHub" aria-label="GitHub" variant="link" to="https://github.com/harlan-zw/requestindexing.com" target="_blank">
        <UIcon name="i-simple-icons-github" class="text-xl" />
      </UButton>
      <UButton color="neutral" title="Discord" aria-label="Discord" variant="link" to="https://discord.gg/275MBUBvgP" target="_blank">
        <UIcon name="i-simple-icons-discord" class="text-xl" />
      </UButton>
    </template>
  </UFooter>
</template>
