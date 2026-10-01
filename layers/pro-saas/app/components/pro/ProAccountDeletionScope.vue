<script setup lang="ts">
// What a delete reaches beyond this app. The Danger zone and the delete dialog
// both render this list, so the two can never describe different deletes.
import { accountDeletionCopy } from '#layers/pro-saas/shared/account-deletion-copy'
</script>

<template>
  <ul class="ml-5 list-disc space-y-1 text-sm text-muted">
    <li>{{ accountDeletionCopy.engineRecord }}</li>
    <li>
      {{ accountDeletionCopy.googleAccess }}
      <ULink
        :to="accountDeletionCopy.googleAccessUrl"
        target="_blank"
        rel="noopener"
        class="underline"
      >
        {{ accountDeletionCopy.googleAccessAction }}
      </ULink>
    </li>
  </ul>
</template>
