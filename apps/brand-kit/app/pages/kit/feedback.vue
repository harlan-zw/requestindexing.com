<script setup lang="ts">
definePageMeta({ layout: 'kit' })
useHead({ title: 'Feedback · Brand Kit' })

const toast = useToast()
function fire(color: 'success' | 'warning' | 'error' | 'info') {
  toast.add({
    title: `${color[0]!.toUpperCase()}${color.slice(1)} toast`,
    description: 'A short message from the system.',
    color,
  })
}
</script>

<template>
  <div class="space-y-8">
    <KitHeader
      eyebrow="Components"
      title="Feedback"
      description="Badges, alerts, progress, toasts — the system's vocabulary for system state."
    />

    <KitSection title="Badges" code="<UBadge>">
      <UCard variant="outline">
        <div class="space-y-4">
          <KitRow label="Solid">
            <UBadge>Indexed</UBadge>
            <UBadge color="neutral">
              Draft
            </UBadge>
            <UBadge color="success">
              Live
            </UBadge>
            <UBadge color="warning">
              Pending
            </UBadge>
            <UBadge color="error">
              Failed
            </UBadge>
            <UBadge color="info">
              Google API
            </UBadge>
          </KitRow>
          <KitRow label="Soft">
            <UBadge variant="soft">
              Indexed
            </UBadge>
            <UBadge color="warning" variant="soft">
              Pending
            </UBadge>
            <UBadge color="error" variant="soft">
              Failed
            </UBadge>
          </KitRow>
          <KitRow label="Subtle / Outline">
            <UBadge variant="subtle">
              Subtle
            </UBadge>
            <UBadge color="neutral" variant="outline">
              Outline
            </UBadge>
          </KitRow>
          <KitRow label="With icon">
            <UBadge icon="i-lucide-check">
              Verified
            </UBadge>
            <UBadge color="warning" icon="i-lucide-clock" variant="soft">
              Pending
            </UBadge>
            <UBadge color="error" icon="i-lucide-x" variant="soft">
              Rejected
            </UBadge>
          </KitRow>
        </div>
      </UCard>
    </KitSection>

    <KitSection title="Status pips" description="The verdant heartbeat — a 2px ring + dot for inline state.">
      <UCard variant="outline">
        <div class="flex flex-wrap items-center gap-5">
          <div class="flex items-center gap-2">
            <span class="size-2 rounded-full bg-success animate-pulse" />
            <span class="text-sm">Live</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="size-2 rounded-full bg-warning" />
            <span class="text-sm">Pending</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="size-2 rounded-full bg-error" />
            <span class="text-sm">Failed</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="size-2 rounded-full bg-[var(--ui-border)]" />
            <span class="text-sm text-muted">Unknown</span>
          </div>
        </div>
      </UCard>
    </KitSection>

    <KitSection title="Alerts" code="<UAlert>">
      <div class="space-y-3">
        <UAlert color="success" variant="soft" title="34 pages indexed" description="Google confirmed the batch overnight." icon="i-lucide-check" />
        <UAlert color="warning" variant="soft" title="Quota at 80%" description="You have 30 indexing requests left today." icon="i-lucide-alert-triangle" />
        <UAlert color="error" variant="subtle" title="OAuth disconnected" description="Reconnect your Google account to resume." icon="i-lucide-shield-off">
          <template #actions>
            <UButton size="xs" color="error">
              Reconnect
            </UButton>
          </template>
        </UAlert>
        <UAlert color="info" variant="soft" title="New: bulk submission" description="Submit up to 200 URLs at once." icon="i-lucide-sparkles" />
      </div>
    </KitSection>

    <KitSection title="Progress" code="UiProgressCircle / UProgress">
      <UCard variant="outline">
        <div class="space-y-6">
          <KitRow label="UiProgressCircle">
            <UiProgressCircle :percent="22" />
            <UiProgressCircle :percent="54" />
            <UiProgressCircle :percent="88" />
            <UiProgressCircle :percent="100" :size="48" :stroke-size="5" />
            <UiProgressCircle :percent="68" lighter />
          </KitRow>
          <KitRow label="UProgress · linear">
            <div class="w-full max-w-md space-y-3">
              <UProgress :model-value="32" />
              <UProgress :model-value="68" color="success" />
              <UProgress :model-value="84" color="warning" size="sm" />
              <UProgress :model-value="null" />
            </div>
          </KitRow>
        </div>
      </UCard>
    </KitSection>

    <KitSection title="Toasts" code="useToast().add()">
      <UCard variant="outline">
        <div class="flex flex-wrap gap-2">
          <UButton color="success" variant="soft" @click="fire('success')">
            Success
          </UButton>
          <UButton color="warning" variant="soft" @click="fire('warning')">
            Warning
          </UButton>
          <UButton color="error" variant="soft" @click="fire('error')">
            Error
          </UButton>
          <UButton color="info" variant="soft" @click="fire('info')">
            Info
          </UButton>
        </div>
      </UCard>
    </KitSection>

    <KitSection title="Skeletons" code="<USkeleton>">
      <UCard variant="outline">
        <div class="space-y-2 max-w-md">
          <USkeleton class="h-6 w-3/4" />
          <USkeleton class="h-4 w-full" />
          <USkeleton class="h-4 w-5/6" />
          <USkeleton class="h-4 w-2/3" />
        </div>
      </UCard>
    </KitSection>
  </div>
</template>
