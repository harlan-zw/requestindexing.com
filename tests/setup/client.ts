import { beforeEach, vi } from 'vitest'
// Setup for the `client` project. A component mounted here has no Nuxt app, so
// the globals its template reaches for are installed once, in front of every
// client feature test.
import { computed, ref, shallowRef, watch } from 'vue'

const g = globalThis as Record<string, unknown>

// Vue's own reactivity is auto-imported inside a Nuxt component.
Object.assign(g, {
  ref,
  shallowRef,
  computed,
  watch,
  useNuxtData: () => ({ data: ref(null) }),
  useUserSession: () => ({ session: ref({ user: { id: 1 } }), loggedIn: ref(true) }),
})

// `useToast` reaches `#imports` in the real @nuxt/ui build. Each test gets a
// fresh spy so one test's toasts cannot leak into the next.
beforeEach(() => {
  g.useToast = () => ({ add: vi.fn(), remove: vi.fn(), clear: vi.fn() })
})
