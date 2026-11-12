<script setup lang="ts">
import type { SiteFleetRow } from '~~/layers/core/app/types/data'
import type { DeveloperApiKeysState } from '#layers/pro-gsc/shared/developer-api-keys'
import type { FreeAllowanceView } from '#layers/pro-gsc/shared/free-allowance'
import ProShellSetupOffers from '@nuxtseo/pro-shell/app/components/ProShellSetupOffers.vue'
import { readProShellConfig, useProShellCopy } from '@nuxtseo/pro-shell/app/composables/useProShellCopy'
import { useProShellSetupDismissals } from '@nuxtseo/pro-shell/app/composables/useProShellSetupDismissals'
import { buildSharedSetupOffers } from '@nuxtseo/pro-shell/shared/setup-offers'
import { useProBingIntegration } from '#layers/pro-gsc/app/composables/useProGscdump'
import { developerSetupCompletion } from '#layers/pro-gsc/shared/developer-setup'
import { anotherSiteCompletion, bingSetupCompletion } from '#layers/pro-saas/app/utils/overview-setup-offers'

/**
 * "Finish setting up" on the dashboard home: `@nuxtseo/pro-shell`'s five
 * shared offers, each with its Setup completion from a read this app already
 * makes. The agent skill, MCP and API offers read the Developers page's API
 * key state, Bing reads the Integrations row, and Add another Site reads the
 * Site count against the Free allowance. Every read is client-only, and the
 * cards wait until all of them land, so none reshuffles.
 */
const { sites } = defineProps<{ sites: readonly SiteFleetRow[] }>()

const proFetch = useProFetch()
const { data: keysState, status: keysStatus } = useLazyFetch<DeveloperApiKeysState>('/api/pro/developer/api-keys', {
  $fetch: proFetch,
  server: false,
})
const { data: usage, status: usageStatus } = useLazyFetch<{ allowance: FreeAllowanceView }>('/api/pro/usage', {
  $fetch: proFetch,
  server: false,
})
const bing = useProBingIntegration(() => sites)

const routes = readProShellConfig().routes ?? {}
const copy = useProShellCopy().setupOffers
const { dismissedKeys, dismiss } = useProShellSetupDismissals()

// A failed read is no data: its offers show no card rather than a guess.
const keys = computed(() => keysStatus.value === 'error' ? { _tag: 'SearchConsoleRequired' as const } : keysState.value ?? null)
const allowance = computed<FreeAllowanceView | null>(() => usageStatus.value === 'error' ? { _tag: 'Unavailable' } : usage.value?.allowance ?? null)

const offers = computed(() => {
  const developer = developerSetupCompletion(keys.value)
  return buildSharedSetupOffers({
    routes,
    copy,
    site: null,
    completion: {
      'skill': developer.skill,
      'mcp': developer.mcp,
      'api': developer.api,
      'bing': bingSetupCompletion(bing.state.value),
      'another-site': anotherSiteCompletion({ siteCount: sites.length, allowance: allowance.value }),
    },
  })
})
const loading = computed(() => offers.value.some(offer => offer.completion._tag === 'unknown'))
</script>

<template>
  <ProShellSetupOffers :offers="offers" :dismissed="dismissedKeys" :loading="loading" @dismiss="dismiss">
    <template #site-mark>
      <OgBrand :size="16" semantic />
    </template>
  </ProShellSetupOffers>
</template>
