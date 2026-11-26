<script setup lang="ts">
import type { SiteHoldReason } from '@gscdump/contracts'
import { computed } from 'vue'
import { HELD_LABEL, HELD_TITLE, holdMessage } from '#layers/pro-gsc/shared/entitlement-copy'

const {
  hold,
  siteId,
  canRetry = true,
  retrying = false,
  centered = false,
} = defineProps<{
  hold: SiteHoldReason
  siteId: string
  canRetry?: boolean
  retrying?: boolean
  centered?: boolean
}>()

const emit = defineEmits<{ retry: [] }>()

const submitGoogleTo = computed(() => `/pro/dashboard/sites/${siteId}/indexing/submit`)
const submitIndexNowTo = computed(() => `/pro/dashboard/sites/${siteId}/indexing/indexnow`)
const isLimitHold = computed(() => hold === 'size_limit' || hold === 'sitemap_limit')
const isPending = computed(() => hold === 'size_pending')
const isUnknown = computed(() => hold === 'size_unknown')
</script>

<template>
  <div
    class="rounded-xl border border-default bg-elevated p-5 sm:p-6"
    :class="centered ? 'text-center' : ''"
    data-testid="site-hold-card"
  >
    <div class="flex flex-wrap items-center gap-2.5" :class="centered ? 'justify-center' : ''">
      <span
        class="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-default bg-muted"
        aria-hidden="true"
      >
        <UIcon
          :name="isPending ? 'i-heroicons-arrow-path' : 'i-heroicons-pause-circle'"
          class="size-4"
          :class="isPending ? 'animate-spin text-primary' : 'text-warning'"
        />
      </span>
      <UBadge
        :color="isPending ? 'primary' : 'warning'"
        variant="subtle"
        :label="isPending ? 'Checking size' : HELD_LABEL"
      />
      <h2 class="font-title text-base font-semibold text-highlighted">
        {{ isPending ? 'Checking Site size' : HELD_TITLE }}
      </h2>
    </div>

    <p class="mt-2.5 text-sm leading-relaxed text-muted" :class="centered ? 'mx-auto max-w-md' : 'max-w-2xl'">
      {{ holdMessage(hold) }}
    </p>

    <!-- Capacity bar for size_limit and sitemap_limit (neutral surface, emerald-to-soft-amber plain fill) -->
    <div
      v-if="isLimitHold"
      class="mt-4 rounded-lg border border-default bg-muted/60 px-3.5 py-3 text-left"
    >
      <div class="flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span class="text-muted">
          {{ hold === 'size_limit' ? 'Daily Search Console rows' : 'Sitemap URLs' }}
        </span>
        <span class="font-medium tabular-nums text-warning">
          Above Free allowance
        </span>
      </div>

      <div class="relative mt-2.5 pb-5">
        <div
          class="flex h-2 w-full overflow-hidden rounded-full bg-accented"
          role="img"
          :aria-label="hold === 'size_limit' ? 'Daily Search Console rows exceed the 10,000 Free limit' : 'Sitemap URLs exceed the Free allowance limit'"
        >
          <span class="h-full w-2/5 bg-primary" />
          <span class="h-full flex-1 bg-warning/75" />
        </div>
        <span
          class="pointer-events-none absolute top-[-3px] left-[40%] h-3.5 w-0.5 rounded-full bg-inverted ring-2 ring-muted"
          aria-hidden="true"
        />
        <div class="relative mt-1.5 flex items-center justify-between text-[11px] tabular-nums text-dimmed">
          <span>0</span>
          <span class="absolute left-[40%] -translate-x-1/2 whitespace-nowrap font-medium text-default">
            {{ hold === 'size_limit' ? '10,000 Free limit' : 'Free limit' }}
          </span>
          <span class="font-medium text-warning">Above limit</span>
        </div>
      </div>
    </div>

    <!-- Calm status pill for size_unknown or size_pending -->
    <div v-else class="mt-4 flex flex-wrap items-center gap-2" :class="centered ? 'justify-center' : ''">
      <span class="inline-flex items-center gap-1.5 rounded-full border border-default bg-muted px-3 py-1 text-xs font-medium text-muted">
        <UIcon
          :name="isPending ? 'i-heroicons-arrow-path' : 'i-heroicons-clock'"
          class="size-3.5 shrink-0"
          :class="isPending ? 'animate-spin text-primary' : 'text-warning'"
          aria-hidden="true"
        />
        <span>{{ isPending ? 'Checking Site size' : 'Size check timed out' }}</span>
      </span>
    </div>

    <!-- Two calm capability chips -->
    <div
      v-if="!isPending"
      class="mt-3.5 flex flex-wrap items-center gap-2"
      :class="centered ? 'justify-center' : ''"
    >
      <span class="inline-flex items-center gap-1.5 rounded-md border border-default bg-muted px-2.5 py-1 text-xs font-medium text-muted">
        <UIcon name="i-heroicons-x-mark" class="size-3.5 shrink-0 text-warning" aria-hidden="true" />
        <span>Automatic sync paused</span>
      </span>
      <span class="inline-flex items-center gap-1.5 rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
        <UIcon name="i-heroicons-check" class="size-3.5 shrink-0" aria-hidden="true" />
        <span>Manual URL submit &amp; IndexNow still work</span>
      </span>
    </div>

    <!-- Direct actions -->
    <div class="mt-4 flex flex-wrap items-center gap-2" :class="centered ? 'justify-center' : ''">
      <template v-if="isUnknown && canRetry">
        <UButton
          color="primary"
          variant="solid"
          size="sm"
          icon="i-heroicons-arrow-path"
          label="Retry check"
          class="min-h-11 sm:min-h-9"
          :loading="retrying"
          :disabled="retrying"
          @click="emit('retry')"
        />
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-heroicons-paper-airplane"
          label="Submit to Google"
          class="min-h-11 sm:min-h-9"
          :to="submitGoogleTo"
        />
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-heroicons-link"
          label="Submit with IndexNow"
          class="min-h-11 sm:min-h-9"
          :to="submitIndexNowTo"
        />
      </template>
      <template v-else-if="isPending">
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-heroicons-paper-airplane"
          label="Submit to Google"
          class="min-h-11 sm:min-h-9"
          :to="submitGoogleTo"
        />
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          icon="i-heroicons-link"
          label="Submit with IndexNow"
          class="min-h-11 sm:min-h-9"
          :to="submitIndexNowTo"
        />
      </template>
      <template v-else>
        <UButton
          color="primary"
          variant="solid"
          size="sm"
          icon="i-heroicons-paper-airplane"
          label="Submit to Google"
          class="min-h-11 sm:min-h-9"
          :to="submitGoogleTo"
        />
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-heroicons-link"
          label="Submit with IndexNow"
          class="min-h-11 sm:min-h-9"
          :to="submitIndexNowTo"
        />
      </template>
    </div>
  </div>
</template>
