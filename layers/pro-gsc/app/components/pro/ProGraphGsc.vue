<script lang="ts" setup>
import type { SearchConsoleTrendProps } from '@nuxtseo/pro-search/shared/search-console-trend'
import SearchConsoleTrend from '@nuxtseo/pro-search/components/SearchConsoleTrend.vue'

const { loading: loadingProp, ...props } = defineProps<SearchConsoleTrendProps>()
const devSkeleton = useProDevSkeleton()
const loading = computed(() => loadingProp || devSkeleton.value)
</script>

<template>
  <SearchConsoleTrend
    v-bind="props"
    :loading="loading"
  />
</template>
