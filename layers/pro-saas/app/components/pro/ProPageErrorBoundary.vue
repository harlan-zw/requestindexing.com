<script setup lang="ts">
import { onErrorCaptured, onScopeDispose, shallowRef } from 'vue'
import { isPageRenderError } from '#layers/pro-saas/app/utils/page-render-error'

// `NuxtErrorBoundary`, for the page slot of the dashboard layout. It differs in
// two ways. The layout stays mounted across pages, so a caught error clears on
// the next navigation; otherwise it outlives the page that threw. And an event
// handler or watcher that fails leaves the page on screen, because the page
// still renders. That error goes on to the app error handler.
defineOptions({ inheritAttrs: false })

const emit = defineEmits<{ error: [error: unknown] }>()

const error = shallowRef<unknown>(null)
function clearError() {
  error.value = null
}

// As in `NuxtErrorBoundary`, a server render error goes to the Nuxt error page.
if (!import.meta.server) {
  const nuxtApp = useNuxtApp()
  onErrorCaptured((err, instance, info) => {
    if (!isPageRenderError(info))
      return
    const capture = () => {
      emit('error', err)
      void nuxtApp.hooks.callHook('vue:error', err, instance, info)
      error.value = err
    }
    if (nuxtApp.isHydrating)
      onNuxtReady(capture)
    else
      capture()
    return false
  })

  onScopeDispose(useRouter().afterEach((_to, _from, failure) => {
    if (!failure)
      clearError()
  }))
}
</script>

<template>
  <slot v-if="error" name="error" :error="error" :clear-error="clearError" />
  <slot v-else />
</template>
