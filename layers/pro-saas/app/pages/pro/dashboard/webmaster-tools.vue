<script setup lang="ts">
import { WEBMASTER_TOOLS } from '@nuxtseo/pro-search/shared/navigation'
import { fetchSites } from '~~/layers/core/app/composables/fetch'
import { useProBingIntegration } from '#layers/pro-gsc/app/composables/useProGscdump'
import ProBingIntegrationCard from '#layers/pro-gsc/app/internal/components/bing/ProBingIntegrationCard.vue'

definePageMeta({ layout: 'pro-dashboard', title: 'Webmaster Tools', icon: 'bing' })

const { data } = await fetchSites()
const bing = useProBingIntegration(() => data.value?.sites ?? [])
</script>

<template>
  <section class="min-w-0 space-y-4">
    <h1 class="text-2xl font-semibold">
      {{ WEBMASTER_TOOLS.label }}
    </h1>
    <ProBingIntegrationCard :bing="bing" />
  </section>
</template>
