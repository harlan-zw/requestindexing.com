<script setup lang="ts">
// Trailing toolbar block for a fleet page: the card grid's collapse-all switch
// and the table rows / card grid toggle. Ported from nuxtseo.com's
// `ProSiteGroupLayoutControls.vue`. Renders nothing for a one-Site account.
import { UiIcon } from '#components'
import { useFleetSiteListLayout } from '../../composables/useFleetSiteListLayout'

const { siteCount } = defineProps<{ siteCount: number }>()

const LAYOUT_OPTIONS = [
  { value: false, label: 'Table rows', icon: 'list' },
  { value: true, label: 'Card grid', icon: 'grid' },
]

const { gridLayout, setGridLayout, gridExpanded, showLayoutControls } = useFleetSiteListLayout(() => siteCount)
</script>

<template>
  <template v-if="showLayoutControls">
    <button
      v-if="gridLayout"
      type="button"
      class="ml-auto min-h-11 sm:min-h-0 inline-flex items-center gap-1.5 text-xs text-dimmed hover:text-default transition-colors cursor-pointer"
      @click="gridExpanded = !gridExpanded"
    >
      <UiIcon :name="gridExpanded ? 'collapse' : 'expand'" class="size-3.5" aria-hidden="true" />
      {{ gridExpanded ? 'Collapse all' : 'Expand all' }}
    </button>
    <div
      role="group"
      aria-label="Layout"
      :class="gridLayout ? '' : 'ml-auto'"
      class="flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--ui-bg-elevated)]/60 border border-default"
    >
      <button
        v-for="opt in LAYOUT_OPTIONS"
        :key="String(opt.value)"
        type="button"
        :aria-label="opt.label"
        :aria-pressed="gridLayout === opt.value"
        :title="opt.label"
        class="cursor-pointer inline-flex items-center justify-center size-11 sm:size-7 rounded-md transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary"
        :class="gridLayout === opt.value ? 'bg-default text-default shadow-sm' : 'text-dimmed hover:text-default'"
        @click="setGridLayout(opt.value)"
      >
        <UiIcon :name="opt.icon" class="size-3.5" aria-hidden="true" />
      </button>
    </div>
  </template>
</template>
