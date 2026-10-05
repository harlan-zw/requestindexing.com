import type { SiteHoldReason } from '@gscdump/contracts'
import type { PartnerLifecycleSite } from '../../shared/gscdump-api'
import { lifecycleSiteToSyncStatus } from '@gscdump/sdk/lifecycle'
import { analyticsSyncStatus } from '#layers/pro-gsc/shared/analytics-sync'
import { useProSiteInjection } from '#layers/pro-saas/app/composables/useProSiteInjection'

interface TableProgress {
  name: string
  status: 'pending' | 'queued' | 'syncing' | 'complete'
  progress: number
  rows: number
}

interface IndexingProgress {
  queued: number
  processing: number
  completed: number
  failed: number
  total: number
  progress: number
}

interface GscSyncStatus {
  syncStatus: 'pending' | 'syncing' | 'synced' | 'error' | 'idle'
  permissionLost?: boolean
  oldestDateSynced: string | null
  newestDateSynced: string | null
  lastSyncAt: number | null
  lastError: string | null
  progress: number
  daysSynced: number
  daysAvailable: number
  isSyncing: boolean
  hasData: boolean
  isComplete: boolean
  // Enriched fields
  phase: 'preparing' | 'syncing' | 'indexing' | 'complete' | 'error'
  totalRowsSynced: number
  hasMinimumData: boolean
  tablesProgress: TableProgress[]
  indexing: IndexingProgress | null
  queryable?: boolean
  sourceMode?: string
  sitemapStatus?: string
  indexingStatus?: PartnerLifecycleSite['indexing']['status']
  /** Why gscdump holds the Site before its first import, or null. */
  hold: SiteHoldReason | null
}

const POLL_INTERVAL_SYNCING = 5000
const POLL_INTERVAL_SLOW = 60000
const DEMO_GSCDUMP_SITE_ID = 's_9dnsyZ8vVZNlH8'

/**
 * A Site is "not connected" only when it has no gscdump link. Ported from
 * nuxtseo.com, where a failed status read used to count here too and flipped
 * a linked Site to its unconnected empty state. This app had the same fold:
 * a lifecycle read that failed put the sample overlay and a connect button on
 * a linked Site (UX replay A5). `hasError` carries the failure.
 */
export function computeIsNotConnected(gscdumpSiteId: string | null | undefined): boolean {
  return !gscdumpSiteId
}

