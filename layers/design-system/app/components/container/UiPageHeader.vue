<script setup lang="ts">
import type { UiIcon as UiIconName } from '../../shared/ui-icons'
import { NuxtLink, UiIcon } from '#components'

// Page header: context crumb + title + trailing actions row, with optional
// breadcrumb links above (admin detail pages). Extracted after six sibling
// pages converged on the same shape.

interface Crumb {
  label: string
  to?: string
}

// `description` is intentionally accepted-but-unrendered: page headers no longer
// show a subtitle. Kept in the type so existing callers don't break.
const { crumbs = [], title, icon, flush = false, border = true, stackActionsOnMobile = false } = defineProps<{
  crumbs?: Crumb[]
  title: string
  icon?: UiIconName
  description?: string
  /** Skip pro-container (max-width + horizontal padding). Use in non-pro shells where padding is owned by the layout. */
  flush?: boolean
  /** Bottom hairline. Turn off for headers with a sub-nav tab strip beneath (the tabs own the separator). */
  border?: boolean
  /** Give dense detail-page actions their own row below the title on mobile. */
  stackActionsOnMobile?: boolean
}>()
</script>

<template>
  <header :class="[flush ? '' : 'pro-container', border ? 'border-b border-default' : '']">
    <div class="flex items-start gap-4 pt-2">
      <div
        class="flex items-start justify-between min-w-0 w-full gap-3"
        :class="stackActionsOnMobile ? 'flex-col sm:flex-row' : 'flex-row'"
      >
        <div class="min-w-0 flex-1">
          <nav v-if="crumbs.length" aria-label="Breadcrumb" class="flex items-center gap-2 text-xs text-dimmed mb-1">
            <template v-for="(crumb, i) in crumbs" :key="crumb.to ?? crumb.label">
              <NuxtLink v-if="crumb.to" :to="crumb.to" class="hover:text-default">
                {{ crumb.label }}
              </NuxtLink>
              <span
                v-else
                class="text-muted truncate"
                :aria-current="i === crumbs.length - 1 ? 'page' : undefined"
              >
                {{ crumb.label }}
              </span>
              <UiIcon
                v-if="i < crumbs.length - 1"
                name="chevron-right"
                class="size-3"
                aria-hidden="true"
              />
            </template>
          </nav>
          <!-- Title row. `#crumb` is the in-title context segment (site/group
               switcher) rendered at title scale — "Nuxt SEO / Overview" — so
               the page's name always carries its scope. The crumb component
               owns its trailing slash (it may render nothing, e.g. while the
               site list resolves, and a dangling separator reads broken).
               Kept outside the h1 so the heading text stays clean. When the
               row overflows (narrow viewports), the title yields twice as
               fast as the crumb: scope identity outranks the page name. -->
          <div class="flex min-w-0 items-center gap-2 overflow-hidden">
            <slot name="crumb" />
            <h1 class="text-title text-default flex items-center gap-2 min-w-0 shrink-2">
              <slot name="icon">
                <UiIcon v-if="icon" :name="icon" class="size-4 text-dimmed shrink-0" aria-hidden="true" />
              </slot>
              <span class="truncate">{{ title }}</span>
            </h1>
            <slot name="title-trailing" />
          </div>
        </div>
        <div
          class="flex items-center gap-3 flex-wrap shrink-0"
          :class="stackActionsOnMobile ? 'w-full justify-start sm:w-auto sm:justify-end' : 'justify-end'"
        >
          <slot name="actions" />
        </div>
      </div>
    </div>
  </header>
</template>
