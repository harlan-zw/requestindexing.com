<script setup lang="ts">
import type { FunnelReport } from '../../../shared/funnel'
import { defaultFunnelDates, FUNNEL_STEPS, parseFunnelQuery } from '../../../shared/funnel'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Signup funnel' })

const initialDates = useState('admin-funnel-dates', () => defaultFunnelDates())
const from = ref(initialDates.value.from)
const to = ref(initialDates.value.to)
const source = ref('all')
const stage = ref('all')
const search = ref('')
const page = ref(1)
const validationError = ref('')
const filters = ref({ ...initialDates.value, source: 'all', stage: 'all', search: '', page: 1 })
const { data, status, error, refresh } = useFetch<FunnelReport>('/api/admin/funnel', { query: filters })
const report = computed(() => status.value === 'success' && !error.value ? data.value : null)
const sourceOptions = computed(() => [
  { label: 'All sources', value: 'all' },
  ...(data.value?.sources ?? []).map(value => ({ label: value, value })),
])
const stageOptions = [
  { label: 'All users', value: 'all' },
  ...FUNNEL_STEPS.slice(1).map(step => ({ label: `Missing: ${step.label}`, value: step.key })),
  { label: 'All steps recorded', value: 'complete' },
]
const maxSignups = computed(() => Math.max(1, ...(report.value?.days.map(day => day.count) ?? [])))
const percentage = (value: number | null) => value === null ? '—' : `${value}%`
const timestamp = (value: string) => `${value.slice(0, 16).replace('T', ' ')} UTC`

function applyFilters(nextPage = 1) {
  try {
    filters.value = parseFunnelQuery({ from: from.value, to: to.value, source: source.value, stage: stage.value, search: search.value, page: nextPage })
    page.value = nextPage
    validationError.value = ''
  }
  catch (error) {
    validationError.value = (error as Error).message
  }
}

function preset(days: number) {
  const dates = defaultFunnelDates(Date.now(), days)
  from.value = dates.from
  to.value = dates.to
  applyFilters()
}

function inspectStage(key: string) {
  stage.value = key
  applyFilters()
}
</script>

