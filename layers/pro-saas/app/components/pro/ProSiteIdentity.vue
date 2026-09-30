<script setup lang="ts">
import { computed } from 'vue'
import { NuxtLink, UiFavicon } from '#components'

const {
  url,
  name,
  size,
  faviconClass,
  titleSize = 'sm',
  hideSubtitle,
  to,
  variant = 'detail',
} = defineProps<{
  url: string
  name?: string | null
  /** UiFavicon size in px */
  size?: number
  /** Extra classes on the favicon */
  faviconClass?: string
  /** Name typography scale. Bump it where the identity competes with large metrics. */
  titleSize?: 'sm' | 'base' | 'lg' | 'xl'
  /** Hide the hostname second line, rendering the name on a single line. */
  hideSubtitle?: boolean
  /** When set, the name becomes a link to this route (row → site dashboard). */
  to?: string | null
  /** Compact, single-line identity for selectors, suggestions, and event rows. */
  variant?: 'detail' | 'token'
}>()

function getHostname(url: string) {
  try {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`
    return new URL(fullUrl).hostname
  }
  catch {
    return url
  }
}

const hostname = computed(() => getHostname(url))
const displayName = computed(() => name || hostname.value)
const faviconSize = computed(() => size ?? (variant === 'token' ? 16 : 32))
const showSubtitle = computed(() => variant === 'detail' && !hideSubtitle && name && name !== hostname.value)

const titleClass = computed(() => ({
  sm: variant === 'token' ? 'text-xs font-medium' : 'text-sm font-medium',
  base: 'text-base font-semibold',
  lg: 'text-lg font-semibold',
  xl: 'text-xl font-semibold',
}[titleSize]))
</script>

<template>
  <div
    class="min-w-0 items-center"
    :class="variant === 'token' ? 'inline-flex gap-1.5' : 'flex gap-3'"
  >
    <UiFavicon :domain="hostname" :fallback-label="displayName" :size="faviconSize" decorative :class="faviconClass" />
    <div class="flex flex-col min-w-0">
      <NuxtLink
        v-if="to"
        :to="to"
        class="text-default truncate hover:text-primary hover:underline transition-colors"
        :class="titleClass"
        @click.stop
      >
        {{ displayName }}
      </NuxtLink>
      <span v-else class="text-default truncate" :class="titleClass">
        {{ displayName }}
      </span>
      <span v-if="showSubtitle" class="text-xs text-dimmed truncate">
        {{ hostname }}
      </span>
    </div>
  </div>
</template>
