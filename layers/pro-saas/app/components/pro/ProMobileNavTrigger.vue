<script setup lang="ts">
import { UiButton, UiIcon } from '#components'
import { useUiAppShellNav } from '#layers/design-system/app/composables/useAppShellNav'

// Ported from nuxtseo.com's `layers/saas/app/components/pro/ProMobileNavTrigger.vue`.
// The mobile drawer trigger for a screen with no page header. The shell sets
// `inlineMobileNav`, so `ProPageHeader` hosts the only other trigger below
// `lg`. When the header is hidden (a route with no title, or the error page),
// a phone user would otherwise have no sidebar and no in-app navigation.
// Null nav (outside a shell) renders nothing, like every `useUiAppShellNav`
// consumer.
const shellNav = useUiAppShellNav()
</script>

<template>
  <UiButton
    v-if="shellNav"
    purpose="quiet"
    class="lg:hidden -ml-2 min-h-11 min-w-11 shrink-0"
    aria-label="Open navigation menu"
    @click="shellNav.openNav()"
  >
    <UiIcon name="menu" class="size-5" aria-hidden="true" />
  </UiButton>
</template>
