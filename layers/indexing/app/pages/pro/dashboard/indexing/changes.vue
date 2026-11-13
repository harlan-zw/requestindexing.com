<script setup lang="ts">
import FleetIndexingPortfolio from '#layers/indexing/app/internal/components/fleet/FleetIndexingPortfolio.vue'

definePageMeta({
  layout: 'pro-dashboard',
  title: 'Indexing',
  icon: 'i-ph-list-checks-duotone',
  description: 'See which URLs Google indexed or dropped across your Sites.',
})

useSeoMeta({ title: 'Indexing changes' })
</script>

<template>
  <FleetIndexingPortfolio tab="changes" />
</template>
