<script setup lang="ts">
// The page-flow primitive. Owns: header, tabs, gating chrome, freshness/demo
// chrome, error fallback. Pages declare `feature` + meta and slot the body.

import { computed, toRef } from 'vue'
import { useFeatureDataState } from '../../composables/useFeatureDataState'
import { useProFeatureRegistry } from '../../composables/useProFeatureRegistry'
import { useProGateState } from '../../composables/useProGateState'
import { useProSiteChrome } from '../../composables/useProSiteChrome'

const props = defineProps<{
  feature: string
  siteId: string
  title?: string
  description?: string
  docLink?: string
  demoMode?: boolean
  /** Detail leaf pages (e.g. /queries/[keyword]) suppress the tab strip while
   * still inheriting the feature's gate. Equivalent to the older
   * `siteFeatureHideNav` page meta. */
  showTabs?: boolean
}>()

const { getFeature } = useProFeatureRegistry()
const feature = computed(() => getFeature(props.feature))

const route = useRoute()
const hideTabsMeta = computed(() => (route.meta as { proHideTabs?: boolean }).proHideTabs === true)
const tabs = computed(() => (props.showTabs === false || hideTabsMeta.value) ? [] : (feature.value?.tabs ?? []))
const headerTitle = computed(() => props.title ?? feature.value?.label ?? props.feature)

const gate = useProGateState()
const state = useFeatureDataState(toRef(props, 'feature'), toRef(props, 'siteId'))
const chrome = useProSiteChrome(props.feature)
</script>

<template>
  <div class="pro-site-feature-page mx-auto w-full max-w-7xl px-4 pt-5 pb-10 flex flex-col gap-6">
    <header class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-highlighted">
          {{ headerTitle }}
        </h1>
        <p v-if="description" class="text-sm text-muted">
          {{ description }}
        </p>
      </div>
      <slot name="actions" />
    </header>

    <nav v-if="tabs.length" class="flex gap-2 border-b border-default">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to.replace(/:id\(\)|:slug\(\)|\[id\]|\[slug\]/g, siteId)"
        class="px-3 py-2 text-sm text-muted hover:text-highlighted"
        active-class="text-highlighted border-b-2 border-primary"
      >
        {{ tab.label }}
      </NuxtLink>
    </nav>

    <div v-if="gate.blocked">
      <slot name="locked" :reason="gate.reason" :cta="gate.cta">
        <div class="rounded border border-default bg-muted p-6">
          <p class="text-sm text-muted">
            {{ gate.reason ?? 'This feature is not available.' }}
          </p>
          <NuxtLink v-if="gate.cta" :to="gate.cta.to" class="mt-2 inline-block text-sm text-primary">
            {{ gate.cta.label }} →
          </NuxtLink>
        </div>
      </slot>
    </div>

    <template v-else>
      <!-- Per-feature chrome (registered via registerProSiteChrome).
           Renders feature-specific banners (sync progress, scope alerts,
           freshness strip) without each page importing them inline. -->
      <component :is="chrome" v-if="chrome" :site-id="siteId" :state="state" />

      <!-- Unconnected: replaces the body with a default Connect-CTA card so
           the layout no longer has to gate per-site GSC. Pages can override
           via #unconnected. The state resolver decides per-site connectedness
           (e.g. useProGscStatus checks the per-site gscdumpSiteId). -->
      <slot
        v-if="state.status === 'unconnected'"
        name="unconnected"
        :state="state"
      >
        <div class="flex flex-col items-center justify-center py-10 sm:py-20 text-center max-w-md mx-auto px-4">
          <div class="size-16 rounded-2xl bg-elevated border border-default flex items-center justify-center mb-6">
            <UIcon :name="feature?.icon ?? 'i-lucide-lock'" class="size-7 text-dimmed" aria-hidden="true" />
          </div>
          <h2 class="text-lg font-semibold text-default mb-2">
            Connect Google Search Console to see {{ feature?.label?.toLowerCase() ?? 'this data' }} for this site.
          </h2>
          <p class="text-sm text-muted mb-6">
            {{ description ?? 'Pulls queries, pages, and indexing status straight from your verified GSC property. Takes ~2 min.' }}
          </p>
          <UButton
            v-if="state.cta"
            :to="state.cta.to"
            color="primary"
          >
            {{ state.cta.label }}
          </UButton>
        </div>
      </slot>

      <!-- Other non-ready states fall back to named slots; otherwise render
           the body. Chrome already renders its own syncing/error banners. -->
      <template v-else>
        <slot
          v-if="state.status !== 'ready' && state.status !== 'stale'"
          :name="state.status"
          :state="state"
        />
        <slot :state="state" />
      </template>
    </template>
  </div>
</template>
