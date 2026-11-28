<script setup lang="ts">
import type { ToolFaqItem } from '../../composables/tools'

defineProps<{
  faqs: ToolFaqItem[]
  color?: 'emerald' | 'blue' | 'amber' | 'cyan'
}>()
</script>

<template>
  <section class="mt-14">
    <UiSectionHeader title="Frequently asked questions" icon="life-buoy" />

    <div class="space-y-3">
      <details
        v-for="(faq, index) in faqs"
        :key="index"
        :open="index === 0"
        class="ui-disclosure group overflow-hidden rounded-lg border border-default bg-elevated"
      >
        <summary
          class="flex min-h-11 cursor-pointer select-none items-center gap-3 px-4 py-3 text-highlighted transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <span class="flex-1 text-sm font-medium leading-snug sm:text-base">
            {{ faq.question }}
          </span>
          <UiIcon
            name="next"
            class="size-4 shrink-0 text-dimmed transition-transform group-open:rotate-90"
            aria-hidden="true"
          />
        </summary>

        <div class="border-t border-default px-4 py-4">
          <p class="max-w-3xl text-sm leading-relaxed text-muted">
            {{ faq.answer }}
          </p>
          <p v-if="faq.sources?.length" class="text-muted text-xs mt-2.5">
            {{ faq.sources.length > 1 ? 'Sources:' : 'Source:' }}
            <template v-for="(source, i) in faq.sources" :key="source.to">
              <template v-if="i > 0">
                ·
              </template>
              <NuxtLink :to="source.to" target="_blank" rel="noopener" class="font-medium text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
                {{ source.label }}
              </NuxtLink>
            </template>
          </p>
        </div>
      </details>
    </div>
  </section>
</template>
