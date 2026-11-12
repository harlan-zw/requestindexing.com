// Resolves a FeatureDataState ref for the active feature.
//
// Each feature declares a `stateResolver` function in its
// `registry.add(...)` call (see ADR-0015 modernized). This composable
// just looks the function up and calls it.

import type { Ref, ShallowRef } from 'vue'
import type { FeatureDataState } from '../../shared/types'
import { computed, ref, shallowRef, watch } from 'vue'
import { useProFeatureRegistry } from './useProFeatureRegistry'

export function useFeatureDataState(featureId: string | Ref<string>, siteId: Ref<string>) {
  const { getFeature } = useProFeatureRegistry()
  const id = typeof featureId === 'string' ? ref(featureId) : featureId

  const resolver = computed(() => getFeature(id.value)?.stateResolver)

  const resolvedState: ShallowRef<Ref<FeatureDataState> | null> = shallowRef(null)

  watch(resolver, (fn) => {
    resolvedState.value = fn ? fn(siteId) : null
  }, { immediate: true })

  return computed<FeatureDataState>(() => {
    return resolvedState.value?.value ?? { status: 'ready' }
  })
}
