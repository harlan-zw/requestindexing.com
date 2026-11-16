<script setup lang="ts">
import type { AgentActivityRead } from '../../shared/agent-use-export'
import { ADMIN_JOURNEY_COPY as copy } from '../../shared/journey-evidence'

const { userId } = defineProps<{ userId: number }>()
const { data, status, error, execute } = useFetch<AgentActivityRead>(() => `/api/admin/users/${userId}/integration-activity`, { immediate: false, server: false, watch: false })
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
      <p class="text-sm text-muted">
        {{ copy.agentScope }}
      </p>
      <dl v-if="data.localJourney._tag === 'Observed'" class="grid gap-1 text-sm">
        <dt>{{ copy.agentSignup }}</dt>
        <dd><time :datetime="data.localJourney.signedUpAt">{{ data.localJourney.signedUpAt }}</time></dd>
        <dt>{{ copy.agentFirst }}</dt>
        <dd><time :datetime="data.localJourney.firstSuccessfulAt">{{ data.localJourney.firstSuccessfulAt }}</time></dd>
        <dt>{{ copy.agentLast }}</dt>
        <dd><time :datetime="data.localJourney.lastSuccessfulAt">{{ data.localJourney.lastSuccessfulAt }}</time></dd>
        <dt>{{ copy.agentReturn }}</dt>
        <dd>
          <time v-if="data.localJourney.returnedAt" :datetime="data.localJourney.returnedAt">{{ data.localJourney.returnedAt }}</time>
          <span v-else>{{ copy.agentReturnMissing }}</span>
        </dd>
      </dl>
      <p v-else class="text-sm text-muted">
        {{ copy.agentMissing }}
      </p>
      <a :href="`/api/admin/users/${userId}/integration-activity?format=csv`" class="inline-flex min-h-11 items-center underline">{{ copy.export }}</a>
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
      <h4 class="text-sm font-medium">
        {{ copy.reportedSkill }}
      </h4>
      <p class="text-sm text-muted">
        {{ copy.reportedSkillHelp }}
      </p>
      <p v-if="data.skills === undefined" class="text-sm text-muted">
        {{ copy.reportedSkillMissing }}
      </p>
      <p v-else-if="!data.skills.length" class="text-sm text-muted">
        {{ copy.reportedSkillEmpty }}
      </p>
      <p v-if="data.skillsTruncated" role="status" class="text-sm">
        {{ copy.reportedSkillTruncated }}
      </p>
      <dl v-for="skill in data.skills ?? []" :key="`${skill.surface}:${skill.client}:${skill.name}:${skill.version}`" class="space-y-1 text-sm">
        <dt class="font-medium">
          {{ skill.name }} {{ skill.version ?? copy.unavailable }}
        </dt>
        <dd>{{ skill.surface.toUpperCase() }} · {{ skill.client }}</dd>
        <dd>Successful calls: {{ skill.successfulCalls ?? copy.unavailable }}</dd>
        <dd>First observed: {{ skill.firstObservedAt ?? copy.unavailable }}</dd>
        <dd>Last observed: {{ skill.lastObservedAt ?? copy.unavailable }}</dd>
        <dd>{{ skill.note }}</dd>
      </dl>
    </template>
  </section>
</template>
