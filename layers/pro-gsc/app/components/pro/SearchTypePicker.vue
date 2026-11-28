<script setup lang="ts">
import type { GscSearchType } from '@gscdump/contracts'
import { computed, ref } from 'vue'
import { UiIcon, UiMetricLabel, UiPopover } from '#components'
import { getSearchTypeLabel, SEARCH_TYPE_OPTIONS } from '../../composables/useProGscFilters'

// Immediate pending cue for the switch: the underlying (site, searchType)
// slice can take several seconds to resolve (cold manifest + attach), so the
// caller threads its own fan-out's in-flight signal (e.g. `gscRefreshing`)
// here — a synchronous, honest "is a refetch actually happening" flag, not a
// timer. Without this the trigger gives no feedback at all until the data
// panels below finally flip their own loading state.
const { switching = false } = defineProps<{ switching?: boolean }>()

// Compact search-type slice selector for the GSC controls toolbar. Sits next
// to the DateRangePicker and mirrors its trigger styling. Web is the default;
// switching re-resolves the per-`(site, searchType)` R2 snapshot.
const searchType = defineModel<GscSearchType>('searchType', { required: true })

const open = ref(false)

function select(value: GscSearchType) {
  searchType.value = value
  open.value = false
}

const activeOption = computed(() => SEARCH_TYPE_OPTIONS.find(o => o.value === searchType.value) ?? SEARCH_TYPE_OPTIONS[0]!)
</script>

<template>
  <UiPopover v-model:open="open" :content="{ align: 'start', side: 'bottom', sideOffset: 8 }">
    <button
      type="button"
      :aria-label="`Search type: ${getSearchTypeLabel(searchType)}`"
      :aria-expanded="open"
      class="cursor-pointer inline-flex items-center justify-center gap-1.5 px-2.5 min-h-11 min-w-11 sm:min-h-0 sm:min-w-0 sm:h-8 rounded-lg text-xs font-medium transition-colors duration-150 border outline-none focus-visible:ring-2 focus-visible:ring-primary"
      :class="[
        open
          ? 'border-accented bg-elevated text-highlighted'
          : 'border-default bg-default text-default hover:border-accented hover:bg-muted/60',
      ]"
    >
      <UiIcon :name="activeOption.icon" class="size-3.5 shrink-0 text-dimmed" aria-hidden="true" />
      <span data-toolbar-label class="whitespace-nowrap">{{ activeOption.label }}</span>
      <UiIcon
        :name="switching ? 'loading' : 'expand'"
        :data-toolbar-chevron="switching ? undefined : ''"
        class="size-3 shrink-0 text-dimmed -mr-0.5"
        :class="{ 'animate-spin': switching }"
        aria-hidden="true"
      />
    </button>

    <template #panel>
      <div class="w-[180px] py-1.5" role="group" aria-label="Search type">
        <div class="px-3 pb-1">
          <UiMetricLabel aria-hidden="true">
            Search Type
          </UiMetricLabel>
        </div>
        <button
          v-for="opt in SEARCH_TYPE_OPTIONS"
          :key="opt.value"
          type="button"
          :aria-pressed="searchType === opt.value"
          class="cursor-pointer group w-full flex items-center gap-2 pl-3 pr-3 py-2.5 sm:py-[5px] text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset relative"
          :class="[
            searchType === opt.value
              ? 'text-default bg-elevated'
              : 'text-muted hover:text-default hover:bg-[var(--ui-bg-elevated)]/50',
          ]"
          @click="select(opt.value)"
        >
          <span
            v-if="searchType === opt.value"
            class="absolute left-0 inset-y-0.5 w-[2px] rounded-full bg-primary"
            aria-hidden="true"
          />
          <UiIcon :name="opt.icon" class="size-3.5 shrink-0 text-dimmed" aria-hidden="true" />
          <span class="flex-1 text-left">{{ opt.label }}</span>
          <UiIcon
            v-if="searchType === opt.value"
            name="check"
            class="size-3 text-primary"
            aria-hidden="true"
          />
        </button>
      </div>
    </template>
  </UiPopover>
</template>
