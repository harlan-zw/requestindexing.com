<script setup lang="ts">
// The free tools answer from a Google `site:` search. This block offers the
// answer Google gives itself, URL Inspection, which the dashboard reads through
// gscdump once a visitor connects Google. Layout ported from nuxtseo.com's
// `ToolProMonitorCta`. The strings are COPY.md's Free tool assets.
//
// The tool pages are prerendered, so the session loads in the browser after
// mount. The link follows it rather than reading it once.
const { loggedIn } = useUserSession()
</script>

<template>
  <div
    data-testid="tool-inspection-cta"
    class="p-5 rounded-xl bg-elevated border border-accented flex flex-col gap-4 sm:flex-row sm:items-center"
  >
    <div class="flex flex-1 items-start gap-3">
      <UIcon name="google" class="size-5 text-toned shrink-0 mt-0.5" />
      <div class="min-w-0">
        <p class="text-sm font-semibold text-highlighted">
          See Google's own verdict
        </p>
        <p class="text-sm text-muted mt-1">
          Search Console's URL Inspection says whether Google indexed a page, and if not, why. Request Indexing shows that answer for the Sites you connect.
        </p>
      </div>
    </div>
    <UButton
      :to="loggedIn ? '/pro/dashboard/indexing' : '/pro/onboarding'"
      color="primary"
      trailing-icon="next"
      class="min-h-11 w-full shrink-0 justify-center sm:min-h-0 sm:w-auto"
    >
      {{ loggedIn ? 'Open Indexing' : 'Connect Google' }}
    </UButton>
  </div>
</template>
