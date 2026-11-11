import type { VizColor } from '@nuxtseo/design-system/app/composables/dataVizColors'

// Chart identities that `@nuxtseo/design-system` has no slot for.

/** Query breadth (how many distinct queries a page wins). */
export const breadthVizColor = { dot: 'bg-lime-500', bg: 'bg-lime-500/60', text: 'text-lime-600 dark:text-lime-400', hex: '#84cc16' } as const satisfies VizColor

/** Brand-term marker on a query label. */
export const brandVizColor = { dot: 'bg-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', hex: '#f59e0b' } as const satisfies VizColor
