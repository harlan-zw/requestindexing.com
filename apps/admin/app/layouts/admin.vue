<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import { createLogoutHandler } from '~~/layers/core/app/composables/auth'

const { loggedIn, isAdmin, user } = await requireAdminSession()

const route = useRoute()
const navOpen = ref(false)
const logout = createLogoutHandler()

watch(() => route.path, () => {
  navOpen.value = false
})

const links: NavigationMenuItem[] = [{
  label: 'Dashboard',
  icon: 'i-lucide-layout-dashboard',
  to: '/admin',
  exact: true,
}, {
  label: 'Users',
  icon: 'i-lucide-users',
  to: '/admin/users',
}, {
  label: 'Sites',
  icon: 'i-lucide-globe',
  to: '/admin/sites',
}, {
  label: 'Jobs',
  icon: 'i-lucide-list-checks',
  to: '/admin/jobs',
}]

const secondaryLinks: NavigationMenuItem[] = [{
  label: 'Back to Site',
  icon: 'i-lucide-arrow-left',
  to: '/',
}]
</script>

<template>
  <div>
    <!-- Not signed in -->
    <UContainer v-if="!loggedIn" class="py-12">
      <UPageCard variant="subtle" class="max-w-md mx-auto text-center">
        <div class="py-8 space-y-4">
          <UIcon name="i-lucide-shield" class="size-12 text-muted" />
          <h1 class="text-xl font-semibold">
            Admin Access Required
          </h1>
          <p class="text-muted">
            Sign in with an admin Google account.
          </p>
          <UButton
            to="/auth/google"
            external
            color="neutral"
            size="lg"
            icon="i-simple-icons-google"
          >
            Sign In with Google
          </UButton>
        </div>
      </UPageCard>
    </UContainer>

    <!-- Signed in but not admin -->
    <UContainer v-else-if="!isAdmin" class="py-12">
      <UPageCard variant="subtle" class="max-w-md mx-auto text-center">
        <div class="py-8 space-y-4">
          <UIcon name="i-lucide-shield-x" class="size-12 text-error" />
          <h1 class="text-xl font-semibold">
            Access Denied
          </h1>
          <p class="text-muted">
            Your account does not have admin access.
          </p>
          <UButton
            to="/"
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-left"
          >
            Back to Site
          </UButton>
        </div>
      </UPageCard>
    </UContainer>

    <!-- Admin layout -->
    <div v-else class="flex min-h-screen">
      <!-- Fixed Sidebar -->
      <aside class="hidden lg:flex flex-col w-64 shrink-0 fixed top-0 bottom-0 left-0 border-r border-[var(--ui-border)] bg-[var(--ui-bg)]">
        <div class="flex-1 overflow-y-auto p-4 space-y-6">
          <!-- Logo -->
          <NuxtLink to="/admin" class="flex items-center gap-2">
            <div class="flex items-center justify-center size-8 rounded-lg bg-primary/10">
              <UIcon name="i-lucide-shield-check" class="size-4 text-primary" />
            </div>
            <span class="font-semibold text-highlighted">Admin</span>
          </NuxtLink>

          <!-- Nav links -->
          <UNavigationMenu :items="[links]" orientation="vertical" :ui="{ link: 'w-full', linkLeadingIcon: 'mr-2' }" highlight />

          <USeparator />

          <UNavigationMenu :items="[secondaryLinks]" orientation="vertical" :ui="{ link: 'w-full', linkLeadingIcon: 'mr-2' }" highlight />
        </div>

        <!-- User card + logout pinned to bottom -->
        <div class="shrink-0 border-t border-[var(--ui-border)] p-4 space-y-2">
          <div v-if="user" class="flex items-center gap-3">
            <UAvatar
              :src="user.avatarUrl || undefined"
              :alt="user.name || user.email || 'Account'"
              size="sm"
            />
            <div class="flex-1 min-w-0">
              <p class="font-medium text-sm truncate">
                {{ user.name }}
              </p>
              <p class="text-xs text-muted truncate">
                {{ user.email }}
              </p>
            </div>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            size="sm"
            icon="i-lucide-log-out"
            class="w-full justify-start"
            @click="logout()"
          >
            Sign Out
          </UButton>
        </div>
      </aside>

      <!-- Content -->
      <div class="flex-1 lg:ml-64">
        <!-- Mobile nav toggle -->
        <div class="lg:hidden px-4 pt-4">
          <UButton variant="ghost" class="-ml-2" aria-label="Open navigation menu" @click="navOpen = true">
            <UIcon name="i-lucide-menu" class="size-5" aria-hidden="true" />
            <span class="ml-2">Menu</span>
          </UButton>
        </div>

        <div class="p-4 sm:p-6 lg:p-8">
          <slot />
        </div>
      </div>

      <!-- Mobile drawer -->
      <UDrawer v-model:open="navOpen" direction="left">
        <template #content>
          <div class="p-5">
            <!-- User info -->
            <div v-if="user" class="flex items-center gap-3 p-3 rounded-xl bg-[var(--ui-bg-elevated)] border border-[var(--ui-border)] mb-6">
              <UAvatar
                :src="user.avatarUrl || undefined"
                :alt="user.name || user.email || 'Account'"
                size="md"
              />
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate">
                  {{ user.name }}
                </p>
                <p class="text-sm text-muted truncate">
                  {{ user.email }}
                </p>
              </div>
            </div>

            <UNavigationMenu :items="[links]" orientation="vertical" class="w-full mb-4" :ui="{ link: 'w-full' }" highlight />

            <USeparator class="my-4" />

            <UNavigationMenu :items="[secondaryLinks]" orientation="vertical" class="w-full mb-4" :ui="{ link: 'w-full' }" highlight />

            <USeparator class="my-4" />

            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-log-out"
              class="w-full justify-start"
              @click="logout()"
            >
              Sign Out
            </UButton>
          </div>
        </template>
      </UDrawer>
    </div>
  </div>
</template>
