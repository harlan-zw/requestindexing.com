// Shared gscdump contracts used by server and client adapters.

export type {
  GscdumpAnalysisPreset as AnalysisPreset,
  GscComparisonFilter,
  GscdumpAnalysisParams,
  GscdumpAnalysisResponse,
  GscdumpAvailableSite,
  GscdumpCanonicalMismatchesResponse,
  GscdumpDataDetailResponse,
  GscdumpDataResponse,
  GscdumpDataRow,
  GscdumpIndexingDiagnosticsResponse,
  GscdumpIndexingResponse,
  GscdumpIndexingUrl,
  GscdumpIndexingUrlsResponse,
  IndexingInspectRateLimited as GscdumpInspectRateLimited,
  IndexingInspectResponse as GscdumpInspectResponse,
  IndexingInspectResult as GscdumpInspectResult,
  GscdumpMeta,
  GscdumpPerSitemapHistoryEntry,
  GscdumpSitemap,
  GscdumpSitemapChangesResponse,
  GscdumpSitemapHistory,
  GscdumpSitemapsResponse,
  GscdumpSiteRegistration,
  GscdumpSyncStatusResponse,
  GscdumpTotals,
  GscdumpUserRegistration,
  GscdumpUserSite,
  GscdumpUserStatus,
  GscdumpUserTokenUpdate,
  IndexingUrlsParams,
  PartnerLifecycleAccount,
  PartnerLifecycleResponse,
  PartnerLifecycleSite,
} from '@gscdump/contracts'

// The v1 report contract intentionally accepts additive BuilderState fields.
export type BuilderState = import('gscdump/query').BuilderState & Record<string, unknown>
export type { Dimension, Filter, Metric } from 'gscdump/query'
