<script setup lang="ts">
import type { CustomerIntegrationActivity } from '../../shared/customer-insights'
import { ADMIN_JOURNEY_COPY as copy } from '../../shared/journey-evidence'

const { userId } = defineProps<{ userId: number }>()
type ActivityRead = { _tag: 'Unlinked' } | { _tag: 'Available', measuredAt: string, activities: CustomerIntegrationActivity[] }
const { data, status, error, execute } = useFetch<ActivityRead>(() => `/api/admin/users/${userId}/integration-activity`, { immediate: false, server: false, watch: false })
</script>

<template>
  <section class="space-y-2 border-t border-default py-3" aria-label="Integration activity">
    <UButton color="neutral" variant="outline" class="min-h-11" :loading="status === 'pending'" :disabled="status === 'pending'" @click="execute()">
      {{ data ? 'Refresh integration activity' : 'Load integration activity' }}
    </UButton>
    <p v-if="error" role="alert" class="text-sm">
      Integration activity could not load. Retry to read the engine record.
    </p>
    <p v-if="data?._tag === 'Unlinked'" class="text-sm text-muted">
      No engine account is linked. Integration activity remains unknown.
    </p>
    <template v-if="data?._tag === 'Available'">
      <p class="text-sm text-muted">
        Source: gscdump credential activity. Measured <time :datetime="data.measuredAt">{{ data.measuredAt }}</time>.
        A successful call does not prove a useful answer.
      </p>
      <p v-if="!data.activities.length" class="text-sm text-muted">
        No retained activity was returned. Historical use remains unknown.
      </p>
      <dl v-for="activity in data.activities" :key="`${activity.surface}:${activity.client}`" class="space-y-1 text-sm">
        <dt class="font-medium">
          {{ activity.label }} · {{ activity.client }}
        </dt>
        <dd>Coverage: {{ activity.coverage }}</dd>
        <dd>Configured users: {{ activity.configuredUsers ?? copy.unavailable }}</dd>
        <dd>Successful users: {{ activity.successfulUsers ?? copy.unavailable }}</dd>
        <dd>Successful calls: {{ activity.successfulCalls ?? copy.unavailable }}</dd>
        <dd>First observed: {{ activity.firstObservedAt ?? copy.unavailable }}</dd>
        <dd>Last observed: {{ activity.lastObservedAt ?? copy.unavailable }}</dd>
        <dd>{{ activity.note }}</dd>
      </dl>
    </template>
  </section>
</template>
