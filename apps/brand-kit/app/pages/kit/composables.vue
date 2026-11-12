<script setup lang="ts">
import { useGridCols } from '@nuxtseo/design-system/app/composables/useGridCols'
import { useScrollSpy } from '@nuxtseo/design-system/app/composables/useScrollSpy'

definePageMeta({ layout: 'kit' })
useHead({ title: 'Composables · Brand Kit' })

const spySections = [
  { id: 'intro', label: 'Intro' },
  { id: 'one', label: 'One' },
  { id: 'two', label: 'Two' },
  { id: 'three', label: 'Three' },
  { id: 'four', label: 'Four' },
]
const { activeSection, scrollToSection } = useScrollSpy(spySections, { offsetPx: -120 })

const colCount = ref(4)
const hasPanel = ref(false)
// The second argument is a fallback `grid-template-columns` value, used verbatim
// when it is truthy. `false` falls through to the generated track list.
const panelCols = computed(() => hasPanel.value && 'repeat(4, minmax(0, 1fr))')
const gridCols = useGridCols(colCount, panelCols)
</script>

<template>
  <div class="space-y-8">
    <KitHeader
      eyebrow="Code"
      title="Composables"
      description="Vue composables exposed by the design-system layer."
    />

    <KitSection
      title="useScrollSpy()"
      code="composables/useScrollSpy.ts"
      description="Tracks the currently-visible section by id. Hand it an array of section ids and bind activeSection to your nav."
    >
      <UCard variant="outline">
        <div class="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-6">
          <nav class="space-y-1 text-sm sticky top-4 self-start">
            <button
              v-for="s in spySections"
              :key="s.id"
              class="block w-full text-left px-3 py-1.5 rounded-md text-muted hover:text-highlighted hover:bg-muted transition-colors" :class="[
                activeSection === s.id && 'bg-elevated text-highlighted font-medium',
              ]"
              @click="scrollToSection(s.id)"
            >
              {{ s.label }}
            </button>
            <div class="text-[10px] text-dimmed mt-3 font-mono">
              active: {{ activeSection || '—' }}
            </div>
          </nav>
          <div class="space-y-6 max-h-[420px] overflow-auto pr-4 border-l border-default pl-6">
            <section v-for="s in spySections" :id="s.id" :key="s.id" class="min-h-[200px]">
              <h3 class="font-title text-xl font-semibold text-highlighted mb-2">
                Section: {{ s.label }}
              </h3>
              <p class="text-sm text-muted leading-relaxed">
                Scroll the container. The nav highlight follows the section that crosses the trigger
                point — driven entirely by useScrollSpy's IntersectionObserver.
              </p>
            </section>
          </div>
        </div>
      </UCard>
    </KitSection>

    <KitSection
      title="useGridCols()"
      code="composables/useGridCols.ts"
      description="Reactive `grid-template-columns` string for variable-width dashboard tables (avatar + label + N metric columns + actions)."
    >
      <UCard variant="outline">
        <div class="space-y-4">
          <div class="flex flex-wrap gap-3">
            <UFormField label="Metric columns">
              <UInput v-model.number="colCount" type="number" :min="1" :max="8" />
            </UFormField>
            <UFormField label="Side panel open?">
              <USwitch v-model="hasPanel" />
            </UFormField>
          </div>
          <code class="block font-mono text-xs text-default bg-muted rounded-md p-3">
            grid-template-columns: {{ gridCols }}
          </code>
          <div
            class="grid items-center gap-2 text-xs"
            :style="{ gridTemplateColumns: gridCols }"
          >
            <div class="bg-primary-500/15 rounded h-10 flex items-center justify-center text-dimmed">
              48
            </div>
            <div class="bg-muted rounded h-10 flex items-center justify-center text-muted">
              1fr · label
            </div>
            <template v-for="i in colCount" :key="i">
              <div class="bg-emerald-500/10 rounded h-10 flex items-center justify-center text-emerald-500">
                m{{ i }}
              </div>
            </template>
            <div class="bg-primary-500/15 rounded h-10 flex items-center justify-center text-dimmed">
              60
            </div>
          </div>
        </div>
      </UCard>
    </KitSection>

    <KitSection
      title="useReducedMotion"
      code="motion-v"
      description="Honours prefers-reduced-motion. UiMotionButton already respects this — query it directly when building your own motion."
    >
      <UCard variant="outline">
        <p class="text-sm text-muted">
          See <NuxtLink to="/kit/buttons" class="text-primary-500 underline">
            buttons & motion
          </NuxtLink> for a live consumer.
        </p>
      </UCard>
    </KitSection>
  </div>
</template>
