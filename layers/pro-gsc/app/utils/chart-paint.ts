// A design-system series colour is a CSS colour such as
// `var(--ui-viz-clicks, #3b82f6)`, never a hex literal. Parsing it as hex read
// `var(` as the digit `a` and drew every series near black. `color-mix()`
// resolves the custom property in the browser, so the brand override applies.
export function translucentColor(color: string, opacity: number): string {
  return `color-mix(in srgb, ${color} ${Math.round(opacity * 100)}%, transparent)`
}
