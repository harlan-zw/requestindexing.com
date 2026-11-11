<script setup lang="ts">
definePageMeta({ layout: 'kit' })
useHead({ title: 'Utilities · Brand Kit' })
</script>

<template>
  <div class="space-y-8">
    <KitHeader
      eyebrow="Foundation"
      title="Utilities"
      description="Custom CSS that carries brand personality. Defined in layers/core/app/assets/css/brand.css."
    />

    <KitSection
      title=".bg-verdant"
      code=".bg-verdant"
      description="Soft emerald blooms over warm cream — the hero band signature."
    >
      <UCard variant="outline" class="overflow-hidden p-0">
        <div class="bg-verdant p-10 min-h-[200px] flex flex-col justify-end gap-2">
          <code class="text-[10px] font-mono text-default/70">.bg-verdant</code>
          <div class="font-title text-3xl font-semibold text-highlighted leading-tight">
            Verdant wash
          </div>
          <p class="text-sm text-muted max-w-md">
            Two radial blooms hugging the corners. Auto-flips muted ↔ default surface between modes.
          </p>
        </div>
      </UCard>
    </KitSection>

    <KitSection
      title=".divider-tilt"
      code=".divider-tilt"
      description="2° slice that lets a band bleed into the next section. Use on the wrapper of the upper band."
    >
      <UCard variant="outline" class="overflow-hidden p-0">
        <div class="divider-tilt bg-verdant p-10 min-h-[120px] flex items-end">
          <code class="text-[10px] font-mono text-default/70">.divider-tilt + .bg-verdant</code>
        </div>
        <div class="p-6 text-sm text-muted">
          The slice above tilts into this surface — quiet, organic.
        </div>
      </UCard>
    </KitSection>

    <KitSection
      title=".animate-fade-in"
      code=".animate-fade-in (--stagger-index)"
      description="Stagger via CSS variable — no per-item :style binding required."
    >
      <UCard variant="outline">
        <div class="space-y-1">
          <div
            v-for="(row, i) in ['Crawled', 'Submitted', 'Indexed', 'Verified', 'Re-validated']"
            :key="row"
            class="flex items-center gap-3 py-2 px-3 rounded-md bg-muted animate-fade-in"
            :style="{ '--stagger-index': i }"
          >
            <span class="size-1.5 rounded-full bg-primary-500" />
            <span class="text-sm text-default">{{ row }}</span>
            <code class="ml-auto text-[10px] text-dimmed font-mono">delay {{ i * 100 }}ms</code>
          </div>
        </div>
      </UCard>
    </KitSection>

    <KitSection
      title="ui-popover-content"
      code=".ui-popover-content"
      description="5-layer shadow + inset edges. Applied automatically by UiPopover, UDropdownMenu, UTooltip."
    >
      <UCard variant="outline">
        <div class="flex items-center gap-4">
          <div class="ui-popover-content bg-default rounded-lg p-4 max-w-xs">
            <div class="text-sm font-medium text-highlighted">
              Popover surface
            </div>
            <p class="text-xs text-muted mt-1">
              Carries the tooltip-grade chrome — 5-layer shadow + 1px hairline ring.
            </p>
          </div>
        </div>
      </UCard>
    </KitSection>

    <KitSection title="Mega-menu motion" description="Used by header dropdowns. Three coordinated keyframe animations.">
      <UCard variant="outline">
        <ul class="space-y-2 text-sm">
          <li class="flex items-center gap-3">
            <code class="font-mono text-xs text-default w-48 shrink-0">@keyframes mega-menu-enter</code>
            <span class="text-muted">Panel fade + 4px lift</span>
          </li>
          <li class="flex items-center gap-3">
            <code class="font-mono text-xs text-default w-48 shrink-0">@keyframes mega-column-stagger</code>
            <span class="text-muted">Per-column 8px rise</span>
          </li>
          <li class="flex items-center gap-3">
            <code class="font-mono text-xs text-default w-48 shrink-0">@keyframes mega-item-fade</code>
            <span class="text-muted">Per-item 6px slide from the left</span>
          </li>
        </ul>
      </UCard>
    </KitSection>
  </div>
</template>
