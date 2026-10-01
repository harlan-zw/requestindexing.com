<script lang="ts" setup>
import { useTimeoutFn } from '@vueuse/core'

/**
 * Every async card in the dashboard used to render one branch for
 * `status === 'pending'` and lump error, empty and "never started" together
 * into a single grey sentence. A request that hung left a bare spinner on
 * screen forever, so a stuck card and a loading card looked identical.
 *
 * This component makes the four states explicit and adds a watchdog: a fetch
 * that stays pending past `timeoutMs` stops pretending to load and offers a
 * retry. `idle` is treated the same way, because a card that mounted but never
 * fetched is also stuck.
 */
type FetchStatus = 'idle' | 'pending' | 'success' | 'error'

type CardState
  = | { _tag: 'pending' }
    | { _tag: 'stalled' }
    | { _tag: 'error', message: string }
    | { _tag: 'empty' }
    | { _tag: 'loaded' }

const props = withDefaults(defineProps<{
  status: FetchStatus
  error?: unknown
  /** True when the request succeeded but carries nothing to show. */
  empty?: boolean
  /** Noun used in generated messages, for example "indexing data". */
  label?: string
  emptyMessage?: string
  errorMessage?: string
  /** Skeleton line count while pending. */
  rows?: number
  timeoutMs?: number
  /** Shared height for pending, stalled, error and empty, so states do not jump. */
  minHeight?: string
}>(), {
  label: 'data',
  rows: 3,
  timeoutMs: 15000,
  minHeight: 'min-h-32',
})

const emit = defineEmits<{ retry: [] }>()

const stalled = ref(false)
const { start, stop } = useTimeoutFn(() => {
  stalled.value = true
}, () => props.timeoutMs, { immediate: false })

function watchLoading(status: FetchStatus) {
  stop()
  stalled.value = false
  if (status === 'pending' || status === 'idle')
    start()
}

onMounted(() => watchLoading(props.status))
watch(() => props.status, watchLoading)

/**
 * A stalled card is already `pending`, so `refresh()` sets `pending` again and
 * the status watcher never fires. Retry therefore restarts the watchdog itself,
 * which clears `stalled` and returns the panel to the skeleton straight away.
 */
function retry() {
  watchLoading(props.status)
  emit('retry')
}

function errorMessage(error: unknown): string {
  const detail = error as { statusCode?: number, status?: number } | null
  const statusCode = detail?.statusCode ?? detail?.status
  if (statusCode === 401 || statusCode === 403)
    return 'Your session has expired. Sign in again to see this data.'
  if (statusCode === 404)
    return `No ${props.label} exists for this Site yet.`
  return props.errorMessage ?? `The ${props.label} could not load.`
}

const state = computed<CardState>(() => {
  if (props.status === 'error')
    return { _tag: 'error', message: errorMessage(props.error) }
  if (props.status === 'pending' || props.status === 'idle')
    return stalled.value ? { _tag: 'stalled' } : { _tag: 'pending' }
  return props.empty ? { _tag: 'empty' } : { _tag: 'loaded' }
})

const skeletonRows = computed(() => Array.from({ length: props.rows }, (_, index) => index))
</script>

<template>
  <!-- One root element for every state. A branch-per-state template changed the
       root node shape when data arrived, so a class set by the parent applied to
       the skeleton and then disappeared on the loaded card. -->
  <div class="w-full">
    <div
      v-if="state._tag === 'pending'"
      class="flex w-full flex-col justify-center gap-2 py-2"
      :class="minHeight"
      aria-live="polite"
      aria-busy="true"
    >
      <span class="sr-only">Loading {{ label }}</span>
      <USkeleton v-for="row in skeletonRows" :key="row" class="h-4 w-full" :class="row % 3 === 2 ? 'max-w-[60%]' : ''" />
    </div>

    <div
      v-else-if="state._tag === 'stalled'"
      class="flex w-full flex-col items-center justify-center gap-3 py-4 text-center"
      :class="minHeight"
      role="status"
    >
      <UIcon name="i-lucide-clock-alert" class="size-6 text-warning" />
      <div>
        <p class="font-medium text-highlighted">
          Still loading
        </p>
        <p class="text-sm text-muted">
          The {{ label }} is taking longer than expected. Retry to load it again.
        </p>
      </div>
      <UButton label="Retry" color="neutral" variant="outline" size="sm" class="min-h-10" @click="retry()" />
    </div>

    <div
      v-else-if="state._tag === 'error'"
      class="flex w-full flex-col items-center justify-center gap-3 py-4 text-center"
      :class="minHeight"
      role="alert"
    >
      <UIcon name="i-lucide-cloud-off" class="size-6 text-error" />
      <div>
        <p class="font-medium text-highlighted">
          Could not load
        </p>
        <p class="text-sm text-muted">
          {{ state.message }}
        </p>
      </div>
      <UButton label="Retry" color="neutral" variant="outline" size="sm" class="min-h-10" @click="retry()" />
    </div>

    <div
      v-else-if="state._tag === 'empty'"
      class="flex w-full flex-col items-center justify-center gap-3 py-4 text-center"
      :class="minHeight"
    >
      <slot name="empty">
        <UIcon name="i-lucide-inbox" class="size-6 text-dimmed" />
        <div>
          <p class="font-medium text-highlighted">
            Nothing to show
          </p>
          <p class="text-sm text-muted">
            {{ emptyMessage ?? `No ${label} for this period.` }}
          </p>
        </div>
      </slot>
    </div>

    <slot v-else />
  </div>
</template>
