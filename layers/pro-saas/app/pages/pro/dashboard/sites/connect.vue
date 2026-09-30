<script lang="ts" setup>
import { CONNECT_SITE_ROUTE } from '#layers/pro-saas/shared/onboarding'

// Connect a Site after onboarding, nuxtseo.com's separate add page cut to this
// app. Every "Connect a Site" control opens this route. It used to hold the v0
// picker, which listed Sites the user already had and created none, so a
// finished user had no way to connect a new Site.
definePageMeta({
  layout: 'pro-dashboard',
  title: 'Connect a Site',
  icon: 'i-heroicons-plus-circle',
})

// The sidebar and Manage Sites read the `sites` key. Refresh it so the new
// Site shows there without a reload.
async function onConnected() {
  await refreshNuxtData('sites')
}
</script>

<template>
  <div class="max-w-2xl space-y-5">
    <p class="text-sm text-muted">
      Name the address you want tracked. We match it to a Search Console property for you.
    </p>
    <UCard>
      <ProSiteAddForm :gsc-return-to="CONNECT_SITE_ROUTE" @connected="onConnected" />
    </UCard>
  </div>
</template>
