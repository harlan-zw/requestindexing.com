<script setup lang="ts">
import { gscMetricColors, indexingVizColors } from '@nuxtseo/design-system/app/composables/dataVizColors'
import { healthToSemantic, semanticColors, thresholdToSemantic, trendToSemantic } from '@nuxtseo/design-system/app/composables/semanticColors'
import { getIconColor } from '@nuxtseo/design-system/app/utils/icon-color'

definePageMeta({ layout: 'kit' })
useHead({ title: 'Icon palette · Brand Kit' })

const semantic: string[] = ['neutral', 'primary', 'success', 'warning', 'error', 'info']
const named: string[] = ['red', 'orange', 'amber', 'yellow', 'green', 'emerald', 'teal', 'blue', 'cyan', 'sky', 'lime', 'pink', 'rose', 'gray', 'slate']

const dataViz = [
  { label: 'Clicks (GSC)', set: gscMetricColors.clicks, key: 'gscMetricColors.clicks' },
  { label: 'Impressions (GSC)', set: gscMetricColors.impressions, key: 'gscMetricColors.impressions' },
  { label: 'CTR (GSC)', set: gscMetricColors.ctr, key: 'gscMetricColors.ctr' },
  { label: 'Position (GSC)', set: gscMetricColors.position, key: 'gscMetricColors.position' },
  { label: 'Indexed', set: indexingVizColors.indexed, key: 'indexingVizColors.indexed' },
  { label: 'Errors', set: indexingVizColors.errors, key: 'indexingVizColors.errors' },
  { label: 'Not indexed', set: indexingVizColors.notIndexed, key: 'indexingVizColors.notIndexed' },
]

const semanticDemos = [
  { input: 'success', set: semanticColors.success },
  { input: 'warning', set: semanticColors.warning },
  { input: 'error', set: semanticColors.error },
  { input: 'info', set: semanticColors.info },
  { input: 'neutral', set: semanticColors.neutral },
] as const

const healthMap = [
  { health: 'healthy', semantic: healthToSemantic('healthy') },
  { health: 'attention', semantic: healthToSemantic('attention') },
  { health: 'issues', semantic: healthToSemantic('issues') },
  { health: 'unknown', semantic: healthToSemantic('unknown') },
] as const
</script>

