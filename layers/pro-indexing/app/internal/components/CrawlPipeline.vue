<script setup lang="ts">
import type { InspectionSeverity } from '#layers/pro-indexing/app/utils/indexing-urls-table'
import UiIcon from '#layers/design-system/app/components/element/UiIcon.vue'
import UiSeverityDot from '#layers/design-system/app/components/element/UiSeverityDot.vue'

/**
 * One URL's path through Google, from URL Inspection fields only: robots.txt,
 * fetch, indexing state, verdict. A compact row for the URLs table's expanded
 * row.
 *
 * Ported from nuxtseo.com `layers/pro/gsc/app/internal/components/CrawlPipeline.vue`,
 * inline variant only. The hero variant there feeds on crawl data this app
 * does not have.
 */

interface PipelineStep {
  label: string
  status: InspectionSeverity
  value: string
}

const { steps } = defineProps<{
  steps: PipelineStep[]
}>()
</script>

<template>
  <div class="inline-pipeline" role="list" aria-label="URL Inspection steps">
    <template v-for="(step, i) in steps" :key="step.label">
      <div role="listitem" class="inline-step">
        <span class="inline-label">{{ step.label }}</span>
        <UiSeverityDot :severity="step.status" :label="step.value" />
      </div>
      <UiIcon v-if="i < steps.length - 1" name="chevron-right" class="inline-arrow" aria-hidden="true" />
    </template>
  </div>
</template>

<style scoped>
/* Wraps rather than scrolls: inside a table cell, a row that cannot wrap
   widens the whole table past a phone screen. */
.inline-pipeline {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.375rem;
}

.inline-step {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  padding: 0.375rem 0.5rem;
  border-radius: 0.375rem;
}

.inline-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--ui-text-dimmed);
}

.inline-arrow {
  width: 0.75rem;
  height: 0.75rem;
  color: var(--ui-text-dimmed);
  flex-shrink: 0;
  margin-top: 1rem;
  opacity: 0.35;
}
</style>
