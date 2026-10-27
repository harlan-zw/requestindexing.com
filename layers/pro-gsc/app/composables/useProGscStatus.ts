import type { SiteHoldReason } from '@gscdump/contracts'
import type { MaybeRefOrGetter, Ref } from 'vue'
import type { PartnerLifecycleSite } from '../../shared/gscdump-api'
import { classifyGscError } from '@gscdump/sdk/gsc-error'
import { lifecycleSiteToSyncStatus } from '@gscdump/sdk/lifecycle'
import { useDocumentVisibility, useTimeoutFn } from '@vueuse/core'
import { computed, effectScope, getCurrentInstance, getCurrentScope, onMounted, onScopeDispose, ref, shallowRef, toValue, watch } from 'vue'
import { useProSiteInjection } from '#layers/pro-saas/app/composables/useProSiteInjection'
import { useGscInvalidationMap } from '../internal/composables/useGscInvalidation'
import { useGscQueryIdentity } from './useGscQueryIdentity'

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

async function readSyncStatus(proFetch: ReturnType<typeof useProFetch>, siteId: string): Promise<GscSyncStatus | null> {
  if (import.meta.dev && siteId === DEMO_GSCDUMP_SITE_ID) {
    return {
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
  }
  return proFetch<{ site: PartnerLifecycleSite | null }>('/api/pro/gsc-lifecycle', {
    query: { siteId },
  }).then((res) => {
    const lifecycleSite = res.site
    if (!lifecycleSite)
      return null
    const lifecycleStatus = lifecycleSiteToSyncStatus(lifecycleSite)
    const syncStatus = lifecycleStatus.syncStatus
    // A held Site reads `pending` but runs nothing until its owner acts, so the
    // SDK's `isSyncing` decides, not the status.
    const activeAnalytics = lifecycleStatus.isSyncing
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
  })
}

/** One mounted reader per Nuxt app, security identity, and Site. */
interface StatusEntry { readers: number, store: ReturnType<typeof createStatusStore> }
const stores = new WeakMap<object, Map<string, StatusEntry>>()

function createStatusStore(proFetch: ReturnType<typeof useProFetch>, siteId: string, invalidation: Ref<Record<string, number>>) {
  const lifetime = effectScope(true)
  let active = true
  const store = lifetime.run(() => {
    const syncData = ref<GscSyncStatus | null>(null)
    const fetchStatus = ref<'idle' | 'pending' | 'success' | 'error'>('idle')
    const error = ref<Error | null>(null)
    const settled = ref(false)
    const mounted = ref(0)
    const visibility = useDocumentVisibility()
    let pending: Promise<void> | undefined
    let requiredRevision = 0

    const pollInterval = computed(() => {
      const data = syncData.value
      if (data?.hold === 'size_pending')
        return POLL_INTERVAL_SLOW
      if (data?.hold)
        return 0
      if (data?.isSyncing)
        return POLL_INTERVAL_SYNCING
      return data?.permissionLost ? POLL_INTERVAL_SLOW : 0
    })
    const timer = useTimeoutFn(() => {
      void refresh()
    }, pollInterval, { immediate: false })
    function scheduleFallback() {
      timer.stop()
      if (active && mounted.value > 0 && visibility.value === 'visible' && pollInterval.value > 0)
        timer.start()
    }

    function refresh(): Promise<void> {
      if (!active)
        return Promise.resolve()
      if (pending)
        return pending
      timer.stop()
      fetchStatus.value = 'pending'
      error.value = null
      let revision = requiredRevision
      pending = Promise.resolve().then(async () => {
        do {
          if (!active)
            return
          revision = requiredRevision
          fetchStatus.value = 'pending'
          error.value = null
          const result = await readSyncStatus(proFetch, siteId)
            .then(data => ({ _tag: 'Ok' as const, data }))
            .catch((cause: unknown) => ({ _tag: 'Err' as const, cause }))
          if (!active)
            return
          if (result._tag === 'Err') {
            if (classifyGscError(result.cause).status === 'auth-missing')
              syncData.value = null
            error.value = result.cause instanceof Error ? result.cause : new Error(String(result.cause))
            fetchStatus.value = 'error'
          }
          else {
            syncData.value = result.data
            fetchStatus.value = 'success'
          }
          // Empty and failed reads also settle. An active poll cannot reset this.
          settled.value = true
        } while (revision !== requiredRevision)
      }).finally(() => {
        pending = undefined
        // The watcher can deliver an invalidation after the loop exits but
        // before this promise releases ownership. Keep that required read.
        if (active && revision !== requiredRevision)
          return refresh()
        scheduleFallback()
      })
      return pending
    }

    watch(() => invalidation.value[siteId] ?? 0, () => {
      if (mounted.value === 0 && fetchStatus.value === 'idle')
        return
      // A read started before this event cannot satisfy its invalidation.
      // Several events during one read share a single serial follow-up.
      requiredRevision++
      void refresh()
    })
    watch(visibility, (value) => {
      timer.stop()
      if (value === 'visible' && mounted.value > 0)
        void refresh()
    })

    return {
      syncData,
      fetchStatus,
      error,
      settled,
      refresh,
      mount() {
        mounted.value++
        if (mounted.value === 1 && visibility.value === 'visible')
          void refresh()
      },
      unmount() {
        mounted.value--
        if (mounted.value === 0)
          timer.stop()
      },
      dispose() {
        active = false
        timer.stop()
        lifetime.stop()
      },
    }
  })!
  return store
}

export function useProGscStatus(siteId: MaybeRefOrGetter<string>) {
  const nuxtApp = useNuxtApp()
  const proFetch = useProFetch()
  const { site } = useProSiteInjection(siteId)
  const identity = useGscQueryIdentity()
  const invalidation = useGscInvalidationMap()
  const gscdumpSiteId = computed(() => site.value?.gscdumpSiteId)
  const scope = computed(() => identity.value._tag === 'Available' && gscdumpSiteId.value
    ? { key: JSON.stringify([identity.value.scope, toValue(siteId), gscdumpSiteId.value]), siteId: gscdumpSiteId.value }
    : null)
  const appStores = stores.get(nuxtApp) ?? new Map<string, StatusEntry>()
  stores.set(nuxtApp, appStores)
  const bound = shallowRef<{ key: string, entry: StatusEntry } | null>(null)
  let mounted = false
  function release() {
    const old = bound.value
    bound.value = null
    if (!old)
      return
    if (mounted)
      old.entry.store.unmount()
    old.entry.readers--
    if (old.entry.readers === 0) {
      old.entry.store.dispose()
      appStores.delete(old.key)
    }
  }
  watch(scope, (next) => {
    if (next?.key === bound.value?.key)
      return
    // Retire before checking visibility. Hidden account changes cannot reuse data.
    release()
    if (!next)
      return
    let entry = appStores.get(next.key)
    if (!entry) {
      entry = { readers: 0, store: createStatusStore(proFetch, next.siteId, invalidation) }
      appStores.set(next.key, entry)
    }
    entry.readers++
    bound.value = { key: next.key, entry }
    if (mounted)
      entry.store.mount()
  }, { immediate: true, flush: 'sync' })
  if (getCurrentInstance()) {
    onMounted(() => {
      mounted = true
      bound.value?.entry.store.mount()
    })
  }
  if (getCurrentScope())
    onScopeDispose(release)
  const current = computed(() => bound.value?.key === scope.value?.key ? bound.value?.entry.store : undefined)
  const syncData = computed(() => current.value?.syncData.value ?? null)
  const fetchStatus = computed(() => current.value?.fetchStatus.value ?? 'idle')
  const error = computed(() => current.value?.error.value ?? null)
  const settled = computed(() => current.value?.settled.value ?? false)
  const refresh = () => current.value?.refresh() ?? Promise.resolve()

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
