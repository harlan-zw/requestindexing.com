<script setup lang="ts">
definePageMeta({
  middleware: to => navigateTo({
    path: `/pro/dashboard/sites/${encodeURIComponent(String(to.params.id))}/webmaster-tools/crawl`,
    query: to.query,
    hash: to.hash,
  }, { redirectCode: 301 }),
})
</script>

<template>
  <div />
</template>
