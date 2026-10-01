<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  title: 'Admin Dashboard',
})

const { data: users, status: usersStatus } = useLazyFetch('/api/admin/users')
const { data: sites, status: sitesStatus } = useLazyFetch('/api/admin/sites')
const { data: jobsData, status: jobsStatus } = useLazyFetch('/api/admin/jobs')

const userCount = computed(() => users.value?.length ?? 0)
const siteCount = computed(() => sites.value?.length ?? 0)

const jobStats = computed(() => {
  const allJobs = jobsData.value?.jobs ?? []
  return {
    total: allJobs.length,
    completed: allJobs.filter(j => !!j.completedAt).length,
    failed: allJobs.filter(j => !!j.failedAt).length,
    pending: allJobs.filter(j => !j.completedAt && !j.failedAt).length,
  }
})

const cards = computed(() => [
  { label: 'Users', value: userCount.value, icon: 'i-lucide-users', to: '/admin/users', loading: usersStatus.value === 'pending' },
  { label: 'Active Sites', value: siteCount.value, icon: 'i-lucide-globe', to: '/admin/sites', loading: sitesStatus.value === 'pending' },
  { label: 'Jobs (recent)', value: jobStats.value.total, icon: 'i-lucide-list-checks', to: '/admin/jobs', loading: jobsStatus.value === 'pending' },
])
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">
      Dashboard
    </h1>

    <!-- Overview Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      <NuxtLink v-for="card in cards" :key="card.label" :to="card.to">
        <UCard variant="subtle" class="hover:bg-[var(--ui-bg-elevated)] transition-colors">
          <div class="flex items-center gap-3">
            <div class="flex items-center justify-center size-10 rounded-lg bg-primary/10">
              <UIcon :name="card.icon" class="size-5 text-primary" />
            </div>
            <div>
              <p class="text-sm text-muted">
                {{ card.label }}
              </p>
              <div v-if="card.loading" class="h-7 w-12 animate-pulse rounded bg-[var(--ui-bg-elevated)]" />
              <p v-else class="text-2xl font-bold">
                {{ card.value }}
              </p>
            </div>
          </div>
        </UCard>
      </NuxtLink>
    </div>

    <!-- Job Stats -->
    <UCard variant="subtle">
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="font-semibold">
            Recent Job Stats
          </h2>
          <NuxtLink to="/admin/jobs" class="text-sm text-primary hover:underline">
            View all
          </NuxtLink>
        </div>
      </template>
      <div v-if="jobsStatus === 'pending'" class="space-y-2">
        <div v-for="i in 3" :key="i" class="h-6 animate-pulse rounded bg-[var(--ui-bg-elevated)]" />
      </div>
      <div v-else class="grid grid-cols-3 gap-4 text-center">
        <div>
          <p class="text-2xl font-bold text-green-500">
            {{ jobStats.completed }}
          </p>
          <p class="text-sm text-muted">
            Completed
          </p>
        </div>
        <div>
          <p class="text-2xl font-bold text-red-500">
            {{ jobStats.failed }}
          </p>
          <p class="text-sm text-muted">
            Failed
          </p>
        </div>
        <div>
          <p class="text-2xl font-bold text-yellow-500">
            {{ jobStats.pending }}
          </p>
          <p class="text-sm text-muted">
            Pending
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>
