<script setup lang="ts">
definePageMeta({ layout: 'kit' })
useHead({ title: 'Elements · Brand Kit' })

function resolveGridTooltip({ row, col, value }: { row: number, col: number, value: unknown }) {
  const count = Number(value)
  return {
    title: `Cell r${row}·c${col}`,
    level: count > 60 ? 'success' as const : count > 30 ? 'warning' as const : 'neutral' as const,
    details: [
      { label: 'Hits', value: String(value) },
      { label: 'Day', value: `2026-05-${String((col % 28) + 1).padStart(2, '0')}` },
    ],
  }
}
</script>

<template>
  <div class="space-y-8">
    <KitHeader
      eyebrow="Components"
      title="Elements"
      description="Small, focused primitives from the design-system layer."
    />

    <KitSection
      title="UiIconBox"
      code="<UiIconBox>"
      description="Square icon plate. Used in headers, nav menu items, empty states."
    >
      <UCard variant="outline">
        <div class="space-y-4">
          <KitRow label="Sizes">
            <UiIconBox icon="i-lucide-search" size="sm" />
            <UiIconBox icon="i-lucide-search" size="md" />
          </KitRow>
          <KitRow label="With hover (group)">
            <div class="group flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer">
              <UiIconBox icon="i-lucide-link" hover />
              <span class="text-sm text-default">Hover the row</span>
            </div>
          </KitRow>
          <KitRow label="Gallery">
            <UiIconBox v-for="i in ['i-lucide-globe', 'i-lucide-zap', 'i-lucide-bug', 'i-lucide-shield-check', 'i-lucide-database', 'i-lucide-bar-chart-3']" :key="i" :icon="i" />
          </KitRow>
        </div>
      </UCard>
    </KitSection>

    <KitSection
      title="UiHelpLabel"
      code="<UiHelpLabel>"
      description="Label with an inline (?) help icon. Tooltip on hover."
    >
      <UCard variant="outline">
        <div class="space-y-4 max-w-md">
          <UiHelpLabel
            text="Indexed pages"
            tooltip="Pages Google has confirmed in its index in the last 28 days."
          />
          <UiHelpLabel
            text="Crawl budget"
            tooltip-title="Crawl budget"
            tooltip="The number of pages Googlebot is willing to crawl per day for this site."
          />
        </div>
      </UCard>
    </KitSection>

    <KitSection
      title="UiProgressCircle"
      code="<UiProgressCircle>"
      description="Circular progress ring sized to the surrounding row."
    >
      <UCard variant="outline">
        <div class="flex flex-wrap items-end gap-6">
          <div v-for="p in [12, 35, 58, 84, 100]" :key="p" class="flex flex-col items-center gap-2">
            <UiProgressCircle :percent="p" />
            <span class="text-[10px] text-dimmed font-mono">{{ p }}%</span>
          </div>
          <div class="flex flex-col items-center gap-2">
            <UiProgressCircle :percent="72" :size="64" :stroke-size="6" />
            <span class="text-[10px] text-dimmed font-mono">size 64</span>
          </div>
          <div class="flex flex-col items-center gap-2">
            <UiProgressCircle :percent="48" lighter />
            <span class="text-[10px] text-dimmed font-mono">lighter</span>
          </div>
        </div>
      </UCard>
    </KitSection>

    <KitSection
      title="UiTooltipGrid"
      code="<UiTooltipGrid>"
      description="A high-performance tooltip designed for dense grids (heatmaps, packed bar cells). Trigger emits coordinates; tooltip is reused via a transform translate."
    >
      <UCard variant="outline">
        <div class="space-y-3">
          <p class="text-xs text-muted">
            Hover any cell — a single tooltip element follows the cursor instead of mounting one per cell.
          </p>
          <UiTooltipGrid
            :resolve="resolveGridTooltip"
          >
            <div class="grid grid-cols-12 gap-px">
              <div
                v-for="i in 96"
                :key="i"
                :data-tooltip-row="Math.floor((i - 1) / 12)"
                :data-tooltip-col="(i - 1) % 12"
                :data-tooltip-value="Math.round((i * 13.7) % 100)"
                class="aspect-square rounded-sm cursor-pointer transition-transform hover:scale-110"
                :style="{ backgroundColor: `color-mix(in oklab, var(--ui-primary) ${5 + (i * 0.9) % 80}%, transparent)` }"
              />
            </div>
          </UiTooltipGrid>
        </div>
      </UCard>
    </KitSection>

    <KitSection
      title="UiProgressPercent"
      code="<UiProgressPercent>"
      description="Slot + UProgress wrapped in a tooltip. Designed for inline share-of-total bars in tables."
    >
      <UCard variant="outline">
        <div class="space-y-4 max-w-md">
          <UiProgressPercent :value="42" :total="100" color="primary">
            <div class="text-xs text-default mb-1 flex justify-between">
              <span>/blog</span><span class="tabular-nums">42</span>
            </div>
          </UiProgressPercent>
          <UiProgressPercent :value="18" :total="100" color="primary">
            <div class="text-xs text-default mb-1 flex justify-between">
              <span>/docs</span><span class="tabular-nums">18</span>
            </div>
          </UiProgressPercent>
          <UiProgressPercent :value="7" :total="100" color="primary">
            <div class="text-xs text-default mb-1 flex justify-between">
              <span>/pricing</span><span class="tabular-nums">7</span>
            </div>
          </UiProgressPercent>
        </div>
      </UCard>
    </KitSection>

    <KitSection
      title="Gradient"
      code="<Gradient>"
      description="Soft primary radial bloom on a faint grid. Use as an absolute background behind a hero panel."
    >
      <UCard variant="outline" class="overflow-hidden p-0">
        <div class="relative h-[180px] flex items-center justify-center">
          <Gradient />
          <div class="relative z-10 text-center space-y-1">
            <div class="font-title text-xl font-semibold text-highlighted">
              Gradient backdrop
            </div>
            <div class="text-xs text-muted">
              Sits behind page heroes
            </div>
          </div>
        </div>
      </UCard>
    </KitSection>

    <KitSection
      title="CardTitle"
      code="<CardTitle>"
      description="Card-level title with a quiet kebab dropdown for row-level actions."
    >
      <UCard variant="outline">
        <CardTitle>
          Top countries
        </CardTitle>
        <div class="text-xs text-muted">
          Card body content goes here.
        </div>
      </UCard>
    </KitSection>

    <KitSection
      title="UiTrend"
      code="<UiTrend>"
      description="Compact delta indicator. inverted=true flips success/error (useful for rank position, latency)."
    >
      <UCard variant="outline">
        <div class="space-y-4">
          <KitRow label="Standard">
            <UiTrend :value="12" />
            <UiTrend :value="-7" />
            <UiTrend :value="0" />
            <UiTrend :value="142" />
          </KitRow>
          <KitRow label="Inverted (lower=better)">
            <UiTrend :value="-5" inverted />
            <UiTrend :value="12" inverted />
          </KitRow>
          <KitRow label="Sizes">
            <UiTrend :value="8" size="2xs" />
            <UiTrend :value="8" size="xs" />
            <UiTrend :value="8" size="sm" />
          </KitRow>
        </div>
      </UCard>
    </KitSection>
  </div>
</template>
