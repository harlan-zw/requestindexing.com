<script setup lang="ts">
// Confirms a delete on the page the deleted account lands on. Ported from
// nuxtseo.com's landing page: the Account page navigates to
// `/?account_deleted=1`, this opens once, then drops the flag from the URL so
// a reload or a shared link does not show it again.
import { accountDeletionCopy } from '#layers/pro-saas/shared/account-deletion-copy'

const route = useRoute()
const open = ref(false)

onMounted(() => {
  if (route.query.account_deleted !== '1')
    return
  open.value = true
  const { account_deleted: _accountDeleted, ...query } = route.query
  void navigateTo({ path: route.path, query, hash: route.hash }, { replace: true })
})
</script>

<template>
  <UModal v-model:open="open" :title="accountDeletionCopy.deletedTitle">
    <template #body>
      <div class="space-y-2 text-sm text-muted">
        <p>{{ accountDeletionCopy.deleted }}</p>
        <p>
          {{ accountDeletionCopy.googleAccess }}
          <ULink
            :to="accountDeletionCopy.googleAccessUrl"
            target="_blank"
            rel="noopener"
            class="underline"
          >
            {{ accountDeletionCopy.googleAccessAction }}
          </ULink>
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-end">
        <UButton @click="open = false">
          Take care
        </UButton>
      </div>
    </template>
  </UModal>
</template>
