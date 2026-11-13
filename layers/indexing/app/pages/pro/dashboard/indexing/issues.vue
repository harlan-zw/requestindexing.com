<script setup lang="ts">
import FleetIndexingPortfolio from '#layers/indexing/app/internal/components/fleet/FleetIndexingPortfolio.vue'

definePageMeta({
  layout: 'pro-dashboard',
  title: 'Indexing',
  icon: 'i-ph-list-checks-duotone',
  description: 'See which indexing issues affect your Sites.',
})

useSeoMeta({ title: 'Indexing issues' })
</script>

<template>
  <FleetIndexingPortfolio tab="issues" />
</template>
