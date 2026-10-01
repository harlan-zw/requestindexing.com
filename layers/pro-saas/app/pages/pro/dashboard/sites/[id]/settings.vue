<script lang="ts" setup>
import { useProGscdumpSitemaps } from '#layers/pro-gsc/app/composables/useProGscdump'
import { useRemoveSite } from '#layers/pro-saas/app/composables/useRemoveSite'
import { MISSING_SITE_PATH } from '#layers/pro-saas/shared/site-lookup'

definePageMeta({
  proTab: { feature: 'settings', label: 'Site Settings', icon: 'i-heroicons-cog', order: 90 },
  title: 'Site settings',
  icon: 'i-heroicons-cog',
})

const { site, siteId, siteName, gscdumpSiteId } = useSite('Site Settings')

// The Sitemaps page reads Search Console through gscdump. This panel used to
// read `sites.sitemaps`, a column nothing writes any more, so a site with a
// live sitemap reported none here. One source, one answer.
const {
  data: sitemapsData,
  status: sitemapsStatus,
  error: sitemapsError,
} = useProGscdumpSitemaps(computed(() => gscdumpSiteId.value ?? undefined))

const sitemaps = computed(() => sitemapsData.value?.sitemaps ?? [])
const sitemapsLoading = computed(() =>
  Boolean(gscdumpSiteId.value)
  && !sitemapsData.value
  && !sitemapsError.value
  && (sitemapsStatus.value === 'idle' || sitemapsStatus.value === 'pending'),
)

const toast = useToast()
const confirmOpen = ref(false)
const { removeSite: removeSiteById, removing } = useRemoveSite()

async function removeSite() {
  const name = siteName.value
  const result = await removeSiteById(siteId.value)
  if (result._tag === 'Err') {
    toast.add({ title: 'Site could not be removed', description: result.message, color: 'error' })
    return
  }

  confirmOpen.value = false
  toast.add({ title: 'Site removed', description: `${name} is no longer connected.`, color: 'success' })
  // The Sites list, as nuxtseo.com does, never the Overview. The Overview sends
  // an account with one Site into that Site, so it is the one page that can
  // bounce the reader back to a Site that is gone.
  await navigateTo(MISSING_SITE_PATH, { replace: true })
}
</script>

<template>
  <div class="max-w-2xl space-y-7">
    <div>
      <CardTitle>Site</CardTitle>
      <UCard>
        <dl class="space-y-4 text-sm">
          <div>
            <dt class="text-muted">
              Name
            </dt>
            <dd class="font-medium">
              {{ siteName }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Search Console property
            </dt>
            <dd class="font-mono text-xs break-all">
              {{ site?.property }}
            </dd>
          </div>
          <div>
            <dt class="text-muted">
              Sitemaps
            </dt>
            <dd v-if="sitemapsLoading" class="text-muted">
              Loading sitemaps from Search Console.
            </dd>
            <dd v-else-if="sitemapsError" class="text-muted">
              Search Console sitemaps could not be loaded.
            </dd>
            <dd v-else-if="sitemaps.length" class="space-y-1 font-mono text-xs break-all">
              <div v-for="sitemap in sitemaps" :key="sitemap.path">
                {{ sitemap.path }}
              </div>
            </dd>
            <dd v-else class="text-muted">
              None reported by Search Console.
            </dd>
          </div>
        </dl>
      </UCard>
    </div>

    <div>
      <CardTitle>Remove Site</CardTitle>
      <UCard :ui="{ root: 'ring-error/30' }">
        <p class="mb-4 text-sm text-muted">
          Removing a Site deletes its archived Search Console data and its indexing history. You can connect it again later, but the archive does not come back.
        </p>
        <UButton color="error" variant="soft" @click="confirmOpen = true">
          Remove Site
        </UButton>
      </UCard>
    </div>

    <UModal
      v-model:open="confirmOpen"
      title="Remove this Site?"
      :description="`${siteName} and everything archived for it will be deleted.`"
    >
      <template #footer="{ close }">
        <div class="flex justify-end gap-3">
          <UButton color="neutral" variant="ghost" :disabled="removing" @click="close()">
            Cancel
          </UButton>
          <UButton color="error" :loading="removing" @click="removeSite()">
            Remove Site
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
