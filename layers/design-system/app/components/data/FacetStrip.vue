<script setup lang="ts" generic="T extends string = string">
import type { UiTabItem, UiTabLink } from '../element/UiTabs.vue'
import UiTabs from '../element/UiTabs.vue'

/**
 * A visible, counted set of related facets. `UiTabs` keeps ownership of each
 * segmented run's selection, keyboard, focus, and horizontal overflow behavior;
 * this primitive owns the repeated group-label layout and count presentation.
 */
export interface FacetStripItem<T extends string = string> extends UiTabItem<T> {
  count: string | number
  magnitude?: number
}

export interface FacetStripGroup<T extends string = string> {
  label: string
  items: FacetStripItem<T>[]
}

const { groups, ariaLabel = 'Facets', wrapOnMobile = false } = defineProps<{
  groups: FacetStripGroup<T>[]
  ariaLabel?: string
  wrapOnMobile?: boolean
}>()

const model = defineModel<T>({ required: true })

function itemCount(link: UiTabLink | UiTabItem<T>): string | number | undefined {
  return 'value' in link ? (link as FacetStripItem<T>).count : undefined
}

function itemMagnitude(link: UiTabLink | UiTabItem<T>): number | undefined {
  if (!('value' in link))
    return undefined
  const magnitude = (link as FacetStripItem<T>).magnitude
  return typeof magnitude === 'number' && Number.isFinite(magnitude)
    ? Math.min(100, Math.max(0, magnitude))
    : undefined
}

function magnitudeStyle(link: UiTabLink | UiTabItem<T>): Record<string, string> | undefined {
  const magnitude = itemMagnitude(link)
  if (magnitude == null)
    return undefined
  return { '--facet-magnitude': `${magnitude}%` }
}
</script>

<template>
  <div
    data-ui="FacetStrip"
    role="group"
    :aria-label="ariaLabel"
    class="grid gap-2"
  >
    <div
      v-for="group in groups"
      :key="group.label"
      class="grid min-w-0 gap-1 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:items-center sm:gap-2"
    >
      <span class="text-sm font-strong text-muted">{{ group.label }}</span>
      <div class="min-w-0">
        <UiTabs
          v-model="model"
          class="w-full!"
          :class="wrapOnMobile ? 'max-sm:flex-wrap! max-sm:overflow-visible!' : ''"
          kind="subnav"
          :items="group.items"
          :aria-label="`${group.label}, ${ariaLabel}`"
        >
          <template #trailing="{ link }">
            <span class="relative isolate overflow-hidden rounded-sm px-1 numerals-display tabular-nums">
              <span
                v-if="(itemMagnitude(link) ?? 0) > 0"
                class="facet-strip__magnitude absolute inset-y-0 left-0 -z-10 rounded-sm bg-accented"
                :data-facet-magnitude="itemMagnitude(link)"
                :style="magnitudeStyle(link)"
                aria-hidden="true"
              />
              <span>{{ itemCount(link) }}</span>
            </span>
          </template>
        </UiTabs>
      </div>
    </div>
  </div>
</template>

<style scoped>
.facet-strip__magnitude {
  width: var(--facet-magnitude);
}
</style>
