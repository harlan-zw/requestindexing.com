<script setup lang="ts">
import type { IndexingOverviewModel } from '#layers/pro-indexing/app/utils/indexing-overview'
import type { IndexCohortLead } from '#layers/pro-indexing/shared/index-cohorts'
import { computed } from 'vue'
import { ConnectSearchConsoleButton, UiButton, UiCard, UiSkeleton, UiStatusBadge } from '#components'

export type IndexingDiagnosisPanelState
  = | { _tag: 'loading' }
    | { _tag: 'ready', model: IndexingOverviewModel }

const { state, lead } = defineProps<{
  state: IndexingDiagnosisPanelState
  actionTo: string
  sitemapTo: string
  freshness: string | null
  /**
   * A cohort that cleared the significance test. When present it replaces the
   * reason-derived headline and next step: "21 of 76 pages under /docs/og-image
   * are missing" locates the failure, where "Google crawled 38 URLs but chose
   * not to keep them" only names it. Absent when no cohort separates, and the
   * reason-led headline is then still the most specific true statement.
   */
  lead?: IndexCohortLead
  /** Where the lead's action goes. Required whenever `lead` is a `lead`. */
  leadTo?: string
}>()

const cohortLead = computed(() => lead?._tag === 'lead' ? lead : null)

const model = computed(() => state._tag === 'ready' ? state.model : null)

const status = computed(() => {
  if (model.value?._tag !== 'diagnosis')
    return null
  return model.value.diagnosis.severity === 'severe'
    ? { tone: 'error' as const, label: 'Action needed' }
    : model.value.diagnosis.severity === 'watch' || model.value.diagnosis.reason !== 'none'
      ? { tone: 'warning' as const, label: 'Review' }
      : { tone: 'success' as const, label: 'Healthy' }
})
</script>

