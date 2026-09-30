<script setup lang="ts">
import { useWindowScroll } from '@vueuse/core'
import { computed } from 'vue'
import { NuxtLink, UDropdownMenu, UiButton, UiIcon, UiPageHeader } from '#components'
import { useUiAppShellNav } from '#layers/design-system/app/composables/useAppShellNav'
import { useProHeaderMenu } from '../../composables/useProHeaderMenu'
import { useProHeaderPageMeta } from '../../composables/useProHeaderPageMeta'

// Ported from nuxtseo.com's `layers/saas/app/components/pro/ProPageHeader.vue`:
// the design-system `UiPageHeader` (context crumb + title + actions row) plus
// the shell concerns it cannot own. Left out: the feedback button and the
// feature stability chip, which this app does not have.
const { title, sticky = false } = defineProps<{
  title: string
  /** Pin the header to the top of the window scroll so the Site crumb and the
   *  title stay visible on long pages. Once scrolled, it gains an overlay
   *  background and a hairline. */
  sticky?: boolean
}>()

// Detail pages (the search-console query and page drill-ins) name an entity
// from a route param and add a crumb back to their list, through
// `definePageMeta({ proHeader })`. Ancestors extend the title-scale trail
// instead of adding a second breadcrumb row above it.
const { title: metaTitle, crumbs: metaCrumbs } = useProHeaderPageMeta()
const resolvedTitle = computed(() => metaTitle.value ?? title)
const metaAncestorCrumbs = computed(() => metaCrumbs.value.slice(0, -1))

// Pages add their own secondary actions to one overflow menu rather than a
// competing second button. Without the feedback group upstream keeps here,
// the menu shows only when a page contributes.
const { groups: pageMenuGroups } = useProHeaderMenu()

// Stuck = sticky AND the window has scrolled. The transparent border reserves
// the hairline's pixel so gaining it never shifts layout.
const { y: scrollY } = useWindowScroll()
const stuck = computed(() => sticky && scrollY.value > 0)

// The shell draws no mobile bar (`inlineMobileNav`): this header renders the
// hamburger at the title row's start below `lg`, so menu, Site switcher and
// title share one row. Null outside a shell, so a standalone header draws none.
const shellNav = useUiAppShellNav()
</script>

<template>
  <div
    class="w-full"
    :class="[
      sticky ? 'sticky top-0 z-20 border-b pb-2 transition-colors duration-150' : '',
      sticky ? (stuck ? 'border-default bg-default/85 backdrop-blur-sm' : 'border-transparent') : '',
    ]"
  >
    <div class="pro-container">
      <UiPageHeader flush :border="false" :title="resolvedTitle">
        <template v-if="shellNav || $slots.crumb || metaAncestorCrumbs.length" #crumb>
          <UiButton
            v-if="shellNav"
            purpose="quiet"
            class="lg:hidden -ml-2 min-h-11 min-w-11 shrink-0"
            aria-label="Open navigation menu"
            @click="shellNav.openNav()"
          >
            <UiIcon name="menu" class="size-5" aria-hidden="true" />
          </UiButton>
          <slot name="crumb" />
          <template v-for="(crumb, i) in metaAncestorCrumbs" :key="crumb.to ?? `${crumb.label}-${i}`">
            <NuxtLink
              v-if="crumb.to"
              :to="crumb.to"
              class="text-title text-muted hover:text-default transition-colors shrink-0"
            >
              {{ crumb.label }}
            </NuxtLink>
            <span v-else class="text-title text-muted shrink-0">
              {{ crumb.label }}
            </span>
            <span class="text-sm font-normal leading-none text-dimmed select-none" aria-hidden="true">/</span>
          </template>
        </template>
        <template #actions>
          <slot name="actions" />
          <UDropdownMenu v-if="pageMenuGroups.length" :items="pageMenuGroups" :content="{ align: 'end' }">
            <UiButton
              purpose="quiet"
              icon="more-horizontal"
              class="min-h-11 min-w-11 lg:min-h-0 lg:min-w-0"
              aria-label="More options"
            />
          </UDropdownMenu>
        </template>
      </UiPageHeader>
    </div>
  </div>
</template>
