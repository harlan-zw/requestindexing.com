<script setup lang="ts">
import type { IndexNowConnectionV1 } from '@gscdump/contracts/v1'
import type { OverviewSiteRead } from '../../composables/useProOverviewReads'
import type { BingIntegrationRow } from '../../utils/bing-integration-view'
import type { OverviewFleetRow } from './overview-sites'
import { PRO_SHELL_TONE_TEXT } from '@nuxtseo/pro-shell/shared/fleet-sites'
import { useElementVisibility, whenever } from '@vueuse/core'
import { computed, ref, useId, useTemplateRef } from 'vue'
import { NuxtLink, UiFavicon, UiSkeleton, UiSourceLogos, UiSparkColumns, UiTooltip } from '#components'
import { useIndexNowConnection } from '#layers/indexing/app/composables/useSiteSubmissions'

const { row, gscdumpSiteId, bingRow, indexing, setupIndexNow } = defineProps<{
  row: OverviewFleetRow
  gscdumpSiteId?: string | null
  bingRow?: BingIntegrationRow
  indexing?: OverviewSiteRead['indexing']
  /** Null means the setup offer owns the read and has no results yet. */
  setupIndexNow?: IndexNowConnectionV1 | null
}>()

const card = useTemplateRef<HTMLElement>('card')
const descriptionId = useId()
const visible = useElementVisibility(card)
const seen = ref(false)
whenever(visible, () => {
  seen.value = true
}, { once: true })
const indexNow = useIndexNowConnection(() => seen.value && setupIndexNow === undefined ? gscdumpSiteId ?? undefined : undefined)

const bingStatuses = {
  'collecting': { label: 'Collecting', class: 'text-muted' },
  'verify': { label: 'Verification needed', class: 'text-warning' },
  'reconnect': { label: 'Reconnect required', class: 'text-error' },
  'linkable': { label: 'Link Site', class: 'text-muted' },
  'grant-required': { label: 'Connect Bing', class: 'text-muted' },
} as const

const sources = computed(() => {
  const search = {
    id: 'search',
    label: 'Search Console',
    icon: 'i-logos-google-search-console',
    to: gscdumpSiteId ? `${row.to}/search-console` : row.to,
    status: row.detail.label,
    detail: [row.detail.summary, row.detail.action].filter(Boolean).join(' '),
    class: row.detail.urgent ? PRO_SHELL_TONE_TEXT[row.detail.tone] : 'text-muted',
  }
  if (!gscdumpSiteId)
    return [search]

  const indexingSource = {
    id: 'indexing',
    label: 'Indexing',
    icon: 'database',
    to: `${row.to}/indexing`,
    status: (indexing?._tag === 'Ok' || indexing?._tag === 'Stale') && indexing.value?.notIndexed
      ? `${indexing.value.notIndexed.toLocaleString('en-US')} not indexed`
      : '',
    detail: '',
    class: 'text-muted',
  }
  const connection = setupIndexNow === undefined ? indexNow.data.value : setupIndexNow
  const indexNowSource = {
    id: 'indexnow',
    label: 'IndexNow',
    icon: 'send',
    to: `${row.to}/indexing/indexnow`,
    status: connection?._tag === 'connected'
      ? 'Key verified'
      : connection?._tag === 'verification-required' ? 'Verify your key before submitting URLs.' : connection?._tag === 'disconnected' ? 'No IndexNow key yet.' : '',
    detail: '',
    class: connection?._tag === 'verification-required' ? 'text-warning' : 'text-muted',
  }
  if (!bingRow || bingRow._tag === 'unavailable')
    return [search, indexingSource, indexNowSource]

  const bingMeta = bingStatuses[bingRow._tag]
  return [search, indexingSource, indexNowSource, {
    id: 'bing',
    label: 'Bing',
    icon: 'i-logos-bing',
    to: bingRow._tag === 'collecting' ? `${row.to}/webmaster-tools` : '/pro/dashboard/integrations',
    status: bingMeta.label,
    detail: '',
    class: bingMeta.class,
  }]
})
</script>

<template>
  <article ref="card" :data-site="row.id" class="flex min-w-0 flex-col">
    <h3 class="mb-1.5 px-1">
      <NuxtLink
        :to="row.to"
        class="group flex w-fit max-w-full items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <UiFavicon :domain="row.host" :size="16" decorative class="shrink-0 rounded bg-default p-0.5" />
        <span class="truncate text-sm font-medium text-highlighted group-hover:underline">{{ row.name }}</span>
      </NuxtLink>
    </h3>

    <ul class="grid flex-1 auto-rows-fr grid-cols-2 gap-px overflow-hidden rounded-xl border border-default bg-[var(--ui-border)]">
      <li v-for="(source, index) in sources" :key="source.id" class="min-w-0 bg-elevated" :class="index === sources.length - 1 && index % 2 === 0 ? 'col-span-2' : ''">
        <UiTooltip
          trigger-as="child"
          :title="source.status || source.label"
          :description="source.detail"
          :disabled="!source.detail"
        >
          <NuxtLink
            :to="source.to"
            :aria-describedby="source.detail ? `${descriptionId}-${source.id}` : undefined"
            class="group flex h-full min-h-16 flex-col gap-1 px-2.5 py-2 outline-none transition-colors hover:bg-accented focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          >
            <span class="flex items-center gap-1.5 text-sm font-medium text-highlighted">
              <UiSourceLogos :sources="[source]" :dither="true" size="inline" aria-hidden="true" />
              {{ source.label }}
            </span>
            <span v-if="source.status" class="text-sm leading-tight" :class="source.class">{{ source.status }}</span>
            <template v-if="source.id === 'search'">
              <UiSkeleton v-if="row.spark._tag === 'Reading'" type="text" :base="72" :range="24" class="!h-3" aria-hidden="true" />
              <template v-else-if="row.spark._tag === 'Read' && row.spark.data.length">
                <span v-if="row.entry.clicks._tag === 'Read'" class="text-sm text-muted">{{ row.entry.clicks.clicks.toLocaleString('en-US') }} clicks</span>
                <UiSparkColumns :data="[...row.spark.data]" size="sm" tone="neutral" aria-hidden="true" class="mt-auto block" />
              </template>
            </template>
          </NuxtLink>
        </UiTooltip>
        <span v-if="source.detail" :id="`${descriptionId}-${source.id}`" class="sr-only">{{ source.detail }}</span>
      </li>
    </ul>
  </article>
</template>