<template>
  <UiCard emphasis size="lg">
    <div v-if="state._tag === 'loading'" class="flex min-h-56 flex-col justify-center gap-6" aria-live="polite">
      <div class="space-y-3">
        <UiSkeleton type="text" :base="100" :range="16" />
        <UiSkeleton type="text" :base="520" :range="80" class="!h-8" />
        <UiSkeleton type="text" :base="280" :range="60" />
      </div>
      <div class="flex flex-col gap-4 border-t border-default pt-5 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0 flex-1 space-y-2">
          <UiSkeleton type="text" :base="70" :range="12" />
          <UiSkeleton type="text" :base="240" :range="50" />
          <UiSkeleton type="text" :base="440" :range="80" />
        </div>
        <UiSkeleton type="text" :base="150" :range="20" class="!h-11 shrink-0" />
      </div>
    </div>

    <template v-else-if="model">
      <div v-if="model._tag === 'waiting'" class="flex min-h-56 flex-col justify-center gap-4">
        <UiStatusBadge
          status="neutral"
          :label="model.state === 'not_connected'
            ? 'Setup needed'
            : model.progress && model.progress.inspected > 0 ? 'Inspection in progress' : 'Collection in progress'"
        />
        <div>
          <h2 class="text-2xl font-strong text-default">
            <template v-if="model.state === 'not_connected'">
              Connect Search Console to collect indexing evidence
            </template>
            <template v-else-if="model.progress">
              {{ model.progress.inspected.toLocaleString() }} of {{ model.progress.total.toLocaleString() }} sitemap URLs inspected
            </template>
            <template v-else>
              Waiting for indexing evidence
            </template>
          </h2>
          <p class="mt-2 max-w-2xl text-sm text-muted">
            {{ model.reason }}
          </p>
        </div>
        <!-- The reason above states the condition. This is the only control
             that clears it, so the setup branch must never render without it. -->
        <ConnectSearchConsoleButton
          v-if="model.state === 'not_connected'"
          class="self-start"
        />
        <UiButton v-if="model.state === 'pending' && !model.progress" :to="sitemapTo" purpose="secondary" trailing-icon="next" class="min-h-11 self-start">
          Review sitemap
        </UiButton>
        <div v-if="model.progress" class="max-w-sm">
          <div
            class="h-2 overflow-hidden rounded-full bg-accented"
            role="progressbar"
            aria-label="Sitemap inspection progress"
            :aria-valuenow="model.progress.inspected"
            aria-valuemin="0"
            :aria-valuemax="model.progress.total"
          >
            <div
              class="h-full bg-primary"
              :style="{ width: `${Math.min(100, model.progress.inspected / model.progress.total * 100)}%` }"
            />
          </div>
        </div>
      </div>

      <div v-else-if="model._tag === 'trust_failure'" class="flex min-h-56 flex-col justify-center gap-4">
        <UiStatusBadge status="error" label="Cannot confirm indexing" />
        <div>
          <h2 class="text-2xl font-strong text-default">
            Fix the sitemap signal before trusting coverage
          </h2>
          <p class="mt-2 max-w-2xl text-sm text-muted">
            {{ model.reason }}
          </p>
        </div>
        <UiButton :to="sitemapTo" purpose="cta" trailing-icon="next" class="min-h-11 self-start">
          Review sitemap
        </UiButton>
      </div>

      <div v-else-if="model._tag === 'verify_scope'" class="flex min-h-56 flex-col justify-center gap-4">
        <UiStatusBadge status="warning" label="Verify scope" />
        <div>
          <h2 class="text-2xl font-strong text-default">
            Indexing scope may have collapsed
          </h2>
          <!-- The button already says to verify the inventory; the sentence that
               used to repeat it here was the action twice. -->
          <p class="mt-2 max-w-2xl text-sm text-muted">
            {{ model.reason }}
          </p>
        </div>
        <UiButton :to="sitemapTo" purpose="cta" trailing-icon="next" class="min-h-11 self-start">
          Verify sitemap inventory
        </UiButton>
      </div>

      <div v-else-if="model._tag === 'partial_scope'" class="flex min-h-56 flex-col justify-center gap-4">
        <UiStatusBadge status="neutral" label="Inspection in progress" />
        <div>
          <h2 class="text-2xl font-strong text-default">
            The inspected sample looks indexed
          </h2>
          <p class="mt-2 max-w-2xl text-sm text-muted">
            {{ model.reason }}
          </p>
        </div>
        <UiButton :to="actionTo" purpose="secondary" trailing-icon="next" class="min-h-11 self-start">
          View inspected URLs
        </UiButton>
      </div>

      <div v-else class="flex flex-col gap-6">
        <div class="min-w-0">
          <UiStatusBadge
            v-if="status"
            :status="status.tone"
            :label="status.label"
          />
          <h2 class="mt-3 max-w-3xl text-2xl font-strong text-default">
            {{ cohortLead ? cohortLead.title : model.diagnosis.summary }}
          </h2>
          <!-- One supporting line, not three. The cohort detail and the
               site-wide figure answer the same "how big is this" question, so
               they share a line instead of stacking. -->
          <p class="mt-2 text-sm text-muted">
            <template v-if="cohortLead">
              {{ cohortLead.detail }} · {{ model.scope.indexedLabel }} URLs indexed site-wide.
            </template>
            <template v-else>
              {{ model.scope.indexedLabel }} URLs indexed.
            </template>
          </p>
          <p v-if="model.trustNote" class="mt-2 text-sm text-warning">
            {{ model.trustNote }}
          </p>
        </div>

        <div
          v-if="cohortLead"
          class="flex flex-col gap-4 border-t border-default pt-5 sm:flex-row sm:items-start sm:justify-between"
        >
          <div class="min-w-0">
            <p class="text-label">
              Next step
            </p>
            <h3 class="mt-1 text-base font-semibold text-default">
              {{ model.primaryAction ? model.primaryAction.label : 'Review this section' }}
            </h3>
            <!-- The comparison IS the reason to act on this section rather than
                 the site. Stated as the two rates, without the sentence that
                 used to explain what subtraction means. -->
            <p class="mt-1 max-w-3xl text-sm text-muted">
              Rest of the site: {{ Math.round(cohortLead.cell.complementRate * 100) }}% not indexed.
            </p>
          </div>
          <UiButton
            :to="leadTo ?? actionTo"
            purpose="cta"
            trailing-icon="next"
            class="min-h-11 shrink-0 self-start"
          >
            {{ cohortLead.actionLabel }}
          </UiButton>
        </div>

        <div
          v-else-if="model.primaryAction"
          class="flex flex-col gap-4 border-t border-default pt-5 sm:flex-row sm:items-start sm:justify-between"
        >
          <div class="min-w-0">
            <p class="text-label">
              Next step
            </p>
            <h3 class="mt-1 text-base font-semibold text-default">
              {{ model.primaryAction.label }}
            </h3>
            <p class="mt-1 max-w-3xl text-sm text-muted">
              {{ model.primaryAction.detail }}
            </p>
          </div>
          <UiButton
            :to="actionTo"
            purpose="cta"
            trailing-icon="next"
            class="min-h-11 shrink-0 self-start"
          >
            {{ model.primaryAction.buttonLabel }}
          </UiButton>
        </div>

        <UiButton
          v-else
          :to="actionTo"
          purpose="secondary"
          trailing-icon="next"
          class="min-h-11 self-start"
        >
          View inspected URLs
        </UiButton>

        <!-- Freshness is metadata about the verdict, not part of it. -->
        <p v-if="freshness" class="text-mini text-dimmed">
          Diagnosis {{ freshness }}
        </p>
      </div>
    </template>
  </UiCard>
</template>
