<script setup lang="ts">
import { NuxtLink, UiIcon } from '#components'

// Wraps the sidebar body, desktop rail and drawer alike. Adapted from
// nuxtseo.com's `apps/pro/app/components/ProSidebarModes.vue`, minus the
// Browse and Agents mode tabs: this app has no agent surface. What stays is
// the way out of one Site for an account with more than one, above that Site's
// nav, where upstream shows it.
const { showBack = false } = defineProps<{ showBack?: boolean }>()
const emit = defineEmits<{ navigate: [] }>()
</script>

<template>
  <div class="flex min-h-full min-w-0 flex-col gap-3">
    <nav v-if="showBack" aria-label="Team navigation" class="-mt-1">
      <NuxtLink
        to="/pro/dashboard"
        class="inline-flex min-h-11 items-center gap-2 rounded-sm px-1 text-sm font-medium text-muted transition-colors hover:text-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:min-h-8"
        @click="emit('navigate')"
      >
        <UiIcon name="back" class="size-4" aria-hidden="true" />
        All Sites
      </NuxtLink>
    </nav>
    <!-- The nav body grows to fill, so its `mt-auto` rail pins to the bottom. -->
    <div class="flex flex-1 flex-col *:flex-1">
      <slot />
    </div>
  </div>
</template>
