<script setup lang="ts">
import { WEBMASTER_TOOLS, WEBMASTER_TOOLS_TABS } from '@nuxtseo/pro-search/shared/navigation'

const { siteId } = useSite(WEBMASTER_TOOLS.label)
const tabs = computed(() => WEBMASTER_TOOLS_TABS.map(tab => ({
  label: tab.label,
  to: `/pro/dashboard/sites/${encodeURIComponent(siteId.value)}/webmaster-tools${tab.path}`,
})))
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4">
    <UiTabs kind="page" :links="tabs" :aria-label="WEBMASTER_TOOLS.label" />
    <NuxtPage />
  </div>
</template>
