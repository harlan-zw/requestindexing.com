import type { DropdownMenuItem } from '@nuxt/ui'
import { useState } from 'nuxt/app'

/**
 * Page-contributed groups for the shared page header's overflow ("⋯") menu.
 * Ported from nuxtseo.com's `layers/saas/app/composables/useProHeaderMenu.ts`.
 *
 * The dashboard layout renders one header for every page. A page with its own
 * secondary actions pushes a group here on mount and clears it on unmount,
 * instead of teleporting a second overflow button beside the first. The menu
 * reads reactive state because its items are data. Teleport moves DOM nodes.
 */
export function useProHeaderMenu() {
  const groups = useState<DropdownMenuItem[][]>('pro:header-menu', () => [])
  function setHeaderMenu(next: DropdownMenuItem[][]) {
    groups.value = next
  }
  function clearHeaderMenu() {
    groups.value = []
  }
  return { groups, setHeaderMenu, clearHeaderMenu }
}
