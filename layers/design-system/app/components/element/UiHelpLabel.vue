<script setup lang="ts">
import { UiIcon, UiTooltip } from '#components'
/**
 * UiHelpLabel
 *
 * Label text with an inline (?) help icon that shows a tooltip on hover.
 * Used by UiStat, UiDataList, and anywhere a title needs contextual help.
 */
const { text, tooltip, tooltipTitle } = defineProps<{
  text: string
  tooltip: string
  /** Bold title in tooltip panel. Defaults to `text`. */
  tooltipTitle?: string
}>()
</script>

<template>
  <UiTooltip :title="tooltipTitle || text" :description="tooltip" trigger-as="button">
    <!-- The trigger is a button, which centres its text; a label that wraps
         must stay start-aligned like the heading it sits in. `mx-0.5` cancels
         the button's `-m-0.5` hit-area bleed, so the label starts on the same
         edge as a plain heading beside it. -->
    <span class="mx-0.5 inline-flex items-center gap-1 text-left">
      {{ text }}
      <UiIcon name="help" class="size-3 opacity-50 shrink-0" aria-hidden="true" />
    </span>
  </UiTooltip>
</template>
