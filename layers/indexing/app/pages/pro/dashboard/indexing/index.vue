<script setup lang="ts">
import FleetIndexingPortfolio from '#layers/indexing/app/internal/components/fleet/FleetIndexingPortfolio.vue'

definePageMeta({
  layout: 'pro-dashboard',
  title: 'Indexing',
  icon: 'i-ph-list-checks-duotone',
  description: 'See the indexing status of every connected Site.',
})

useSeoMeta({ title: 'Indexing' })
</script>

<template>
  <FleetIndexingPortfolio tab="overview" />
</template>
