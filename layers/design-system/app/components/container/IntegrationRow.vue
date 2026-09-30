<script setup lang="ts">
import type { Component } from 'vue'
import type { SourceLogo } from '../element/UiSourceLogos.vue'
import { computed } from 'vue'
import { UiIcon, UiSourceLogos } from '#components'

// One external service in a list of them. The row states what the service does
// for you before it states that it is connected, so an unconnected list reads
// as a menu of capabilities rather than a checklist of chores.
//
// Presentational only: every value arrives as a prop. The caller owns fetching,
// connect flows, and per-site link state.
//
// Native <details> for the same reason UiDisclosure uses it: free keyboard and
// AT semantics, find-in-page auto-expand. The expanded half is where credential
// forms and per-site coverage live, so it must stay in the DOM-on-demand path
// rather than being a v-if the caller manages.

const { name, status, logo, logoComponent, connected = false, sources = [] } = defineProps<{
  /** Service name as the vendor writes it. */
  name: string
  /**
   * Coverage as a count. "4 of 6 sites linked" answers the question the row
   * exists to answer; a bare "Connected" checkmark does not.
   */
  status: string
  /** Brand mark as an Iconify `logos` id. */
  logo?: string
  /** Inline brand-mark component, for vendors no coloured icon set carries. */
  logoComponent?: Component
  /** Drives the quiet connected marker only; `status` carries the text. */
  connected?: boolean
  /**
   * The Sources this Integration lets the app read through, in Source order. The
   * row wears their marks, and names them from `sm` up. Empty for a service
   * that only sends, such as a delivery channel.
   */
  sources?: readonly SourceLogo[]
}>()

const sourceNames = computed(() => sources.map(source => source.label).join(', '))

const open = defineModel<boolean>('open', { default: false })

/**
 * Keep an action click from toggling the row. The toggle is the summary's
 * DEFAULT action, so `stopPropagation` alone never prevented it: a button
 * whose label span took the click collapsed an open row. Links keep their
 * default, which is the navigation, and leave the page anyway.
 */
function onActionClick(e: MouseEvent) {
  e.stopPropagation()
  if (!(e.target as Element | null)?.closest('a[href]'))
    e.preventDefault()
}

function onToggle(e: Event) {
  open.value = (e as ToggleEvent).newState === 'open'
}
</script>

<template>
  <details class="ui-disclosure group" :open="open" @toggle="onToggle">
    <summary
      class="flex items-center gap-3 px-3.5 py-2.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden min-h-11 outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
    >
      <UiIcon
        name="chevron-right"
        class="size-3.5 shrink-0 text-dimmed transition-transform duration-150 group-open:rotate-90"
        aria-hidden="true"
      />
      <span class="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-default bg-elevated">
        <component :is="logoComponent" v-if="logoComponent" class="size-4" aria-hidden="true" />
        <UiIcon v-else-if="logo" :name="logo" class="size-4" aria-hidden="true" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="line-clamp-1 text-sm font-medium text-default">
          {{ name }}
        </p>
        <!-- Clamped to two lines. `truncate` half-applied here: the utility's
             `white-space: nowrap` loses inside `<summary>`, so the line wrapped
             to four lines at 375px while still claiming to ellipse. Two lines
             keeps rows near-uniform without cutting a provider's description to
             four words on mobile. -->
        <p class="line-clamp-2 text-sm text-muted">
          {{ status }}
        </p>
      </div>
      <!-- From `sm` up the Sources sit in the row. Below it the service name
           already truncates, so they move into the expanded half. -->
      <span v-if="sources.length" class="hidden shrink-0 items-center gap-1.5 text-sm text-muted sm:inline-flex">
        <UiSourceLogos :sources="sources" size="xs" />
        {{ sourceNames }}
      </span>
      <!-- Below `sm` the status line already states coverage, and the marker
           beside an action squeezed the service name to two letters. -->
      <span v-if="connected" class="hidden shrink-0 items-center gap-1 text-sm text-muted sm:inline-flex">
        <UiIcon name="check" class="size-3.5" aria-hidden="true" />
        Connected
      </span>
      <!-- The action sits inside <summary>, where any click would also toggle the
           disclosure. Handle it here rather than on each caller's button: whether a
           button component forwards a native listener is its own business, and a
           row whose button collapses the row it just acted on is the exact bug
           this wrapper makes impossible. -->
      <span class="shrink-0" @click="onActionClick">
        <slot name="action" />
      </span>
    </summary>
    <div class="px-3.5 pb-4 pt-1 pl-[4.25rem]">
      <p v-if="sources.length" class="mb-2 flex items-center gap-1.5 text-sm text-muted sm:hidden">
        <UiSourceLogos :sources="sources" size="xs" />
        {{ sources.length === 1 ? 'Source' : 'Sources' }}: {{ sourceNames }}
      </p>
      <slot />
    </div>
  </details>
</template>
