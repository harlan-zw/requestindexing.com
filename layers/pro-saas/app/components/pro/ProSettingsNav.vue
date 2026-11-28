<script setup lang="ts">
import type { UiNavLink } from '@nuxtseo/design-system/app/shared/nav'
import { INTEGRATIONS_ROUTE } from '#layers/pro-features/app/utils/integrations-pending'

const route = useRoute()
const menuOpen = ref(false)
watch(() => route.path, () => {
  menuOpen.value = false
})

const groups: { label: string, navLabel: string, links: UiNavLink[] }[] = [
  {
    label: 'Account',
    navLabel: 'Account settings',
    links: [
      { label: 'Account', to: '/pro/dashboard/account', icon: 'user' },
      { label: 'Usage', to: '/pro/dashboard/usage', icon: 'gauge' },
      { label: 'Integrations', to: INTEGRATIONS_ROUTE, icon: 'plug' },
      { label: 'Developers', to: '/pro/dashboard/developers', icon: 'terminal' },
    ],
  },
  {
    label: 'Team',
    navLabel: 'Team settings',
    links: [
      { label: 'General', to: '/pro/dashboard/team/settings', icon: 'settings' },
      { label: 'Members', to: '/pro/dashboard/team/members', icon: 'users' },
    ],
  },
]
</script>

<template>
  <div class="self-start">
    <UiDisclosure v-model:open="menuOpen" label="Settings menu" class="rounded-lg px-3 py-1 ring-1 ring-default lg:hidden">
      <div class="space-y-5 pb-2">
        <div v-for="group in groups" :key="group.label">
          <p class="mb-1.5 px-1 text-sm font-medium text-dimmed">
            {{ group.label }}
          </p>
          <UiNavList variant="sidebar" :links="group.links" :label="group.navLabel" />
        </div>
      </div>
    </UiDisclosure>

    <div class="hidden space-y-5 lg:sticky lg:top-6 lg:block">
      <div v-for="group in groups" :key="group.label">
        <p class="mb-1.5 px-1 text-sm font-medium text-dimmed">
          {{ group.label }}
        </p>
        <UiNavList variant="sidebar" :links="group.links" :label="group.navLabel" />
      </div>
    </div>
  </div>
</template>