export function useProGscStatus(siteId: MaybeRefOrGetter<string>) {
  // The layout's Site, not a second read of the same endpoint. This used to
  // keep its own `pro-gsc:site:` key and its own `.catch(() => null)`, so the
  // same Site was fetched twice and a 404 arrived here as "no Site", which the
  // pages then read as "not connected". nuxtseo.com's `useProGscStatus` reads
  // the same injection (ADR-0012 names it a sanctioned direct consumer).
  const proFetch = useProFetch()
  const { site } = useProSiteInjection(siteId)
  const gscdumpSiteId = computed(() => site.value?.gscdumpSiteId)

  const syncData = ref<GscSyncStatus | null>(null)
  const fetchStatus = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
  const error = ref<Error | null>(null)
  // True once any lifecycle read has finished. A poll sets `fetchStatus` back
  // to pending every few seconds, so a page that waits for the first answer
  // cannot read it from `fetchStatus`.
  const settled = ref(false)
  let statusSiteId: string | null | undefined
  let requestId = 0

  async function refresh() {
    const siteIdVal = gscdumpSiteId.value
    const currentRequest = ++requestId
    if (statusSiteId !== siteIdVal) {
      statusSiteId = siteIdVal
      syncData.value = null
      error.value = null
      fetchStatus.value = 'idle'
      settled.value = false
    }
    if (!siteIdVal) {
      syncData.value = null
      return
    }

    if (import.meta.dev && siteIdVal === DEMO_GSCDUMP_SITE_ID) {
      syncData.value = {
        syncStatus: 'synced',
        permissionLost: false,
        oldestDateSynced: '2025-01-01',
        newestDateSynced: new Date().toISOString().slice(0, 10),
        lastSyncAt: Date.now(),
        lastError: null,
        progress: 100,
        daysSynced: 120,
        daysAvailable: 120,
        isSyncing: false,
        hasData: true,
        isComplete: true,
        phase: 'complete',
        totalRowsSynced: 1200,
        hasMinimumData: true,
        tablesProgress: [],
        indexing: null,
        hold: null,
      }
      fetchStatus.value = 'success'
      settled.value = true
      return
    }

    fetchStatus.value = 'pending'
    error.value = null

    const result = await proFetch<{ site: PartnerLifecycleSite | null }>('/api/pro/gsc-lifecycle', {
      query: { siteId: siteIdVal },
    }).then((res) => {
      const lifecycleSite = res.site
      if (!lifecycleSite)
        return null
      const lifecycleStatus = lifecycleSiteToSyncStatus(lifecycleSite)
      const syncStatus = analyticsSyncStatus(lifecycleSite.analytics)
      const activeAnalytics = syncStatus === 'pending' || syncStatus === 'syncing'
      const activeSitemaps = ['discovering', 'syncing'].includes(lifecycleSite.sitemaps.status)
      const activeIndexing = ['discovering', 'checking', 'waiting_for_sitemaps'].includes(lifecycleSite.indexing.status)
      return {
        syncStatus,
        permissionLost: lifecycleSite.latestError?.code === 'permission_lost',
        oldestDateSynced: lifecycleStatus.oldestDateSynced,
        newestDateSynced: lifecycleStatus.newestDateSynced,
        lastSyncAt: lifecycleStatus.lastSyncAt,
        lastError: lifecycleStatus.lastError,
        progress: lifecycleStatus.progress,
        daysSynced: lifecycleStatus.daysSynced,
        daysAvailable: lifecycleStatus.daysAvailable,
        isSyncing: activeAnalytics || activeSitemaps || activeIndexing,
        hasData: lifecycleStatus.hasData,
        isComplete: lifecycleStatus.isComplete,
        phase: syncStatus === 'error' ? 'error' : activeIndexing ? 'indexing' : activeAnalytics || activeSitemaps ? 'syncing' : 'complete',
        totalRowsSynced: lifecycleStatus.daysSynced,
        hasMinimumData: lifecycleStatus.hasData,
        tablesProgress: [],
        indexing: {
          queued: 0,
          processing: activeIndexing ? 1 : 0,
          completed: lifecycleSite.indexing.progress.completed,
          failed: lifecycleSite.indexing.progress.failed,
          total: lifecycleSite.indexing.progress.total,
          progress: lifecycleSite.indexing.progress.percent,
        },
        queryable: lifecycleSite.analytics.queryable,
        sourceMode: lifecycleSite.analytics.sourceMode,
        sitemapStatus: lifecycleSite.sitemaps.status,
        indexingStatus: lifecycleSite.indexing.status,
        hold: lifecycleSite.hold,
      } satisfies GscSyncStatus
    }).then(data => ({ _tag: 'Ok' as const, data })).catch((cause: unknown) => ({ _tag: 'Err' as const, cause }))

    if (currentRequest !== requestId || gscdumpSiteId.value !== siteIdVal)
      return
    if (result._tag === 'Err') {
      error.value = result.cause instanceof Error ? result.cause : new Error(String(result.cause))
      fetchStatus.value = 'error'
    }
    else {
      syncData.value = result.data
      fetchStatus.value = 'success'
    }

    // A lifecycle that does not list this Site is a finished read too. Gating
    // this on `syncData` left such a read pending for good.
    settled.value = true
  }

  // Auto-poll during active sync
  let _pollTimer: ReturnType<typeof setInterval> | null = null

  function startPolling(intervalMs: number = POLL_INTERVAL_SYNCING) {
    stopPolling()
    _pollTimer = setInterval(refresh, intervalMs)
  }

  function stopPolling() {
    if (_pollTimer) {
      clearInterval(_pollTimer)
      _pollTimer = null
    }
  }

  // Only fetch gscdump data on the client - raw $fetch to gscdump.com
  // doesn't have user cookies during SSR, causing false AUTH errors
  if (import.meta.client) {
    watch(gscdumpSiteId, refresh, { immediate: true })

    // Auto-manage polling based on phase / permission state
    watch(() => [syncData.value?.phase, syncData.value?.permissionLost, syncData.value?.sitemapStatus, syncData.value?.indexingStatus, syncData.value?.hold] as const, ([phase, permissionLost, sitemapStatus, indexingStatus, hold]) => {
      // A held Site does not import, so a fast poll would never see progress.
      // Only a pending size measurement can clear on its own; check it slowly.
      if (hold === 'size_pending')
        startPolling(POLL_INTERVAL_SLOW)
      else if (hold)
        stopPolling()
      else if (phase === 'preparing' || phase === 'syncing' || phase === 'indexing' || sitemapStatus === 'discovering' || sitemapStatus === 'syncing' || indexingStatus === 'discovering' || indexingStatus === 'checking' || indexingStatus === 'waiting_for_sitemaps')
        startPolling(POLL_INTERVAL_SYNCING)
      else if (permissionLost)
        startPolling(POLL_INTERVAL_SLOW)
      else
        stopPolling()
    })

    onUnmounted(stopPolling)
  }

  // Computed status helpers
  const data = computed(() => {
    if (!site.value)
      return null

    const connected = !!gscdumpSiteId.value
    if (!connected || !syncData.value) {
      return {
        connected,
        gscSiteUrl: null,
        gscdumpSiteUrl: site.value.gscdumpSiteUrl,
        syncStatus: null,
        permissionLost: false,
        syncProgress: null,
        oldestDate: null,
        newestDate: null,
        lastSyncAt: null,
        isSyncing: false,
        hasData: false,
        isComplete: false,
        daysSynced: 0,
        daysAvailable: 0,
        lastError: null,
        phase: null as 'preparing' | 'syncing' | 'indexing' | 'complete' | 'error' | null,
        totalRowsSynced: 0,
        hasMinimumData: false,
        tablesProgress: [] as TableProgress[],
        indexing: null as IndexingProgress | null,
        indexingStatus: null,
        sitemapStatus: undefined as GscSyncStatus['sitemapStatus'],
        queryable: false,
        sourceMode: 'none',
      }
    }

    return {
      connected: true,
      gscSiteUrl: site.value.gscdumpSiteUrl,
      gscdumpSiteUrl: site.value.gscdumpSiteUrl,
      syncStatus: syncData.value.syncStatus,
      permissionLost: !!syncData.value.permissionLost,
      syncProgress: { percent: syncData.value.progress, completed: syncData.value.daysSynced, total: syncData.value.daysAvailable },
      oldestDate: syncData.value.oldestDateSynced,
      newestDate: syncData.value.newestDateSynced,
      lastSyncAt: syncData.value.lastSyncAt,
      isSyncing: syncData.value.isSyncing,
      hasData: syncData.value.hasData,
      isComplete: syncData.value.isComplete,
      daysSynced: syncData.value.daysSynced,
      daysAvailable: syncData.value.daysAvailable,
      lastError: syncData.value.lastError,
      // Enriched fields
      phase: syncData.value.phase,
      totalRowsSynced: syncData.value.totalRowsSynced ?? 0,
      hasMinimumData: syncData.value.hasMinimumData ?? false,
      tablesProgress: syncData.value.tablesProgress ?? [],
      indexing: syncData.value.indexing ?? null,
      indexingStatus: syncData.value.indexingStatus ?? null,
      sitemapStatus: syncData.value.sitemapStatus,
      queryable: !!syncData.value.queryable,
      sourceMode: syncData.value.sourceMode ?? 'none',
    }
  })

  // Only a resolved Site can be "not connected". While the lookup is in flight,
  // or when it failed, there is nothing to say about this Site's Search Console
  // connection, and saying "not connected" put the sample-data shell on screen
  // for a Site that does not exist (D5).
  const isNotConnected = computed(() => !!site.value && computeIsNotConnected(gscdumpSiteId.value))

  const isTokenRevoked = computed(() => {
    return !!error.value && 'code' in error.value && error.value.code === 'AUTH'
  })

  const isPermissionLost = computed(() => !!data.value?.permissionLost)

  // Read live from the lifecycle on every refresh, like the sync status. A
  // held Site is waiting, not failing, so it has its own notice.
  const hold = computed<SiteHoldReason | null>(() => syncData.value?.hold ?? null)

  const isProcessing = computed(() => {
    if (!data.value?.connected)
      return false
    if (data.value.isSyncing !== undefined)
      return data.value.isSyncing
    return data.value.syncStatus === 'pending' || data.value.syncStatus === 'syncing'
  })

  const hasSyncError = computed(() => {
    if (!data.value)
      return false
    return data.value.syncStatus === 'error' || !!data.value.lastError
  })

  const daysSynced = computed(() => {
    if (data.value?.daysSynced !== undefined)
      return data.value.daysSynced
    if (!data.value?.oldestDate || !data.value?.newestDate)
      return 0
    const oldest = new Date(data.value.oldestDate)
    const newest = new Date(data.value.newestDate)
    return Math.ceil((newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24))
  })

  const hasMinimumData = computed(() => !!data.value?.connected && data.value.queryable)

  const isFullySynced = computed(() => {
    if (!data.value)
      return false
    if (data.value.isComplete !== undefined)
      return data.value.connected && data.value.isComplete
    return data.value.connected && data.value.syncStatus === 'synced'
  })

  const isReady = hasMinimumData

  const hasError = computed(() => !!error.value)

  return {
    data,
    refresh,
    fetchStatus,
    error,
    isNotConnected,
    /** A lifecycle read has finished, with a result or a failure. */
    isLifecycleSettled: computed(() => settled.value),
    isTokenRevoked,
    isPermissionLost,
    hold,
    isTokenExpiring: computed(() => false),
    isProcessing,
    isReady,
    isFullySynced,
    hasMinimumData,
    daysSynced,
    hasError,
    hasSyncError,
  }
}
