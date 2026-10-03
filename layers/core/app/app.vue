<script setup>
import { domAnimation, LazyMotion, MotionConfig } from 'motion-v'
import { ConfigProvider } from 'reka-ui'
import { isRuntimeOnlyRoute } from '~~/shared/routes'

const useIdFunction = () => useId()

const colorMode = useColorMode()

const color = computed(() => colorMode.value === 'dark' ? '#111827' : 'white')

useHead({
  meta: [
    { key: 'theme-color', name: 'theme-color', content: color },
  ],
})

const entry = useHead({
  link: [
    {
      rel: 'icon',
      type: 'image/svg+xml',
      href: `/icons/icon-${colorMode.value === 'system' ? 'dark' : colorMode.value}.svg`,
    },
  ],
})
// switch logos on colorMode
watch(colorMode, () => {
  entry.patch({
    link: [
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: `/icons/icon-${colorMode.value}.svg`,
      },
    ],
  })
})

useSeoMeta({
  titleTemplate: '%s %separator Request Indexing',
  ogSiteName: 'Request Indexing',
  // `og:title` also drives the X preview. Unhead deprecates `twitter:title`.
  ogTitle: 'Get your pages indexed.',
})

// Only prerendered routes get the site-wide OG image. `ogImage.zeroRuntime`
// serves images as build-time files, so emitting this URL on a runtime-only
// route points social crawlers at an image the worker cannot produce.
if (!isRuntimeOnlyRoute(useRoute().path))
  defineOgImage('Splash')

// nuxtseo.com's toaster: a peek deck of three, bottom right, configured by
// `appConfig.toaster`. Nuxt UI's own toaster is off (`:toaster="null"`), and
// both render from the same `useToast()` queue.
const appConfig = useAppConfig()
const toasterConfig = computed(() => typeof appConfig.toaster === 'object' && appConfig.toaster !== null ? appConfig.toaster : {})

// The root gutter already reserves scrollbar space. Turn off Reka's second
// compensation, so opening a modal does not shift the page sideways.
const scrollBody = { padding: 0, margin: 0 }

// Only `SkewNotification` opens the skew socket, and its prompt never shows on
// a prerendered page. Signed-out visitors keep Nuxt's hourly build check, the
// same split nuxtseo.com runs between its marketing site and its dashboard.
const { loggedIn } = useUserSession()
</script>

<template>
  <ConfigProvider :use-id="useIdFunction" :scroll-body="scrollBody">
    <LazyMotion :features="domAnimation">
      <MotionConfig reduced-motion="user">
        <UApp :toaster="null" :tooltip="{ delayDuration: 0 }" :scroll-body="scrollBody">
          <NuxtLoadingIndicator />

          <NuxtLayout>
            <NuxtPage />
          </NuxtLayout>

          <!--
            Shown when the server reports a newer build than the one this tab
            loaded. Paired with `skewProtection.reloadStrategy: 'prompt'` in
            nuxt.config: the strategy detects the stale build, this renders the
            choice. Without it, `prompt` would detect and then do nothing.
          -->
          <SkewNotification v-if="loggedIn" v-slot="{ isOpen, dismiss, reload }">
            <Transition
              enter-active-class="transition duration-300 ease-out"
              enter-from-class="opacity-0 translate-y-2"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition duration-200 ease-in"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 translate-y-2"
            >
              <div v-if="isOpen" class="fixed bottom-4 right-4 z-50">
                <div class="flex items-center gap-3 rounded-full bg-default px-4 py-3 shadow-lg ring ring-default">
                  <UIcon name="i-lucide-sparkles" class="size-4 text-primary" />
                  <span class="text-sm font-medium text-highlighted">New version available</span>
                  <UButton size="xs" label="Refresh" @click="reload" />
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    icon="i-lucide-x"
                    aria-label="Dismiss update notification"
                    @click="dismiss"
                  />
                </div>
              </div>
            </Transition>
          </SkewNotification>
        </UApp>
        <UiToaster v-bind="toasterConfig" />
      </MotionConfig>
    </LazyMotion>
  </ConfigProvider>
</template>

<style>
pre {
  --scrollbar-thumb: #3b5178;
}

.dark pre {
  --scrollbar-thumb: #acbad2;
}

* {
  --scrollbar-track: initial;
  --scrollbar-thumb: initial;
  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
  scrollbar-width: thin;
  --scrollbar-thumb: #acbad2;
}

::-webkit-scrollbar-track {
  background-color: var(--scrollbar-track)
}

::-webkit-scrollbar-thumb {
  background-color: var(--scrollbar-thumb);
  border-radius: .25rem
}

::-webkit-scrollbar {
  width: 8px;
  height: 8px
}

.dark * {
  --scrollbar-thumb: #3b5178;
}

.page-enter-active,
.page-leave-active {
  transition: all 0.2s;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
  transform: translateY(1rem);
  filter: blur(0.2rem);
}

:root {
  --ui-header-height: calc(var(--spacing) * 16);
}
</style>
