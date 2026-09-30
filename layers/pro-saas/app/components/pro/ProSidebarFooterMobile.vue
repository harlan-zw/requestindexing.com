<script setup lang="ts">
import type { ProUserMenuItem } from '../../composables/useProUserMenu'
import { computed } from 'vue'
import { UAvatar, UColorModeButton, UDropdownMenu, UiIcon, UiNavIcon, USeparator } from '#components'
import { useProUserMenu } from '../../composables/useProUserMenu'
import ProTeamAvatar from './ProTeamAvatar.vue'

// The drawer's footer. Ported from nuxtseo.com's `ProSidebarFooterMobile.vue`:
// the desktop footer's user menu behind a separator, on a 44px row, and every
// menu item closes the drawer. A route change closes it already; an item that
// lands on the current page does not change the route.
const { singleSite = false } = defineProps<{ singleSite?: boolean }>()
const emit = defineEmits<{ navigate: [] }>()

const { session } = useUserSession()
const { items, menuUi } = useProUserMenu({ singleSite: () => singleSite })

const drawerItems = computed<ProUserMenuItem[][]>(() => items.value.map(group => group.map((item) => {
  if (item.type === 'label' || item.type === 'separator')
    return item
  return {
    ...item,
    onSelect: (event: Event) => {
      item.onSelect?.(event)
      emit('navigate')
    },
  }
})))
</script>

<template>
  <div>
    <USeparator class="my-3" />
    <div class="flex min-h-11 items-center gap-1">
      <UDropdownMenu
        :items="drawerItems"
        :content="{ side: 'top', align: 'start', sideOffset: 12, collisionPadding: 12 }"
        :ui="menuUi"
        class="min-w-0 flex-1"
      >
        <button
          type="button"
          class="flex min-h-11 w-full cursor-pointer items-center gap-2.5 rounded-lg px-1 transition-colors hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <UAvatar :src="session?.user?.avatarUrl ?? undefined" alt="" size="xs" />
          <span class="min-w-0 flex-1 truncate text-left text-sm font-medium text-default">
            {{ session?.user?.name ?? 'Account' }}
          </span>
          <UiIcon name="more" class="size-3.5 shrink-0 text-dimmed" aria-hidden="true" />
        </button>
        <template #item-leading="{ item }">
          <ProTeamAvatar v-if="item.workspaceTeam" :team="item.workspaceTeam" size="xs" class="shrink-0" />
          <UiNavIcon v-else-if="item.icon" :icon="item.icon" class="shrink-0" />
        </template>
        <template #item-trailing="{ item }">
          <UiIcon v-if="item.workspaceActive" name="check" class="size-4 shrink-0 text-default" aria-hidden="true" />
        </template>
      </UDropdownMenu>
      <UColorModeButton size="xs" variant="ghost" color="neutral" class="shrink-0" />
    </div>
  </div>
</template>
