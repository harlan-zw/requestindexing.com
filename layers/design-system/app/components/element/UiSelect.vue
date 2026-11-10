<script setup lang="ts" generic="T extends ArrayOrNested<SelectItem> = ArrayOrNested<SelectItem>, VK extends GetItemKeys<T> = 'value', M extends boolean = false">
import type { ArrayOrNested, GetItemKeys, SelectEmits, SelectItem, SelectProps } from '@nuxt/ui'
import { USelect } from '#components'

/**
 * UiSelect — thin wrapper around Nuxt UI v4's USelect (the native-style
 * single/multi select, not the overlay `USelectMenu` — that one stays raw
 * per DESIGN.md's overlay-chrome rule).
 *
 * Tokens (radius, ring, full-width) are already centralized in
 * `app.config.ts`'s `ui.select` — this component isn't a re-theme, it's the
 * single legal entry point (raw `<USelect>` is ESLint-banned via
 * `eslint/selectors.ts`) so a future behavioral change lands in one file
 * instead of another repo-wide sweep. Every prop, emit, and slot passes
 * straight through unchanged.
 */

defineOptions({ inheritAttrs: false })

const props = defineProps<Props>()
const emit = defineEmits<Omit<SelectEmits<T, VK, M>, 'update:modelValue'>>()
/**
 * `open`, `defaultOpen` and `portal` are omitted deliberately, and dropping any
 * of them from this list breaks every select in the app.
 *
 * `defineProps<T>()` compiles a bare `boolean` prop into a runtime prop with no
 * default, and Vue resolves an ABSENT boolean prop to `false` rather than
 * `undefined`. `{ ...props }` below then hands `<USelect>` a real, enumerable
 * `open: false` — indistinguishable from a caller writing `:open="false"`.
 * Reka's `SelectRoot` reads that as controlled state and pins the listbox
 * permanently closed: the trigger still emits `update:open`, nothing consumes
 * it, and the menu never renders. Nuxt UI ships `useComponentProps()` to dodge
 * exactly this footgun by inspecting the raw vnode props, and the spread
 * defeats it. `portal` suffers the same forced `false`, which un-teleports the
 * listbox and risks clipping inside scroll-constrained containers.
 *
 * No caller passes any of the three, so omitting them costs nothing.
 */
type Props = Omit<SelectProps<T, VK, M>, 'modelValue' | 'defaultValue' | 'modelModifiers' | 'open' | 'defaultOpen' | 'portal'>
// Read the model shape from USelect itself. This preserves its optional
// `undefined` state and avoids reconstructing Nuxt UI's private ExcludeItem
// generic, whose conditional type cannot be simplified safely by vue-tsc.
type ModelValue = SelectProps<T, VK, M>['modelValue']

const modelValue = defineModel<ModelValue>()
</script>

<template>
  <!-- @vue-generic {T, VK, M} -->
  <USelect
    v-bind="{ ...props, ...$attrs }"
    v-model="modelValue"
    @blur="emit('blur', $event)"
    @change="emit('change', $event)"
    @focus="emit('focus', $event)"
  >
    <template v-for="(_, name) in ($slots as Record<string, unknown>)" #[name]="slotProps" :key="name">
      <slot :name="name" v-bind="slotProps || {}" />
    </template>
  </USelect>
</template>
