<script lang="ts" setup>
/**
 * The one control that starts the Search Console grant flow.
 *
 * Signing in with Google establishes identity only. It does not grant the
 * webmasters scopes, so `/auth/integrations/gsc/connect` is the only link that
 * repairs a disconnected account. Every surface that tells the reader to
 * connect Search Console renders this button, so no empty state can state the
 * condition without also offering the fix.
 *
 * `returnTo` defaults to the current page, which sends the reader back to the
 * surface that asked. A card or an empty state places this control itself.
 */
const { returnTo, label = 'Connect Search Console' } = defineProps<{
  /** Where Google returns the reader. Defaults to the current page. */
  returnTo?: string
  /** Visible, accessible button text. */
  label?: string
}>()

const route = useRoute()
const connectHref = computed(
  () => `/auth/integrations/gsc/connect?returnTo=${encodeURIComponent(returnTo ?? route.fullPath)}`,
)
</script>

<template>
  <UiButton
    :to="connectHref"
    external
    purpose="cta"
    icon="google"
    :label="label"
    class="min-h-11"
  />
</template>
