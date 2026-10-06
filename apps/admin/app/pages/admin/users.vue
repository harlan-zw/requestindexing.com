<script setup lang="ts">
import type { UserSelect } from '#shared/types/database'
import { getAppFetch } from '~~/layers/core/app/utils/app-fetch'

definePageMeta({
  layout: 'admin',
  title: 'Admin Users',
})

const data = ref<UserSelect[]>([])

onMounted(async () => {
  data.value = await getAppFetch()('/api/admin/users')
})

const columns: { key: keyof UserSelect, label: string }[] = [
  { key: 'userId', label: 'ID' },
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'createdAt', label: 'Created At' },
  { key: 'updatedAt', label: 'Updated At' },
]
</script>

<template>
  <div>
    <TableData :value="data" :columns="columns" />
  </div>
</template>
