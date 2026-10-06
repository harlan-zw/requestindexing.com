<script setup lang="ts">
import type { SiteSelect } from '#shared/types/database'

import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'

definePageMeta({
  layout: 'admin',
  title: 'Admin Sites',
})

const data = ref<SiteSelect[]>([])

onMounted(async () => {
  data.value = await getAppFetch()('/api/admin/sites')
})

const columns: { key: string, label: string }[] = [
  { key: 'publicId', label: 'Public ID' },
  { key: 'domain', label: 'Domain' },
  { key: 'createdAt', label: 'Created At' },
  { key: 'updatedAt', label: 'Updated At' },
  { key: 'actions', label: 'Actions' },
]

function deleteSite(site: SiteSelect) {
  // Widened to `string` so Nitro's typed-route inference does not fold this
  // into the GET-only `/api/sites/list` match a bare template literal reaches.
  getAppFetch()(`/api/sites/${site.publicId}` as string, { method: 'DELETE' })
}
</script>

<template>
  <div>
    <TableData :value="data" :columns="columns">
      <template #publicId-data="{ row }">
        <NuxtLink :to="`/admin/sites/${row.publicId}`" class="underline">
          {{ row.publicId }}
        </NuxtLink>
      </template>
      <template #createdAt-data="{ row }">
        <span>{{ formatIndexingTimeAgo(row.createdAt) }}</span>
      </template>
      <template #updatedAt-data="{ row }">
        <span>{{ formatIndexingTimeAgo(row.updatedAt) }}</span>
      </template>
      <template #actions-data="{ row }">
        <UButton size="xs" color="neutral" @click="deleteSite(row)">
          Delete
        </UButton>
      </template>
    </TableData>
  </div>
</template>
