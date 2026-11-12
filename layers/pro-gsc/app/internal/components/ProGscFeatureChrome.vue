<script lang="ts" setup>
// Mounted by pro-features above the body for any GSC-backed feature
// (search-console, indexing, analysis). Replaces the inline
// <ProGscSyncAlert /> + <ProGscSyncProgressBar /> pairs that were repeated
// across each feature's parent page.
//
// Registered in app/plugins/pro-features-register.client.ts.

import type { FeatureDataState } from '#layers/pro-features/shared/types'
import ProGscSyncAlert from '#layers/pro-gsc/app/components/pro/ProGscSyncAlert.vue'
import ProGscSyncProgressBar from '#layers/pro-gsc/app/components/pro/ProGscSyncProgressBar.vue'

defineProps<{ siteId: string, state: FeatureDataState }>()
</script>

<template>
  <div class="contents">
    <ProGscSyncAlert :site-id="siteId" />
    <ProGscSyncProgressBar :site-id="siteId" />
  </div>
</template>
