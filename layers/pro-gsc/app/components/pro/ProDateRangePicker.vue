<script setup lang="ts">
import type { CompareMode } from '@gscdump/sdk/period'
import type { Period } from '../../composables/useGscPeriod'
import { GSC_STABLE_LATENCY_DAYS } from '@gscdump/sdk/gsc-constants'
import { COMPARE_OPTIONS, PERIOD_PRESETS } from '@gscdump/sdk/period-presets'
import { useIntervalFn } from '@vueuse/core'
import { RadioGroupItem, RadioGroupRoot } from 'reka-ui'
import { computed, onUnmounted, ref } from 'vue'
import { periodVizColors } from '~~/layers/design-system/app/composables/dataVizColors'
import { parseReportingDay } from '~~/layers/design-system/app/composables/formatting'
import { ClientOnly, UiIcon, UiMetricLabel, UiPopover, UiTooltip, USwitch } from '#components'
import { compareRange, parseCustomPeriod, periodToDateRange } from '../../composables/useGscPeriod'

const { showCompare = true, showStable = true } = defineProps<{
  showCompare?: boolean
  showStable?: boolean
}>()

const period = defineModel<Period>('period', { required: true })
const compareMode = defineModel<CompareMode>('compareMode', { required: true })
const stableData = defineModel<boolean>('stableData', { required: true })

const open = ref(false)

// Countdown to next GSC data update (midnight PST)
const countdown = ref('')

function updateCountdown() {
  const now = new Date()
  const pstNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  const msUntilMidnight = (24 * 60 * 60 * 1000)
    - (pstNow.getHours() * 3600000 + pstNow.getMinutes() * 60000 + pstNow.getSeconds() * 1000)
  const totalSeconds = Math.floor(msUntilMidnight / 1000)
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  countdown.value = `${h}h ${m}m`
}

if (import.meta.client) {
  updateCountdown()
  const { pause } = useIntervalFn(updateCountdown, 60_000)
  onUnmounted(pause)
}

const rollingPresets = PERIOD_PRESETS.filter(p => p.group === 'rolling')
const calendarPresets = PERIOD_PRESETS.filter(p => p.group === 'calendar')

const dateRange = computed(() => periodToDateRange(period.value, stableData.value))
const cmpRange = computed(() => compareRange(dateRange.value, compareMode.value))

// Reporting-day labels — UTC frame so they don't drift per viewer (ADR-0082).
const rangeFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const rangeFmtYear = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const numFmt = new Intl.NumberFormat('en-US')

function getPeriodLabel(period: Period): string {
  const custom = parseCustomPeriod(period)
  if (custom) {
    const s = parseReportingDay(custom.start)
    const e = parseReportingDay(custom.end)
    return s.getUTCFullYear() === e.getUTCFullYear()
      ? `${rangeFmt.format(s)} – ${rangeFmtYear.format(e)}`
      : `${rangeFmtYear.format(s)} – ${rangeFmtYear.format(e)}`
  }
  return PERIOD_PRESETS.find(p => p.value === period)?.label ?? period
}

function formatRange(start: string, end: string) {
  const s = parseReportingDay(start)
  const e = parseReportingDay(end)
  if (s.getUTCFullYear() !== e.getUTCFullYear())
    return `${rangeFmtYear.format(s)} – ${rangeFmtYear.format(e)}`
  return `${rangeFmt.format(s)} – ${rangeFmtYear.format(e)}`
}

function selectPeriod(p: Period) {
  period.value = p
  open.value = false
}
</script>

