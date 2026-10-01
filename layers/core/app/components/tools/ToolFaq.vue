<script setup lang="ts">
interface FAQ {
  question: string
  answer: string
  sources?: { label: string, to: string }[]
}

withDefaults(defineProps<{
  faqs: FAQ[]
  color?: 'emerald' | 'blue' | 'amber' | 'cyan'
}>(), {
  color: 'emerald',
})
</script>

<template>
  <section class="mt-16">
    <div class="flex items-center gap-2 mb-6">
      <UIcon name="i-heroicons-question-mark-circle" class="size-5 text-[var(--ui-text-muted)]" />
      <h2 class="text-xl font-semibold text-[var(--ui-text-highlighted)]">
        Frequently Asked Questions
      </h2>
    </div>

    <div class="space-y-3">
      <details
        v-for="(faq, index) in faqs"
        :key="index"
        :open="index === 0"
        class="group rounded-xl border border-[var(--ui-border)] overflow-hidden transition-all duration-300"
      >
        <summary class="flex items-center gap-4 p-5 cursor-pointer select-none transition-colors duration-200 hover:bg-[var(--ui-bg-elevated)]/50">
          <span
            class="flex items-center justify-center w-7 h-7 rounded-lg text-xs font-semibold shrink-0 transition-transform duration-300 group-open:scale-110"
            :class="{
              'bg-emerald-500/10 text-emerald-500': color === 'emerald',
              'bg-blue-500/10 text-blue-500': color === 'blue',
              'bg-amber-500/10 text-amber-500': color === 'amber',
              'bg-cyan-500/10 text-cyan-500': color === 'cyan',
            }"
          >
            {{ String(index + 1).padStart(2, '0') }}
          </span>

          <h3 class="flex-1 font-medium text-[var(--ui-text-highlighted)] leading-snug pr-2 text-base">
            {{ faq.question }}
          </h3>

          <span class="relative w-5 h-5 shrink-0">
            <UIcon
              name="i-heroicons-plus"
              class="absolute inset-0 w-5 h-5 transition-all duration-300 group-open:rotate-45 group-open:opacity-0 text-[var(--ui-text-muted)]"
            />
            <UIcon
              name="i-heroicons-minus"
              class="absolute inset-0 w-5 h-5 transition-all duration-300 opacity-0 group-open:opacity-100 text-[var(--ui-text-muted)]"
            />
          </span>
        </summary>

        <div class="relative">
          <div
            class="absolute left-0 top-0 bottom-0 w-0.5 opacity-60"
            :class="{
              'bg-emerald-500': color === 'emerald',
              'bg-blue-500': color === 'blue',
              'bg-amber-500': color === 'amber',
              'bg-cyan-500': color === 'cyan',
            }"
          />
          <div class="pl-16 pr-6 pb-5 pt-1">
            <p class="text-[var(--ui-text-muted)] text-sm leading-relaxed">
              {{ faq.answer }}
            </p>
            <p v-if="faq.sources?.length" class="text-[var(--ui-text-muted)] text-sm mt-2">
              {{ faq.sources.length > 1 ? 'Sources:' : 'Source:' }}
              <template v-for="(source, i) in faq.sources" :key="source.to">
                <template v-if="i > 0">
                  ·
                </template>
                <NuxtLink :to="source.to" target="_blank" class="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary/60 transition-colors">
                  {{ source.label }}
                </NuxtLink>
              </template>
            </p>
          </div>
        </div>
      </details>
    </div>
  </section>
</template>
