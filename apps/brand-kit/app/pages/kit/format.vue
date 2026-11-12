<script setup lang="ts">
import { clamp, percentChange } from '@nuxtseo/design-system/app/utils/number'

definePageMeta({ layout: 'kit' })
useHead({ title: 'Formatters · Brand Kit' })

const numberHelpers = [
  { call: 'percentChange(120, 100)', out: percentChange(120, 100) },
  { call: 'percentChange(80, 100)', out: percentChange(80, 100) },
  { call: 'percentChange(50, 0)', out: percentChange(50, 0) },
  { call: 'calcTrendPercent(120, 100)', out: calcTrendPercent(120, 100) },
  { call: 'calcTrendPercent(8, 12, true)', out: calcTrendPercent(8, 12, true) },
  { call: 'clamp(150, 0, 100)', out: clamp(150, 0, 100) },
  { call: 'clamp(-5, [1,2,3,4,5])', out: clamp(-5, [1, 2, 3, 4, 5]) },
]
</script>

<template>
  <div class="space-y-8">
    <KitHeader
      eyebrow="Code"
      title="Formatters"
      description="Number helpers from @nuxtseo/design-system."
    />

    <KitSection title="Number helpers" code="utils/number.ts">
      <UCard variant="outline">
        <table class="w-full text-sm">
          <tbody>
            <tr v-for="(h, i) in numberHelpers" :key="i" class="border-b border-default last:border-0">
              <td class="py-2 w-72">
                <code class="font-mono text-xs text-default">{{ h.call }}</code>
              </td>
              <td class="py-2 font-mono text-default tabular-nums">
                {{ h.out }}
              </td>
            </tr>
          </tbody>
        </table>
      </UCard>
    </KitSection>
  </div>
</template>
