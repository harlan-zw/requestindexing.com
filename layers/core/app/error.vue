<script setup lang="ts">
import type { NuxtError } from '#app'
import { domAnimation, LazyMotion, MotionConfig } from 'motion-v'
import { ConfigProvider } from 'reka-ui'

const { error } = defineProps<{ error: NuxtError }>()

interface ErrorCopy {
  title: string
  message: string
}

// The raw status message and the failed request line are machine detail. They
// are logged, never rendered, so every status maps to one human sentence.
function describeError(status: number): ErrorCopy {
  if (status === 401) {
    return {
      title: 'Please sign in',
      message: 'Your session ended. Sign in again to open this page.',
    }
  }
  if (status === 403) {
    return {
      title: 'You do not have access',
      message: 'Your account cannot open this page. Ask a team owner to grant access.',
    }
  }
  if (status === 404) {
    return {
      title: 'Page not found',
      message: 'This page does not exist, or it moved to a new address.',
    }
  }
  if (status >= 500) {
    return {
      title: 'Something went wrong',
      message: 'The server could not complete the request. Try again in a moment.',
    }
  }
  return {
    title: 'Something went wrong',
    message: 'We could not load this page. Try again in a moment.',
  }
}

const status = computed(() => Number(error.statusCode) || 500)
const copy = computed(() => describeError(status.value))
const isNotFound = computed(() => status.value === 404)

const route = useRoute()
const { loggedIn } = useUserSession()

const primaryAction = computed(() => {
  if (loggedIn.value)
    return { label: 'Back to dashboard', to: '/pro/dashboard' }
  if (status.value === 401 || status.value === 403)
    return { label: 'Sign in', to: '/login' }
  return { label: 'Back to home', to: '/' }
})

// Keep the machine detail out of the UI but not out of the record.
if (import.meta.client) {
  console.error('[error page]', status.value, error.statusMessage, error.message)
}

useSeoMeta({
  title: () => copy.value.title,
  description: () => copy.value.message,
  robots: 'noindex, nofollow',
})

useHead({
  htmlAttrs: {
    lang: 'en',
  },
})

// This file replaces `app.vue` while an error shows, so it mounts the same
// providers and the same toaster.
const useIdFunction = () => useId()
const appConfig = useAppConfig()
const toasterConfig = computed(() => typeof appConfig.toaster === 'object' && appConfig.toaster !== null ? appConfig.toaster : {})
const scrollBody = { padding: 0, margin: 0 } as const
</script>

<template>
  <ConfigProvider :use-id="useIdFunction" :scroll-body="scrollBody">
    <LazyMotion :features="domAnimation">
      <MotionConfig reduced-motion="user">
        <UApp :toaster="null" :tooltip="{ delayDuration: 0 }" :scroll-body="scrollBody">
          <!-- A signed-in user keeps the dashboard around the error, as on
               nuxtseo.com. The sidebar stays, so after a 404 or a crash the
               reader still has every way onward. -->
          <NuxtLayout v-if="loggedIn" name="pro-dashboard">
            <UiEmptyState
              :icon="isNotFound ? 'compass' : 'caution'"
              :title="copy.title"
              :description="copy.message"
              heading-tag="h1"
            >
              <div class="flex items-center justify-center gap-2">
                <UiButton icon="home" @click="clearError({ redirect: primaryAction.to })">
                  {{ primaryAction.label }}
                </UiButton>
                <!-- A retry can recover a transient error by rendering the
                     route again. A 404 has no page to render, so it gets none. -->
                <UiButton v-if="!isNotFound" purpose="secondary" icon="refresh" @click="clearError({ redirect: route.fullPath })">
                  Try again
                </UiButton>
              </div>
            </UiEmptyState>
          </NuxtLayout>

          <div v-else class="flex min-h-dvh flex-col bg-default">
            <Header />

            <main class="flex flex-1 items-center justify-center px-4 py-16">
              <div class="w-full max-w-md text-center">
                <p class="mb-2 font-mono text-sm text-muted">
                  {{ status }}
                </p>
                <h1 class="mb-3 font-title text-2xl font-semibold tracking-tight text-highlighted">
                  {{ copy.title }}
                </h1>
                <p class="mb-6 text-muted">
                  {{ copy.message }}
                </p>
                <UButton @click="clearError({ redirect: primaryAction.to })">
                  {{ primaryAction.label }}
                </UButton>
              </div>
            </main>

            <Footer />
          </div>
        </UApp>
        <UiToaster v-bind="toasterConfig" />
      </MotionConfig>
    </LazyMotion>
  </ConfigProvider>
</template>
