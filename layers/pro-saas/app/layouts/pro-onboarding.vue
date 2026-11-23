<script setup lang="ts">
import ProShellOnboardingSurface from '@nuxtseo/pro-shell/app/components/ProShellOnboardingSurface.vue'

// Focused chrome for first-run setup: no sidebar, no dashboard nav, one column.
// `@nuxtseo/pro-shell`'s surface draws it; the brand mark is this app's own.
// The account row is the only way out, so a user who signed in with the wrong
// account is never trapped.
const { session } = useUserSession()
const logout = createLogoutHandler()
const accountLabel = computed(() => session.value?.user?.email ?? session.value?.user?.name ?? 'Account')
</script>

<template>
  <ProShellOnboardingSurface class="min-h-screen" :show-exit="false">
    <!-- The mark sits centred and larger above the step, as on gscdump.com.
         It centres on the column, not in the space the account leaves, so it
         leaves the row's flow, and a spacer keeps the row's height. From
         1024px the account leaves the row too: it sits above the column on
         the right, so the mark stands alone. Narrower, it stays beside the
         mark, and only Sign out shows. Below 1024px the theme toggle would
         cover it above the column. -->
    <template #brand>
      <div class="h-11" aria-hidden="true" />
      <div class="pointer-events-none absolute inset-x-0 flex justify-center">
        <NuxtLink to="/" class="pointer-events-auto inline-flex min-h-11 items-center rounded-md text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          <OgBrand :size="34" wordmark semantic />
        </NuxtLink>
      </div>
    </template>

    <template #account>
      <div class="flex items-center gap-1 lg:absolute lg:right-0 lg:bottom-full">
        <span class="hidden max-w-[16rem] truncate text-xs text-muted lg:inline">{{ accountLabel }}</span>
        <UButton
          color="neutral"
          variant="ghost"
          size="sm"
          class="min-h-11"
          label="Sign out"
          @click="logout()"
        />
      </div>
    </template>

    <slot />
  </ProShellOnboardingSurface>
</template>
