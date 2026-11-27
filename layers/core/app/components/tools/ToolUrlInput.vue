<script setup lang="ts">
import type { ToolHistoryItem } from '../../composables/useToolHistory'
import { useId } from 'vue'

const {
  label = 'Page URL',
  placeholder = 'https://example.com/page',
  loading = false,
  loadingText = 'Checking…',
  buttonText = 'Check URL',
  history = [],
} = defineProps<{
  label?: string
  placeholder?: string
  loading?: boolean
  loadingText?: string
  buttonText?: string
  history?: ToolHistoryItem[]
}>()

const emit = defineEmits<{
  submit: []
  selectHistory: [query: string]
  clearHistory: []
}>()

const model = defineModel<string>({ default: '' })
const inputId = useId()

function handleSubmit() {
  if (model.value.trim())
    emit('submit')
}
</script>

<template>
  <form class="space-y-3" @submit.prevent="handleSubmit">
    <label :for="inputId" class="block text-sm font-medium text-highlighted">
      {{ label }}
    </label>
    <div class="flex flex-col gap-3 sm:flex-row">
      <UInput
        :id="inputId"
        v-model="model"
        name="url"
        autocomplete="url"
        inputmode="url"
        :placeholder="placeholder"
        size="xl"
        class="min-h-11 flex-1 [&_input]:min-h-11"
        icon="link"
        :disabled="loading"
      />
      <UButton
        type="submit"
        size="xl"
        color="primary"
        :loading="loading"
        :disabled="!model.trim() || loading"
        class="min-h-11 w-full justify-center sm:w-auto"
      >
        {{ loading ? loadingText : buttonText }}
      </UButton>
    </div>

    <div v-if="history.length > 0 && !loading" class="flex flex-wrap items-center gap-1.5 pt-1">
      <span class="text-xs text-dimmed mr-1">Recent:</span>
      <button
        v-for="item in history.slice(0, 5)"
        :key="item.id"
        type="button"
        class="inline-flex max-w-56 items-center truncate rounded-md border border-default bg-muted/60 px-2 py-1 font-mono text-xs text-muted hover:border-accented hover:text-highlighted transition-colors"
        :title="item.query"
        @click="emit('selectHistory', item.query)"
      >
        <span class="truncate">{{ item.query }}</span>
      </button>
      <button
        type="button"
        class="ml-1 text-xs text-dimmed hover:text-muted transition-colors"
        @click="emit('clearHistory')"
      >
        Clear
      </button>
    </div>
  </form>
</template>
