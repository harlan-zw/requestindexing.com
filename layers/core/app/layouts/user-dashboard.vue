<script lang="ts" setup>
// The focused account shell: profile and team settings, away from Site work.
//
// It renders the same `UiAppShell` the dashboard does, so the two shells share
// one rail, one drawer and one skip link. The nav rows are `UiNavList` links
// rather than a second navigation component, so a row here behaves exactly
// like a row in the Site sidebar.
import type { UiNavLink } from '#layers/design-system/app/shared/nav'

const route = useRoute()
const { session } = useUserSession()

// Account settings are dashboard pages, so they take the same compact theme
// as `pro-dashboard.vue`. nuxtseo.com renders them inside its dashboard shell.
useHead({ htmlAttrs: { class: 'dashboard-theme' } })

// Onboarding is gated by `middleware/onboarding.global.ts`, which decides
// before the page mounts. This layout no longer redirects.

const pageTitle = computed(() => String(route.meta.subTitle || route.meta.title || 'Account'))
const pageIcon = computed(() => typeof route.meta.icon === 'string' ? route.meta.icon : undefined)

const backLink: UiNavLink[] = [
  { label: 'Back to dashboard', to: '/pro/dashboard', icon: 'back' },
]

const accountLinks: UiNavLink[] = [
  { label: 'Profile', to: '/pro/dashboard/account', icon: 'user' },
  { label: 'Usage', to: '/pro/dashboard/usage', icon: 'gauge' },
]

const teamLinks: UiNavLink[] = [
  { label: 'Members', to: '/pro/dashboard/team/members', icon: 'users' },
  { label: 'Settings', to: '/pro/dashboard/team/settings', icon: 'settings' },
]

const supportLinks: UiNavLink[] = [
  { icon: 'mail', label: 'Email', to: 'mailto:harlan@harlanzw.com' },
  { icon: 'discord', label: 'Discord', to: 'https://discord.gg/275MBUBvgP' },
  { icon: 'github', label: 'Submit a bug', to: 'https://github.com/harlan-zw/requestindexing.com/issues/new/choose' },
]
</script>

<template>
  <UiAppShell content-class="p-0">
    <template #brand>
      <NuxtLink to="/pro/dashboard" class="inline-flex min-h-11 items-center rounded-md text-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:min-h-0">
        <OgBrand :size="26" wordmark semantic />
      </NuxtLink>
    </template>

    <template #mobileNav>
      <div class="flex min-w-0 items-center justify-between gap-3">
        <div class="min-w-0 truncate font-title text-base font-semibold tracking-tight text-highlighted">
          {{ pageTitle }}
        </div>
        <DashboardHeader />
      </div>
    </template>

    <template #sidebar>
      <UiNavList variant="sidebar" tone="default" label="Leave account settings" :links="backLink" />

      <div>
        <div class="mb-1.5 px-1 text-sm font-medium tracking-wide text-dimmed lg:text-xs dark:text-muted">
          Account
        </div>
        <UiNavList variant="sidebar" tone="default" label="Account" :links="accountLinks" />
      </div>

      <div class="mt-auto border-t border-default pt-4">
        <div class="mb-1.5 px-1 text-sm font-medium tracking-wide text-dimmed lg:text-xs dark:text-muted">
          Team settings
        </div>
        <UiNavList variant="sidebar" tone="default" label="Team settings" :links="teamLinks" />
      </div>
    </template>

    <template #footer>
      <div v-if="session?.team" class="flex min-w-0 items-center gap-2 px-2">
        <UAvatar
          :src="session.user?.avatarUrl || undefined"
          :alt="session.user?.name || session.user?.email || 'Account'"
          size="xs"
        />
        <div class="min-w-0">
          <div class="truncate text-xs text-muted">
            Team
          </div>
          <div class="truncate text-sm font-medium text-highlighted">
            {{ session.team.name }}
          </div>
        </div>
      </div>
    </template>

    <header class="sticky top-0 z-20 border-b border-default bg-default/85 backdrop-blur-sm">
      <div class="dashboard-container flex min-h-16 items-center justify-between gap-4">
        <h1 class="flex min-w-0 items-center gap-2 text-title text-highlighted">
          <UIcon v-if="pageIcon" :name="pageIcon" class="size-5 shrink-0 text-primary" aria-hidden="true" />
          <span class="truncate">{{ pageTitle }}</span>
        </h1>
        <div class="hidden lg:block">
          <DashboardHeader />
        </div>
      </div>
    </header>

    <div class="dashboard-container grid gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_16rem] lg:py-8">
      <div class="min-w-0">
        <slot />
      </div>

      <aside class="lg:sticky lg:top-24 lg:self-start">
        <div class="rounded-[var(--ui-radius)] border border-default bg-elevated/40">
          <div class="border-b border-default px-3 py-2 text-sm font-semibold text-highlighted">
            Get help
          </div>
          <div class="p-1">
            <UiNavList label="Get help" :links="supportLinks" />
          </div>
        </div>
      </aside>
    </div>
  </UiAppShell>
</template>
