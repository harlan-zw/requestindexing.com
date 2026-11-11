<script setup lang="ts">
// One collapsible sidebar group. Ported from nuxtseo.com's
// `layers/saas/app/components/pro/ProNavSection.vue`.
import type { UiNavLink } from '@nuxtseo/design-system/app/shared/nav'
import { useLocalStorage } from '@vueuse/core'
import { useRoute } from 'nuxt/app'
import { computed } from 'vue'
import { UiIcon, UiNavList } from '#components'

const { groupId, label, links } = defineProps<{
  /** Stable group id. Keys the persisted collapse state. */
  groupId: string
  label: string
  links: UiNavLink[]
}>()

// Fired on link clicks, not on the collapse toggle, so a drawer host can close.
const emit = defineEmits<{ navigate: [] }>()

const route = useRoute()

// Collapse state persists across navigations, keyed by group id. A section
// holding the active route always renders open regardless of stored state, so
// the current page is never hidden behind a collapsed header.
const collapsed = useLocalStorage<Record<string, boolean>>('pro-nav-sections-collapsed', {})

const hasActiveLink = computed(() => links.some(link =>
  link.active
    ? link.active(route.path)
    : route.path === link.to || route.path.startsWith(`${link.to}/`),
))

const open = computed(() => hasActiveLink.value || !collapsed.value[groupId])

function toggle() {
  collapsed.value = { ...collapsed.value, [groupId]: open.value }
}
</script>

<template>
  <div>
    <button
      type="button"
      class="mb-0.5 flex min-h-11 w-full cursor-pointer items-center gap-1 rounded px-1 text-sm font-medium tracking-wide text-dimmed transition-colors hover:text-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:mb-1.5 lg:min-h-0 lg:text-xs dark:text-muted"
      :aria-expanded="open"
      @click="toggle"
    >
      <UiIcon
        name="chevron-right"
        class="size-3 shrink-0 transition-transform duration-150"
        :class="open ? 'rotate-90' : ''"
        aria-hidden="true"
      />
      {{ label }}
    </button>
    <UiNavList
      v-show="open"
      variant="sidebar"
      tone="default"
      class="pl-0"
      :links="links"
      :label="label"
      active-mode="prefix"
      @click="emit('navigate')"
    />
  </div>
</template>
