<script setup lang="ts">
import { computed } from 'vue'
import { UiBrandIcon, UiIcon } from '#components'

export interface SourceLogo {
  id: string
  label: string
  icon: string
  image?: string
  brand?: boolean
  invertDark?: boolean
  tint?: string
  mono?: boolean
}

const { sources, size = 'sm', dither = false } = defineProps<{
  sources: readonly SourceLogo[]
  /**
   * `inline` drops the frame so the mark sits inside a line of text at 12px,
   * the way a byline credits its Source. `xs` and `sm` frame the mark as a
   * badge for a row's edge.
   */
  size?: 'inline' | 'xs' | 'sm'
  /**
   * Quiet provenance mark for a card corner that must not compete with the
   * number beside it: desaturated, softened, stippled with a fine dot mask.
   * Same treatment `UiFavicon` uses for its `dither` prop, so a Source logo
   * and a site favicon recede the same way. Hovering the enclosing `.group`,
   * link or button restores the full logo.
   */
  dither?: boolean
}>()

const accessibleLabel = computed(() => sources.map(source => source.label).join(' and '))
const framed = computed(() => size !== 'inline')
const frameClass = computed(() => size === 'inline' ? '' : `border border-default bg-default shadow-xs rounded-md ${size === 'xs' ? 'size-5' : 'size-6'}`)
const iconClass = computed(() => size === 'inline' ? 'size-3' : size === 'xs' ? 'size-3.5' : 'size-4')
const brandClass = computed(() => size === 'inline' ? '!size-3' : size === 'xs' ? '!size-3.5' : '!size-4')
const iconPixels = computed(() => size === 'inline' ? 12 : size === 'xs' ? 14 : 16)
</script>

<template>
  <span
    v-if="sources.length"
    class="inline-flex shrink-0 items-center"
    role="img"
    :aria-label="accessibleLabel"
    :title="accessibleLabel"
  >
    <span
      v-for="(source, index) in sources"
      :key="source.id"
      class="relative inline-flex shrink-0 items-center justify-center"
      :class="[frameClass, index ? (framed ? '-ml-1.5' : 'ml-0.5') : '', dither ? 'ui-source-logo-dithered' : '']"
      aria-hidden="true"
    >
      <img
        v-if="source.image"
        :src="source.image"
        alt=""
        :width="iconPixels"
        :height="iconPixels"
        :class="[iconClass, dither ? 'ui-source-logo-dither' : '']"
        class="rounded-full"
      >
      <UiBrandIcon v-else-if="source.brand" size="md" :class="[brandClass, dither ? 'ui-source-logo-dither' : '']" />
      <UiIcon
        v-else
        :name="source.icon"
        :class="[iconClass, source.invertDark ? 'dark:invert' : '', source.tint ?? '', source.mono ? 'text-highlighted' : '', dither ? 'ui-source-logo-dither' : '']"
        aria-hidden="true"
      />
    </span>
  </span>
</template>

<style scoped>
/* Mirrors `UiFavicon`'s dither: the frame gets the dot mask, the mark gets the
   desaturation, and the enclosing hover target restores both. */
.ui-source-logo-dithered::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background-image: radial-gradient(circle, var(--ui-bg) 38%, transparent 44%);
  background-size: 2px 2px;
  opacity: .55;
  pointer-events: none;
  transition: opacity 180ms var(--ease-standard, ease);
}

.ui-source-logo-dither {
  filter: saturate(.35) contrast(.9) opacity(.85);
  transition: filter 180ms var(--ease-standard, ease);
}

/* Hover restores the full mark, but never on a disabled control: a Source that
   cannot be read is dithered to SAY so, and lighting it up contradicts that. */
:is(a, button, .group):not(:disabled):hover .ui-source-logo-dithered::after {
  opacity: 0;
}

:is(a, button, .group):not(:disabled):hover .ui-source-logo-dither {
  filter: none;
}

@media (prefers-reduced-motion: reduce) {
  .ui-source-logo-dithered::after,
  .ui-source-logo-dither {
    transition: none;
  }
}
</style>
