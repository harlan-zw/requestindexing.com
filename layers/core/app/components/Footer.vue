<script setup lang="ts">
import { GUIDE_NAV_ITEMS } from '#shared/guides-nav'
import { FREE_TOOLS } from '#shared/tool-registry'

// Ported from nuxtseo.com. The payload carries the server's year to the client,
// so a reader past midnight on 1 January in another zone hydrates the same text.
const currentYear = useState('footer-current-year', () => new Date().getUTCFullYear())
const links = [
  {
    label: 'Request Indexing',
    children: [
      {
        label: 'Get started',
        to: '/pro/onboarding',
      },
      {
        label: 'Use an AI agent: gscdump',
        to: 'https://gscdump.com/mcp',
        target: '_blank',
      },
    ],
  },
  {
    label: 'Guides',
    children: GUIDE_NAV_ITEMS.map(({ label, to }) => ({ label, to })),
  },
  {
    label: 'Tools',
    children: FREE_TOOLS.map(({ title, path }) => ({ label: title, to: path })),
  },
  {
    label: 'Resources',
    children: [
      {
        label: 'Comparisons',
        to: '/comparisons',
      },
      {
        label: 'Source code',
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
        label: 'Built with Nuxt UI',
        to: 'https://ui.nuxt.com',
        target: '_blank',
      },
    ],
  },
]
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
        Copyright © {{ currentYear }} Harlan Wilton. MIT licensed.
      </p>
    </template>

    <template #right>
      <UColorModeButton size="sm" />

      <UButton color="neutral" v-bind="{ title: 'X (Twitter)' } satisfies { title: string }" aria-label="X (Twitter)" variant="link" to="https://x.com/harlan_zw" target="_blank">
        <UIcon name="i-simple-icons-x" class="text-lg" />
      </UButton>
      <UButton color="neutral" v-bind="{ title: 'GitHub' } satisfies { title: string }" aria-label="GitHub" variant="link" to="https://github.com/harlan-zw/requestindexing.com" target="_blank">
        <UIcon name="i-simple-icons-github" class="text-xl" />
      </UButton>
      <UButton color="neutral" v-bind="{ title: 'Discord' } satisfies { title: string }" aria-label="Discord" variant="link" to="https://discord.gg/275MBUBvgP" target="_blank">
        <UIcon name="i-simple-icons-discord" class="text-xl" />
      </UButton>
    </template>
  </UFooter>
</template>
