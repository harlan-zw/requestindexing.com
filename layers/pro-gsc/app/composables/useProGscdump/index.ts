// Re-export API types so existing consumers of this composable keep working.
export * from '../../../shared/gscdump-api'
export { type GscTrendDimension, useGscTopEntityTrend, type UseGscTopEntityTrendOptions } from './useGscTopEntityTrend'
export { useProAnalyzeWithFallback } from './useProAnalyzeWithFallback'
export {
  sparklineDateAxis,
  useProEntitySparklines,
  type UseProEntitySparklinesOptions,
} from './useProEntitySparklines'
export { useProGscdump } from './useProGscdump'
export { useProGscdumpAnalysis } from './useProGscdumpAnalysis'
export {
  type BingDataset,
  type BingSiteId,
  useProBingAuthorize,
  useProBingIntegration,
  useProBingSiteSitemap,
  useProGscdumpBingConnection,
  useProGscdumpBingData,
  type UseProGscdumpBingDataOptions,
  useProGscdumpBingEvidence,
  useProGscdumpBingVerify,
} from './useProGscdumpBing'
export { useProGscdumpData } from './useProGscdumpData'
export { useProGscdumpDataDetail } from './useProGscdumpDataDetail'
export { useProGscdumpDates } from './useProGscdumpDates'
export {
  type GscdumpInspectRefused,
  indexingUrlsQueryKey,
  useProGscdumpCanonicalMismatches,
  useProGscdumpIndexing,
  useProGscdumpIndexingDiagnostics,
  useProGscdumpIndexingUrls,
  useProGscdumpInspectUrls,
} from './useProGscdumpIndexing'
export { useProGscdumpSitemapChanges, useProGscdumpSitemaps } from './useProGscdumpSitemaps'
export {
  type Dimension,
  type ProGscdumpTableOptions,
  type ProGscdumpTableResponse,
  useProGscdumpTableData,
} from './useProGscdumpTableData'
export {
  type ProGscQueryVariantRow,
  type ProGscQueryVariants,
  useProGscQueryVariants,
  type UseProGscQueryVariantsOptions,
} from './useProGscQueryVariants'
export {
  projectPositionSeries,
  type ProQueryPositionSparklines,
  useProQueryPositionSparklines,
  type UseProQueryPositionSparklinesOptions,
} from './useProQueryPositionSparklines'
export { useProTopAssociations, type UseProTopAssociationsOptions } from './useProTopAssociations'
