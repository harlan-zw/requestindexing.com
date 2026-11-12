// Per-feature chrome registry. Chrome components are registered as direct
// refs via `registry.addChrome({ forFeatures, component })` from each
// layer's `app/plugins/pro-feature.ts`.

import type { Component } from 'vue'
import type { FeatureDataState } from '../../shared/types'
import { useProFeatureRegistry } from './useProFeatureRegistry'

export interface ProSiteChromeProps {
  siteId: string
  state: FeatureDataState
}

export type ProSiteChromeComponent = Component<ProSiteChromeProps>

export function useProSiteChrome(featureId: string): ProSiteChromeComponent | undefined {
  const { getChrome } = useProFeatureRegistry()
  return getChrome(featureId) as ProSiteChromeComponent | undefined
}
