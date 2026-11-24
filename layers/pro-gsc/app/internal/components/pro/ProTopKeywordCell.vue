<script setup lang="ts">
import { useRoute } from 'nuxt/app'
import { computed } from 'vue'
import { NuxtLink } from '#components'
import { readSiteRouteId } from '#layers/pro-saas/shared/site-lookup'
import { searchConsoleLink } from '../../../utils/search-console-link'

// Presentational cell for the page table's "Top Keyword" column. The value is
// resolved in bulk by `useProTopAssociations` (one scan for the whole page),
// so this component just renders the resolved keyword or a placeholder.
const { siteId } = defineProps<{
  siteId: string
  keyword: string | null
  pending: boolean
}>()

// `siteId` prop is the UUID; link uses the URL param so it preserves whichever
// id the user is on (publicId `s_…` or uuid).
const linkRoute = useRoute()
const linkSiteId = computed(() => readSiteRouteId(linkRoute.params) ?? siteId)
</script>

<template>
  <!-- `inline-block` is load-bearing. `max-width`, `overflow` and
       `text-overflow` are all ignored on a non-replaced INLINE box, so the cap
       and the `truncate` beside it were inert from the day they were written:
       a long-tail query rendered at its full intrinsic width and starved the
       sibling columns (measured at 1440: this cell 633px wide, no ellipsis,
       Query column squeezed to 86px). With the box made inline-block the cap
       binds, the ellipsis appears, and Query gets ~260px back.
       `align-bottom` pins the baseline of an overflow-hidden inline-block, which
       otherwise adds 0.5px to the row height. Full text stays in the DOM (and in
       `title`), so nothing is lost to a reader or a screen reader. -->
  <NuxtLink
    v-if="keyword"
    :to="searchConsoleLink(`/pro/dashboard/sites/${linkSiteId}/search-console/queries/${encodeURIComponent(keyword)}`, linkRoute.query)"
    :title="keyword"
    class="inline-block max-w-[140px] truncate align-bottom text-sm text-muted hover:text-primary transition-colors"
  >
    {{ keyword }}
  </NuxtLink>
  <span v-else-if="!pending" class="text-dimmed">—</span>
</template>