<template>
  <div class="space-y-8">
    <KitHeader
      eyebrow="Code"
      title="Icon palette & semantic colors"
      description="Two color libraries: getIconColor() for arbitrary tinting; semanticColors / vizColors for status & metric identity."
    />

    <KitSection
      title="getIconColor()"
      code="utils/icon-color.ts"
      description="Maps a color name to a {bg, text} pair for icon plates. Semantic names first, then a wide Tailwind selection."
    >
      <UCard variant="outline">
        <div class="space-y-5">
          <div>
            <div class="text-xs uppercase tracking-wider text-dimmed font-semibold mb-2">
              Semantic
            </div>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="c in semantic"
                :key="c"
                class="inline-flex items-center gap-2 rounded-md px-2 py-1.5" :class="[getIconColor(c).bg, getIconColor(c).text]"
              >
                <UIcon name="i-lucide-circle" class="size-3" />
                <code class="text-xs font-mono">{{ c }}</code>
              </div>
            </div>
          </div>
          <div>
            <div class="text-xs uppercase tracking-wider text-dimmed font-semibold mb-2">
              Named Tailwind
            </div>
            <div class="flex flex-wrap gap-2">
              <div
                v-for="c in named"
                :key="c"
                class="inline-flex items-center gap-2 rounded-md px-2 py-1.5" :class="[getIconColor(c).bg, getIconColor(c).text]"
              >
                <UIcon name="i-lucide-circle" class="size-3" />
                <code class="text-xs font-mono">{{ c }}</code>
              </div>
            </div>
          </div>
        </div>
      </UCard>
    </KitSection>

    <KitSection
      title="semanticColors"
      code="composables/semanticColors.ts"
      description="text/bg/dot/border/hex sets for system status. Plus mappers: healthToSemantic, thresholdToSemantic, trendToSemantic."
    >
      <UCard variant="outline">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-default">
              <th class="text-left text-[10px] uppercase tracking-wider text-dimmed font-semibold py-2">
                Status
              </th>
              <th class="text-left text-[10px] uppercase tracking-wider text-dimmed font-semibold py-2">
                Dot
              </th>
              <th class="text-left text-[10px] uppercase tracking-wider text-dimmed font-semibold py-2">
                Text
              </th>
              <th class="text-left text-[10px] uppercase tracking-wider text-dimmed font-semibold py-2">
                Bg
              </th>
              <th class="text-left text-[10px] uppercase tracking-wider text-dimmed font-semibold py-2">
                Hex
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in semanticDemos" :key="s.input" class="border-b border-default last:border-0">
              <td class="py-2.5">
                <code class="font-mono text-xs">{{ s.input }}</code>
              </td>
              <td class="py-2.5">
                <span class="size-3 rounded-full inline-block" :class="[s.set.dot]" />
              </td>
              <td class="py-2.5 font-medium" :class="[s.set.text]">
                Aa
              </td>
              <td class="py-2.5">
                <span class="inline-flex items-center gap-1 rounded px-2 py-0.5" :class="[s.set.bg, s.set.text]">sample</span>
              </td>
              <td class="py-2.5 font-mono text-xs text-dimmed">
                {{ s.set.hex }}
              </td>
            </tr>
          </tbody>
        </table>
      </UCard>
    </KitSection>

    <KitSection title="Mappers" code="healthToSemantic() · thresholdToSemantic() · trendToSemantic()">
      <UCard variant="outline">
        <div class="grid md:grid-cols-3 gap-5">
          <div>
            <div class="text-xs uppercase tracking-wider text-dimmed font-semibold mb-2">
              health
            </div>
            <ul class="space-y-1.5 text-sm">
              <li v-for="h in healthMap" :key="h.health" class="flex items-center gap-2">
                <span class="size-2 rounded-full" :class="[semanticColors[h.semantic].dot]" />
                <code class="font-mono text-xs">{{ h.health }} → {{ h.semantic }}</code>
              </li>
            </ul>
          </div>
          <div>
            <div class="text-xs uppercase tracking-wider text-dimmed font-semibold mb-2">
              threshold (good 1.5, poor 3)
            </div>
            <ul class="space-y-1.5 text-sm font-mono text-xs">
              <li class="flex items-center gap-2">
                <span class="size-2 rounded-full" :class="[semanticColors[thresholdToSemantic(1.0, 1.5, 3)].dot]" />
                1.0s → {{ thresholdToSemantic(1.0, 1.5, 3) }}
              </li>
              <li class="flex items-center gap-2">
                <span class="size-2 rounded-full" :class="[semanticColors[thresholdToSemantic(2.4, 1.5, 3)].dot]" />
                2.4s → {{ thresholdToSemantic(2.4, 1.5, 3) }}
              </li>
              <li class="flex items-center gap-2">
                <span class="size-2 rounded-full" :class="[semanticColors[thresholdToSemantic(4.1, 1.5, 3)].dot]" />
                4.1s → {{ thresholdToSemantic(4.1, 1.5, 3) }}
              </li>
            </ul>
          </div>
          <div>
            <div class="text-xs uppercase tracking-wider text-dimmed font-semibold mb-2">
              trend
            </div>
            <ul class="space-y-1.5 text-sm font-mono text-xs">
              <li class="flex items-center gap-2">
                <span class="size-2 rounded-full" :class="[semanticColors[trendToSemantic(12)].dot]" />
                +12 → {{ trendToSemantic(12) }}
              </li>
              <li class="flex items-center gap-2">
                <span class="size-2 rounded-full" :class="[semanticColors[trendToSemantic(-7)].dot]" />
                -7 → {{ trendToSemantic(-7) }}
              </li>
              <li class="flex items-center gap-2">
                <span class="size-2 rounded-full" :class="[semanticColors[trendToSemantic(0)].dot]" />
                0 → {{ trendToSemantic(0) }}
              </li>
            </ul>
          </div>
        </div>
      </UCard>
    </KitSection>

    <KitSection
      title="Data-viz colors"
      code="composables/dataVizColors.ts"
      description="Metric identity: clicks=emerald, impressions=blue, CTR=amber, position=orange. Use only for charts and metric legends — not for system state."
    >
      <UCard variant="outline">
        <table class="w-full text-sm">
          <tbody>
            <tr v-for="d in dataViz" :key="d.key" class="border-b border-default last:border-0">
              <td class="py-2.5">
                <span class="size-3 rounded-full inline-block" :class="[d.set.dot]" />
              </td>
              <td class="py-2.5 text-default">
                {{ d.label }}
              </td>
              <td class="py-2.5">
                <code class="font-mono text-[10px] text-dimmed">{{ d.key }}</code>
              </td>
              <td class="py-2.5 font-mono text-xs text-dimmed">
                {{ d.set.hex }}
              </td>
            </tr>
          </tbody>
        </table>
      </UCard>
    </KitSection>
  </div>
</template>
