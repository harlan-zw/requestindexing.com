import type { Ref } from 'vue'
import type { FeatureDataState } from '../../../pro-shell/shared/types'
import { computed } from 'vue'
import { searchConsoleLinkCta } from '../utils/site-search-state'
import { useProGscStatus } from './useProGscStatus'

interface GscFeatureDataStateOptions {
  beforeMinimumData?: () => FeatureDataState | null | undefined
  includeStale?: boolean
}

export function useGscFeatureDataState(
  siteId: Ref<string>,
  options: GscFeatureDataStateOptions = {},
): Ref<FeatureDataState> {
  const status = useProGscStatus(siteId)
  const { session } = useUserSession()

  return computed<FeatureDataState>(() => {
    if (status.isNotConnected.value || status.isTokenRevoked.value) {
      return {
        status: 'unconnected',
        cta: searchConsoleLinkCta(!!session.value?.gscConnected),
      }
    }
    if (status.hasError.value)
      return { status: 'error', error: status.error.value }
    if (status.isProcessing.value)
      return { status: 'syncing', progress: status.data.value?.syncProgress?.percent }

    const beforeMinimumData = options.beforeMinimumData?.()
    if (beforeMinimumData)
      return beforeMinimumData

    if (!status.hasMinimumData.value)
      return { status: 'partial', missing: ['historical-data'] }

    if (options.includeStale && status.isFullySynced.value) {
      const lastSync = status.data.value?.lastSyncAt
      const isStale = typeof lastSync === 'number' && Date.now() - lastSync > 1000 * 60 * 60 * 48
      if (isStale)
        return { status: 'stale', lastSync: new Date(lastSync).toISOString() }
    }

    return { status: 'ready' }
  })
}