<template>
  <UiPopover v-model:open="open" :content="{ align: 'start', side: 'bottom', sideOffset: 8 }">
    <!-- Trigger -->
    <button
      type="button"
      :aria-label="`Date range: ${getPeriodLabel(period)}`"
      :aria-expanded="open"
      class="min-h-11 cursor-pointer inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 border focus-visible:ring-2 focus-visible:ring-primary sm:min-h-0"
      :class="[
        open
          ? 'border-accented bg-elevated text-default'
          : 'border-default bg-muted text-muted hover:text-default hover:border-accented',
      ]"
    >
      <UiIcon name="calendar" class="size-3.5" aria-hidden="true" />
      <span>{{ getPeriodLabel(period) }}</span>
      <span
        v-if="showCompare && compareMode !== 'none'"
        class="text-mini px-1.5 py-0.5 rounded-sm font-semibold"
        :class="compareMode === 'year' ? `${periodVizColors.current.bg} ${periodVizColors.current.text}` : `${periodVizColors.comparison.bg} ${periodVizColors.comparison.text}`"
      >
        vs {{ compareMode === 'year' ? 'YoY' : 'prev' }}
      </span>
      <UiIcon name="expand" class="size-3 text-dimmed -mr-0.5" aria-hidden="true" />
    </button>

    <!-- Popover content -->
    <template #panel>
      <div class="w-[min(440px,calc(100vw-2rem))]">
        <div class="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-default">
          <!-- Left panel: Presets -->
          <div class="sm:w-[190px] py-1.5" role="group" :aria-label="`Period presets, current: ${getPeriodLabel(period)}`">
            <div class="px-3 pt-1 pb-2">
              <UiMetricLabel aria-hidden="true">
                Rolling
              </UiMetricLabel>
            </div>
            <div>
              <button
                v-for="preset in rollingPresets"
                :key="preset.value"
                type="button"
                :aria-pressed="period === preset.value"
                class="group relative flex min-h-11 w-full cursor-pointer items-center gap-2 py-[5px] pl-3 pr-3 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:min-h-0"
                :class="[
                  period === preset.value
                    ? 'text-default bg-elevated'
                    : 'text-muted hover:text-default hover:bg-[var(--ui-bg-elevated)]/50',
                ]"
                @click="selectPeriod(preset.value)"
              >
                <!-- Active indicator bar -->
                <span
                  v-if="period === preset.value"
                  class="absolute left-0 inset-y-0.5 w-[2px] rounded-full bg-primary"
                />
                <span class="flex-1 text-left">{{ preset.label }}</span>
                <UiIcon
                  v-if="period === preset.value"
                  name="check"
                  class="size-3 text-primary"
                  aria-hidden="true"
                />
              </button>
            </div>

            <div class="mx-3 my-1.5 border-t border-default/50" role="separator" />

            <div class="px-3 pb-2">
              <UiMetricLabel aria-hidden="true">
                Calendar
              </UiMetricLabel>
            </div>
            <div>
              <button
                v-for="preset in calendarPresets"
                :key="preset.value"
                type="button"
                :aria-pressed="period === preset.value"
                class="group relative flex min-h-11 w-full cursor-pointer items-center gap-2 py-[5px] pl-3 pr-3 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:min-h-0"
                :class="[
                  period === preset.value
                    ? 'text-default bg-elevated'
                    : 'text-muted hover:text-default hover:bg-[var(--ui-bg-elevated)]/50',
                ]"
                @click="selectPeriod(preset.value)"
              >
                <span
                  v-if="period === preset.value"
                  class="absolute left-0 inset-y-0.5 w-[2px] rounded-full bg-primary"
                />
                <span class="flex-1 text-left">{{ preset.label }}</span>
                <UiIcon
                  v-if="period === preset.value"
                  name="check"
                  class="size-3 text-primary"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          <!-- Right panel: Context + Comparison -->
          <div class="flex-1 flex flex-col">
            <!-- Date readout -->
            <div class="px-3.5 pt-3 pb-2.5">
              <div class="flex items-baseline gap-2">
                <UiMetricLabel>Range</UiMetricLabel>
                <span class="text-mini text-dimmed">{{ numFmt.format(dateRange.days) }}d</span>
              </div>
              <p class="text-xs font-semibold mt-1 tracking-tight">
                {{ formatRange(dateRange.start, dateRange.end) }}
              </p>
              <!-- Comparison range inline -->
              <p
                v-if="showCompare && cmpRange"
                class="text-mini mt-1 flex items-center gap-1.5"
                :class="compareMode === 'year' ? `${periodVizColors.current.text} opacity-70` : `${periodVizColors.comparison.text} opacity-70`"
              >
                <span class="size-1 rounded-full" :class="compareMode === 'year' ? periodVizColors.current.dot : periodVizColors.comparison.dot" />
                {{ formatRange(cmpRange.start, cmpRange.end) }}
              </p>
            </div>

            <div v-if="showCompare" class="border-t border-default/50" role="separator" />

            <!-- Comparison mode -->
            <div v-if="showCompare" class="px-3.5 py-2.5">
              <UiMetricLabel>Compare To</UiMetricLabel>
              <RadioGroupRoot :model-value="compareMode" aria-label="Comparison mode" class="mt-1.5 flex flex-col gap-0.5" @update:model-value="compareMode = COMPARE_OPTIONS.find(option => option.value === $event)?.value ?? compareMode">
                <RadioGroupItem
                  v-for="opt in COMPARE_OPTIONS"
                  :key="opt.value"
                  :value="opt.value"
                  class="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset sm:min-h-0"
                  :class="[
                    compareMode === opt.value
                      ? 'text-default bg-elevated'
                      : 'text-muted hover:text-default hover:bg-[var(--ui-bg-elevated)]/50',
                  ]"
                >
                  <span
                    class="size-3 rounded-full border-2 shrink-0 transition-colors"
                    :class="compareMode === opt.value ? 'border-primary bg-primary' : 'border-accented'"
                    aria-hidden="true"
                  />
                  <span class="flex-1 text-left">{{ opt.label }}</span>
                </RadioGroupItem>
              </RadioGroupRoot>
            </div>

            <div v-if="showStable" class="border-t border-default/50" role="separator" />

            <!-- Stable data + next update -->
            <div v-if="showStable" class="px-3.5 py-2.5">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <UiMetricLabel>Stable Data</UiMetricLabel>
                  <UiTooltip
                    :title="stableData ? 'Stable Data (On)' : 'Stable Data (Off)'"
                    :description="stableData
                      ? `End date offset by ${GSC_STABLE_LATENCY_DAYS} days. Google takes ~3 days to finalize metrics, this ensures completeness.`
                      : 'Data extends to yesterday. Recent days may show incomplete metrics as Google is still processing.'"
                    side="right"
                    size="md"
                    icon-size="xs"
                  />
                </div>
                <USwitch v-model="stableData" size="xs" aria-label="Use stable (finalized) data" />
              </div>
              <ClientOnly>
                <p class="flex items-center gap-1 text-mini text-dimmed mt-1.5">
                  <UiIcon name="clock" class="size-3" aria-hidden="true" />
                  <span>Next update in {{ countdown }}</span>
                  <UiTooltip
                    title="Next Data Update"
                    description="Time until next midnight PST, when Google Search Console publishes new data."
                    side="right"
                    size="md"
                    icon-size="xs"
                  />
                </p>
              </ClientOnly>
            </div>
          </div>
        </div>
      </div>
    </template>
  </UiPopover>
</template>
