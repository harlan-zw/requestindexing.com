import type { GscdumpV1OperationResponse } from '@gscdump/sdk/v1'
import type { MaybeRefOrGetter, Ref } from 'vue'
import type { SetupSiteRead } from '#layers/pro-saas/app/utils/overview-setup-offers'
import { computed, toValue } from 'vue'
import { useGscdumpQuery } from '#layers/pro-gsc/app/composables/useProGscdump/_internal'
import { indexNowSetupCompletion, watchedUrlsSetupCompletion } from '#layers/pro-saas/app/utils/overview-setup-offers'

type IndexNowConnection = GscdumpV1OperationResponse<'partner.sites.indexing.indexnow.connection.get'>['data']
type WatchedRecord = GscdumpV1OperationResponse<'partner.sites.indexing.watched.list'>['data']

/**
 * The Setup completion of one Site's IndexNow and Watched URLs offers, from
 * that Site's IndexNow connection and Watched URLs list. Takes the Site's
 * gscdump id, never its app id. The dashboard home passes its first linked
 * Site, and a Site's page passes itself.
 *
 * A Team role that cannot write sets up neither one. The dashboard can still
 * share the IndexNow read with its source card to show the connection status.
 */
export function useProSetupSiteReads(
  gscdumpSiteId: MaybeRefOrGetter<string | null | undefined>,
  { showIndexNowStatus = false }: { showIndexNowStatus?: boolean } = {},
) {
  const { caller, isAdmin } = useCaller()
  const teamPolicy = useTeamPolicy(() => caller.value?.currentTeamId)
  const canWrite = computed(() => isAdmin.value || teamPolicy.can('write-data'))
  const linkedSiteId = computed(() => toValue(gscdumpSiteId) || undefined)
  const readSiteId = computed(() => caller.value && canWrite.value ? linkedSiteId.value : undefined)
  const indexNowSiteId = computed(() => caller.value && (showIndexNowStatus || canWrite.value) ? linkedSiteId.value : undefined)

  const indexNow = useGscdumpQuery<IndexNowConnection>(
    () => `setup-offers:indexnow:${indexNowSiteId.value ?? ''}`,
    indexNowSiteId,
    (id, client) => client.getSiteIndexNowConnection({ params: { siteId: id } }, true),
    [],
  )
  const watched = useGscdumpQuery<WatchedRecord>(
    () => `setup-offers:watched:${readSiteId.value ?? ''}`,
    readSiteId,
    (id, client) => client.listSiteWatchedUrls({ params: { siteId: id } }, true),
    [],
  )

  function siteRead<T>(query: { data: Ref<T | null | undefined>, error: Ref<unknown>, status: Ref<string> }): SetupSiteRead<T> {
    if (!linkedSiteId.value)
      return { _tag: 'no-site' }
    if (!caller.value)
      return { _tag: 'checking' }
    if (!canWrite.value)
      return { _tag: 'read-only' }
    if (query.error.value)
      return { _tag: 'read-failed' }
    if (query.status.value !== 'success' || !query.data.value)
      return { _tag: 'checking' }
    return { _tag: 'ready', value: query.data.value }
  }

  return {
    indexNow: computed(() => indexNowSetupCompletion(siteRead(indexNow))),
    indexNowConnection: computed(() => indexNow.status.value === 'success' ? indexNow.data.value ?? null : null),
    watchedUrls: computed(() => watchedUrlsSetupCompletion(siteRead(watched))),
  }
}
