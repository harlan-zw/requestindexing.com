<script setup lang="ts">
definePageMeta({ layout: 'kit' })
useHead({ title: 'Brand Kit · Verdant Console' })

const stats = [
  { label: 'Components', value: '132', hint: '@nuxtseo/design-system/app/components' },
  { label: 'Composables', value: '21', hint: '@nuxtseo/design-system/app/composables' },
  { label: 'Utils', value: '11', hint: '@nuxtseo/design-system/app/utils' },
  { label: 'Brand colors', value: '2', hint: 'emerald + olive' },
]

const links = [
  { to: '/kit/colors', label: 'Colors', icon: 'i-lucide-palette', blurb: 'Emerald + olive scales, semantic roles, surfaces & text.' },
  { to: '/kit/typography', label: 'Typography', icon: 'i-lucide-type', blurb: 'Poppins display + DM Sans body, full type scale.' },
  { to: '/kit/buttons', label: 'Buttons & motion', icon: 'i-lucide-mouse-pointer-click', blurb: 'UButton variants + UiMotionButton spotlight FX.' },
  { to: '/kit/forms', label: 'Forms', icon: 'i-lucide-edit-3', blurb: 'Inputs, selects, switches.' },
  { to: '/kit/feedback', label: 'Feedback', icon: 'i-lucide-message-square', blurb: 'Badges, alerts, progress, tooltips.' },
  { to: '/kit/elements', label: 'Elements', icon: 'i-lucide-shapes', blurb: 'UiIconBox, UiHelpLabel, UiProgressCircle, CardTitle…' },
  { to: '/kit/popovers', label: 'Popovers', icon: 'i-lucide-message-circle', blurb: 'UiPopover, UiTooltip, UiTooltipGrid.' },
  { to: '/kit/data-cells', label: 'Table cells', icon: 'i-lucide-grid-3x3', blurb: 'UiTableScoreTile, UiTableMetricCell, UiTableTrendCell, UiTablePathCell.' },
  { to: '/kit/tables', label: 'Data tables', icon: 'i-lucide-table', blurb: 'UiTable, UiTableShell, UiDataTableSection.' },
  { to: '/kit/format', label: 'Formatters', icon: 'i-lucide-hash', blurb: 'percentChange, calcTrendPercent, clamp.' },
  { to: '/kit/composables', label: 'Composables', icon: 'i-lucide-function-square', blurb: 'useScrollSpy, useGridCols, semantic + viz colors.' },
  { to: '/kit/utilities', label: 'Utilities', icon: 'i-lucide-sparkle', blurb: '.bg-verdant, .animate-fade-in, mega-menu motion.' },
]
</script>

<template>
  <div class="space-y-10">
    <div class="bg-verdant -mx-6 -mt-8 px-6 pt-12 pb-10 border-b border-default rounded-b-2xl">
      <div class="space-y-3 max-w-3xl">
        <div class="flex items-center gap-2">
          <UBadge color="primary" variant="soft">
            emerald
          </UBadge>
          <UBadge color="neutral" variant="outline">
            olive
          </UBadge>
        </div>
        <h1 class="font-title text-5xl font-bold tracking-tight text-highlighted leading-[1.05]">
          Verdant Console
        </h1>
        <p class="text-lg text-muted">
          Warm developer console. Emerald growth on olive earth, calm and organic for a tool that
          watches pages get indexed.
        </p>
        <div class="flex flex-wrap gap-2 pt-2">
          <UButton to="/kit/colors" trailing-icon="i-lucide-arrow-right">
            Open the system
          </UButton>
          <UButton to="/kit/buttons" color="neutral" variant="outline" icon="i-lucide-sparkles">
            See motion
          </UButton>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <UCard v-for="s in stats" :key="s.label" variant="outline">
        <div class="space-y-1">
          <div class="font-title text-3xl font-bold text-highlighted tabular-nums">
            {{ s.value }}
          </div>
          <div class="text-xs text-default font-medium">
            {{ s.label }}
          </div>
          <div class="text-[10px] text-dimmed font-mono truncate">
            {{ s.hint }}
          </div>
        </div>
      </UCard>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <NuxtLink
        v-for="l in links"
        :key="l.to"
        :to="l.to"
        class="group block"
      >
        <UCard variant="outline" class="h-full transition-all group-hover:ring-primary-500/40">
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <UIcon :name="l.icon" class="size-4 text-primary-500" />
              <div class="font-medium text-highlighted">
                {{ l.label }}
              </div>
            </div>
            <p class="text-sm text-muted">
              {{ l.blurb }}
            </p>
          </div>
        </UCard>
      </NuxtLink>
    </div>
  </div>
</template>
