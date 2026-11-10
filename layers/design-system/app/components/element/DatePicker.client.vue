<script setup lang="ts">
import { DatePicker as VCalendarDatePicker } from 'v-calendar'
import 'v-calendar/dist/style.css'

type CalendarDateValue = Date | Partial<{ year: number, month: number, day: number }>
interface CalendarDateRange {
  start: CalendarDateValue
  end: CalendarDateValue
}
type CalendarModelValue = CalendarDateValue | CalendarDateRange | null

defineOptions({
  inheritAttrs: false,
})

const emit = defineEmits<{ close: [] }>()
const model = defineModel<CalendarModelValue>({ default: null })
const date = computed({
  get: () => model.value,
  set: (value: CalendarModelValue) => {
    model.value = value
    emit('close')
  },
})

const attrs = {
  'transparent': true,
  'borderless': true,
  'color': 'primary',
  'is-dark': { selector: 'html', darkClass: 'dark' },
  'first-day-of-week': 2,
}

// max date is yesterday, min date is 16 months ago
const maxDate = new Date()
maxDate.setDate(maxDate.getDate() - 1)
const minDate = new Date()
minDate.setMonth(minDate.getMonth() - 16)

const isRange = computed(() => model.value !== null && !(model.value instanceof Date) && 'start' in model.value)
</script>

<template>
  <VCalendarDatePicker
    v-if="isRange"
    v-model.range="date"
    :max-date="maxDate"
    :min-date="minDate"
    v-bind="{ ...attrs, ...$attrs, columns: 2 } satisfies { columns: number }"
  />
  <VCalendarDatePicker
    v-else
    v-model="date"
    v-bind="{ ...attrs, ...$attrs }"
  />
</template>

<style>
:root {
  --vc-gray-50: rgb(var(--color-gray-50));
  --vc-gray-100: rgb(var(--color-gray-100));
  --vc-gray-200: rgb(var(--color-gray-200));
  --vc-gray-300: rgb(var(--color-gray-300));
  --vc-gray-400: rgb(var(--color-gray-400));
  --vc-gray-500: rgb(var(--color-gray-500));
  --vc-gray-600: rgb(var(--color-gray-600));
  --vc-gray-700: rgb(var(--color-gray-700));
  --vc-gray-800: rgb(var(--color-gray-800));
  --vc-gray-900: rgb(var(--color-gray-900));
}

.vc-primary {
  --vc-accent-50: rgb(var(--color-primary-50));
  --vc-accent-100: rgb(var(--color-primary-100));
  --vc-accent-200: rgb(var(--color-primary-200));
  --vc-accent-300: rgb(var(--color-primary-300));
  --vc-accent-400: rgb(var(--color-primary-400));
  --vc-accent-500: rgb(var(--color-primary-500));
  --vc-accent-600: rgb(var(--color-primary-600));
  --vc-accent-700: rgb(var(--color-primary-700));
  --vc-accent-800: rgb(var(--color-primary-800));
  --vc-accent-900: rgb(var(--color-primary-900));
}

.vc-title {
  font-size: 0.9rem;
  font-weight: 500;
}
</style>