<template>
  <div class="space-y-6 max-w-7xl">
    <header class="space-y-2">
      <h1 class="text-2xl font-semibold text-highlighted">
        Signup funnel
      </h1>
      <p class="text-muted text-sm">
        Users who signed up in the selected period, followed through their recorded onboarding progress as of now.
      </p>
    </header>

    <form class="flex flex-wrap items-end gap-3" @submit.prevent="applyFilters()">
      <UFormField label="Signup from (UTC)">
        <UInput v-model="from" type="date" aria-label="Signup from (UTC)" />
      </UFormField>
      <UFormField label="Signup through (UTC)">
        <UInput v-model="to" type="date" aria-label="Signup through (UTC)" />
      </UFormField>
      <UFormField label="Signup source">
        <USelect v-model="source" :items="sourceOptions" class="min-w-52" aria-label="Signup source" />
      </UFormField>
      <UButton type="submit" color="primary" :loading="status === 'pending'">
        Apply filters
      </UButton>
      <div class="flex gap-1">
        <UButton v-for="days in [7, 30, 90]" :key="days" color="neutral" variant="ghost" @click="preset(days)">
          {{ days }} days
        </UButton>
      </div>
    </form>
    <p v-if="validationError" role="alert" class="text-error text-sm">
      {{ validationError }}
    </p>

    <div v-if="status === 'pending'" role="status" class="py-12 text-muted">
      Loading signup funnel…
    </div>
    <div v-else-if="error" role="alert" class="space-y-3">
      <p>Signup funnel could not load. Retry to read the current figures.</p>
      <UButton color="neutral" variant="outline" @click="refresh()">
        Retry loading
      </UButton>
    </div>
    <template v-else-if="report">
      <p class="text-sm text-muted">
        {{ report.period.from }} to {{ report.period.to }}, inclusive · UTC · Updated {{ timestamp(report.capturedAt) }}
      </p>
      <dl class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="rounded-lg border border-default p-5">
          <dt class="text-sm text-muted">
            Signups
          </dt>
          <dd class="text-3xl font-semibold tabular-nums mt-1">
            {{ report.total }}
          </dd>
        </div>
        <div class="rounded-lg border border-default p-5">
          <dt class="text-sm text-muted">
            Finished setup
          </dt>
          <dd class="text-3xl font-semibold tabular-nums mt-1">
            {{ report.setupCompleted }}
          </dd>
        </div>
        <div class="rounded-lg border border-default p-5">
          <dt class="text-sm text-muted">
            Setup unfinished
          </dt>
          <dd class="text-3xl font-semibold tabular-nums mt-1">
            {{ report.total - report.setupCompleted }}
          </dd>
        </div>
      </dl>

      <p v-if="!report.total" class="rounded-lg border border-default p-6 text-muted">
        No signups match this period and source. Choose another date range or source.
      </p>
      <section aria-labelledby="signup-trend-heading" class="space-y-3">
        <h2 id="signup-trend-heading" class="text-lg font-semibold">
          Signups by day
        </h2>
        <div class="overflow-x-auto rounded-lg border border-default p-4">
          <div class="flex h-36 items-end gap-1" :style="{ minWidth: `${report.days.length * 9}px` }" role="img" :aria-label="`${report.total} signups from ${report.period.from} to ${report.period.to}. Exact daily counts are in the table below.`">
            <div v-for="day in report.days" :key="day.date" class="flex-1 h-full flex items-end" :title="`${day.date}: ${day.count} signups`">
              <div class="w-full bg-info rounded-sm" :style="{ height: `${day.count / maxSignups * 100}%` }" />
            </div>
          </div>
          <div class="flex justify-between mt-3 text-sm text-muted tabular-nums">
            <span>{{ report.period.from }}</span><span>{{ report.period.to }}</span>
          </div>
        </div>
        <details class="text-sm">
          <summary class="cursor-pointer text-muted py-2">
            Show daily counts
          </summary>
          <div class="max-h-64 overflow-auto">
            <table class="w-full text-left tabular-nums">
              <caption class="sr-only">
                Daily signups in UTC
              </caption>
              <thead>
                <tr>
                  <th scope="col" class="p-2">
                    Date
                  </th><th scope="col" class="p-2">
                    Signups
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="day in report.days" :key="day.date">
                  <td class="p-2">
                    {{ day.date }}
                  </td><td class="p-2">
                    {{ day.count }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section aria-labelledby="onboarding-funnel-heading" class="space-y-3">
        <h2 id="onboarding-funnel-heading" class="text-lg font-semibold">
          Onboarding funnel
        </h2>
        <p class="text-sm text-muted">
          Each funnel row requires all preceding milestones. Progress after the signup period is included. Missing evidence is not proof of abandonment.
        </p>
        <div class="overflow-x-auto rounded-lg border border-default">
          <table class="w-full text-left text-sm tabular-nums">
            <caption class="sr-only">
              Signup cohort conversion through recorded onboarding milestones
            </caption>
            <thead class="bg-muted">
              <tr>
                <th scope="col" class="p-4">
                  Step
                </th><th scope="col" class="p-4">
                  Users
                </th><th scope="col" class="p-4">
                  Of signups
                </th><th scope="col" class="p-4">
                  From previous
                </th><th scope="col" class="p-4">
                  Missing this step
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(step, index) in report.stages" :key="step.key" class="border-t border-default">
                <th scope="row" class="p-4 font-medium min-w-52">
                  {{ step.label }}
                  <div class="h-1.5 rounded-sm bg-muted mt-2" aria-hidden="true">
                    <div class="h-full rounded-sm bg-info" :style="{ width: `${step.percent ?? 0}%` }" />
                  </div>
                </th>
                <td class="p-4">
                  {{ step.count }}
                </td>
                <td class="p-4">
                  {{ percentage(step.percent) }}
                </td>
                <td class="p-4">
                  {{ index ? percentage(step.conversion) : '—' }}
                </td>
                <td class="p-4">
                  <UButton v-if="index" color="neutral" variant="link" :aria-label="`Show ${step.dropped} users missing ${step.label}`" @click="inspectStage(step.key)">
                    {{ step.dropped }} users
                  </UButton>
                  <span v-else>—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="report.completedOutsidePath" class="text-sm text-muted">
          {{ report.completedOutsidePath }} users finished setup without all earlier milestones recorded. They are included in Finished setup above, but not in the full funnel path.
        </p>
      </section>

      <section aria-labelledby="funnel-users-heading" class="space-y-3">
        <h2 id="funnel-users-heading" class="text-lg font-semibold">
          Users in this cohort
        </h2>
        <form class="flex flex-wrap gap-3" @submit.prevent="applyFilters()">
          <USelect v-model="stage" :items="stageOptions" class="min-w-64" aria-label="Onboarding progress" />
          <UInput v-model="search" placeholder="Search name or email" aria-label="Search cohort users" class="min-w-64" />
          <UButton type="submit" color="neutral" variant="outline">
            Filter users
          </UButton>
        </form>
        <div class="overflow-x-auto rounded-lg border border-default">
          <table class="w-full text-left text-sm">
            <thead class="bg-muted">
              <tr>
                <th scope="col" class="p-4">
                  User
                </th><th scope="col" class="p-4">
                  Signed up (UTC)
                </th><th scope="col" class="p-4">
                  Google
                </th><th scope="col" class="p-4">
                  Site
                </th><th scope="col" class="p-4">
                  Setup
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="user in report.users" :key="user.id" class="border-t border-default">
                <td class="p-4">
                  <p class="font-medium">
                    {{ user.name || user.email }}
                  </p><p class="text-muted">
                    {{ user.email }}
                  </p>
                </td>
                <td class="p-4 whitespace-nowrap tabular-nums">
                  {{ timestamp(user.signedUpAt) }}<p v-if="user.signupEvidence === 'account'" class="text-muted">
                    Account creation date
                  </p>
                </td>
                <td class="p-4">
                  {{ user.googleConnected ? 'Recorded' : 'Not recorded' }}
                </td>
                <td class="p-4">
                  {{ user.siteConnected ? 'Recorded' : 'Not recorded' }}
                </td>
                <td class="p-4">
                  {{ user.setupCompleted ? 'Finished' : 'Unfinished' }}
                </td>
              </tr>
              <tr v-if="!report.users.length">
                <td colspan="5" class="p-6 text-muted">
                  No users match these progress and search filters.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="flex items-center justify-between gap-3 text-sm">
          <span class="text-muted">{{ report.pagination.total }} users · Page {{ report.pagination.page }} of {{ report.pagination.pageCount }}</span>
          <div class="flex gap-2">
            <UButton color="neutral" variant="outline" :disabled="report.pagination.page <= 1" @click="applyFilters(report.pagination.page - 1)">
              Previous page
            </UButton>
            <UButton color="neutral" variant="outline" :disabled="report.pagination.page >= report.pagination.pageCount" @click="applyFilters(report.pagination.page + 1)">
              Next page
            </UButton>
          </div>
        </div>
      </section>
      <aside class="border-t border-default pt-4 text-sm text-muted space-y-2" aria-label="Data coverage">
        <p>Dates select signup cohorts, not event activity. Each user counts once per step. Deleted accounts are excluded.</p>
        <p>{{ report.accountDateFallbacks }} users use the stored account creation date because no signup event is available. Imported account dates may reflect an import rather than the original signup.</p>
        <p>Google and Site milestones come from recorded first-time events. Older progress may be unrecorded. Finishing setup can include skipping Site connection; it does not mean data finished syncing.</p>
      </aside>
    </template>
  </div>
</template>
