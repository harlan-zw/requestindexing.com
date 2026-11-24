<script setup lang="ts">
definePageMeta({ layout: 'kit' })
useHead({ title: 'Buttons & Motion · Brand Kit' })
</script>

<template>
  <div class="space-y-8">
    <KitHeader
      eyebrow="Components"
      title="Buttons & motion"
      description="UButton variants from Nuxt UI plus UiMotionButton — spring lift, cursor-tracked spotlight, halo shimmer."
    />

    <KitSection title="Variants" code="<UButton variant>">
      <UCard variant="outline">
        <div class="space-y-5">
          <KitRow label="Solid → ghost">
            <UButton>Solid</UButton>
            <UButton variant="outline">
              Outline
            </UButton>
            <UButton variant="soft">
              Soft
            </UButton>
            <UButton variant="subtle">
              Subtle
            </UButton>
            <UButton variant="ghost">
              Ghost
            </UButton>
            <UButton variant="link">
              Link
            </UButton>
          </KitRow>
          <KitRow label="Colors">
            <UButton color="primary">
              Primary
            </UButton>
            <UButton color="neutral">
              Neutral
            </UButton>
            <UButton color="success">
              Success
            </UButton>
            <UButton color="warning">
              Warning
            </UButton>
            <UButton color="error">
              Error
            </UButton>
            <UButton color="info">
              Info
            </UButton>
          </KitRow>
          <KitRow label="Sizes">
            <UButton size="xs">
              xs
            </UButton>
            <UButton size="sm">
              sm
            </UButton>
            <UButton size="md">
              md
            </UButton>
            <UButton size="lg">
              lg
            </UButton>
            <UButton size="xl">
              xl
            </UButton>
          </KitRow>
          <KitRow label="With icons">
            <UButton icon="i-lucide-zap">
              Index now
            </UButton>
            <UButton trailing-icon="i-lucide-arrow-right" variant="outline">
              Continue
            </UButton>
            <UButton icon="i-lucide-download" variant="soft">
              Export CSV
            </UButton>
            <UButton icon="i-lucide-trash" color="error" variant="ghost">
              Remove
            </UButton>
          </KitRow>
          <KitRow label="States">
            <UButton loading>
              Saving
            </UButton>
            <UButton disabled>
              Disabled
            </UButton>
            <UButton :ui="{ base: 'animate-pulse' }">
              Pulse
            </UButton>
          </KitRow>
          <KitRow label="Block">
            <UButton block class="max-w-sm" icon="i-lucide-check">
              Submit
            </UButton>
          </KitRow>
        </div>
      </UCard>
    </KitSection>

    <KitSection
      title="UiMotionButton"
      code="<UiMotionButton>"
      description="Drop-in UButton replacement with motion-v spring scale, halo, and cursor-anchored spotlight. Honours prefers-reduced-motion."
    >
      <UCard variant="outline">
        <div class="space-y-5">
          <KitRow label="Intensities">
            <UiMotionButton size="lg" icon="i-lucide-sparkles">
              Hover the CTA
            </UiMotionButton>
            <UiMotionButton variant="outline" trailing-icon="i-lucide-arrow-up-right">
              Subtle outline
            </UiMotionButton>
            <UiMotionButton variant="soft" icon="i-lucide-rocket">
              Launch
            </UiMotionButton>
          </KitRow>
          <KitRow label="Sizes">
            <UiMotionButton size="xs">
              Tiny lift
            </UiMotionButton>
            <UiMotionButton size="md">
              Default
            </UiMotionButton>
            <UiMotionButton size="xl" icon="i-lucide-zap">
              Indexer
            </UiMotionButton>
          </KitRow>
        </div>
      </UCard>
    </KitSection>

    <KitSection title="Icon-only" description="Reserve for actions whose icon is unambiguous (close, expand).">
      <UCard variant="outline">
        <div class="flex flex-wrap gap-2">
          <UButton icon="i-lucide-x" color="neutral" variant="ghost" square />
          <UButton icon="i-lucide-search" color="neutral" variant="outline" square />
          <UButton icon="i-lucide-settings" color="neutral" variant="soft" square />
          <UButton icon="i-lucide-plus" square />
          <UButton icon="i-lucide-trash" color="error" variant="ghost" square />
        </div>
      </UCard>
    </KitSection>

    <KitSection title="Button group">
      <UFieldGroup>
        <UButton color="neutral" variant="outline" icon="i-lucide-chevron-left" />
        <UButton color="neutral" variant="outline">
          Page 1 of 12
        </UButton>
        <UButton color="neutral" variant="outline" icon="i-lucide-chevron-right" />
      </UFieldGroup>
    </KitSection>
  </div>
</template>
