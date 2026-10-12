<script lang="ts" setup>
import { gscConsoleUrl } from '@gscdump/sdk/gsc-console-url'
import { useProGscdump } from '#layers/pro-gsc/app/composables/useProGscdump'
import { useSite } from '#layers/pro-saas/app/composables/useSite'

const props = defineProps<{
  siteId: string
}>()

const { data: status, refresh, fetchStatus, isNotConnected, isTokenRevoked, isPermissionLost, hasError, hasSyncError } = useProGscStatus(() => props.siteId)
const { site } = useSite()
const { recoverSitePermission } = useProGscdump()
const toast = useToast()

const statusMessage = computed(() => {
  if (!status.value)
    return ''
  if (status.value.lastError)
    return status.value.lastError
  return ''
})

const consoleUrl = computed(() => {
  const resource = status.value?.gscSiteUrl || status.value?.gscdumpSiteUrl
  return resource ? gscConsoleUrl({ siteLabel: resource, resource: 'performance' }) : 'https://search.google.com/search-console'
})

const isRefreshing = ref(false)
async function handleRefresh() {
  isRefreshing.value = true
  await refresh()
  isRefreshing.value = false
}

async function handleRecoverPermission() {
  const gscdumpSiteId = site.value?.gscdumpSiteId
  if (!gscdumpSiteId)
    return
  isRefreshing.value = true
  const result = await recoverSitePermission({ params: { siteId: gscdumpSiteId } }, true)
    .catch(e => ({ success: false, message: e?.data?.message || 'Recovery failed. Try again in a moment.' } as const))
  if (result.success) {
    toast.add({ title: 'Permission restored', description: result.message, color: 'success' })
  }
  else {
    toast.add({ title: 'Still no access', description: result.message, color: 'error' })
  }
  await refresh()
  isRefreshing.value = false
}

function reconnectGoogle() {
  navigateTo('/auth/integrations/gsc/callback', { external: true })
}
</script>

<template>
  <!-- Permission lost on the GSC property itself (user removed from the property in GSC) -->
  <ProAlert
    v-if="isPermissionLost"
    color="error"
    icon="i-lucide-shield-off"
    title="Search Console access lost"
    description="Your Google account no longer has access to this property in Search Console. Re-verify or ask the owner to grant access, then retry."
  >
    <template #action>
      <div class="flex items-center gap-2">
        <UButton
          size="xs"
          color="neutral"
          variant="subtle"
          icon="i-lucide-external-link"
          :to="consoleUrl"
          target="_blank"
        >
          Open Search Console
        </UButton>
        <UButton
          size="xs"
          color="neutral"
          variant="ghost"
          icon="i-lucide-refresh-cw"
          :loading="isRefreshing || fetchStatus === 'pending'"
          @click="handleRecoverPermission"
        >
          Retry
        </UButton>
      </div>
    </template>
  </ProAlert>

  <!-- Token revoked -->
  <ProAlert
    v-else-if="isTokenRevoked"
    color="error"
    icon="i-lucide-unplug"
    title="Google access revoked"
    description="Your Google Search Console access was revoked. Reconnect to continue syncing data."
  >
    <template #action>
      <UButton
        size="xs"
        color="neutral"
        variant="subtle"
        icon="i-lucide-cable"
        @click="reconnectGoogle"
      >
        Reconnect
      </UButton>
    </template>
  </ProAlert>

  <!-- Not connected -->
  <ProAlert
    v-else-if="isNotConnected"
    color="warning"
    icon="i-lucide-unlink"
    title="Search Console not connected"
    description="Connect Google Search Console to see keyword rankings, pages, and traffic data."
  >
    <template #action>
      <UButton
        size="xs"
        color="neutral"
        variant="subtle"
        icon="i-lucide-cable"
        :to="`/pro/dashboard/sites/${siteId}/search-console`"
      >
        Connect
      </UButton>
    </template>
  </ProAlert>

  <!-- Refresh reads status. It does not restart collection. -->
  <ProAlert
    v-else-if="hasError || hasSyncError"
    color="error"
    icon="i-lucide-circle-alert"
    :title="hasError ? 'Search Console status unavailable' : 'Search Console collection failed'"
    :description="hasError ? 'Could not read the Search Console status. Retry this check.' : 'Search Console data collection failed. Refresh status to check for changes.'"
  >
    <p v-if="!hasError && statusMessage" class="mt-2 text-sm text-muted">
      {{ statusMessage }}
    </p>
    <template #action>
      <UButton
        size="xs"
        color="neutral"
        variant="subtle"
        icon="i-lucide-refresh-cw"
        :loading="isRefreshing || fetchStatus === 'pending'"
        @click="handleRefresh"
      >
        {{ hasError ? 'Retry status check' : 'Refresh status' }}
      </UButton>
    </template>
  </ProAlert>
</template>
