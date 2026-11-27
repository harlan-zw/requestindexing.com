<script setup lang="ts">
const { title = '', description = '', sampleUrl = 'requestindexing.com/guides' } = defineProps<{
  title?: string
  description?: string
  sampleUrl?: string
}>()
</script>

<template>
  <OgLayout>
    <div style="margin-bottom: 40px;">
      <OgBrand :size="56" wordmark />
    </div>

    <div class="flex-1 flex items-center" style="gap: 56px;">
      <div class="flex flex-col" style="gap: 24px; flex: 6;">
        <div class="flex items-center" style="gap: 12px;">
          <div style="width: 32px; height: 3px; background-color: #10b981; border-radius: 9999px;" />
          <div
            class="font-title"
            style="font-size: 22px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #10b981;"
          >
            Free Tool
          </div>
        </div>

        <div
          v-if="title"
          class="font-title font-bold"
          style="font-size: 52px; line-height: 1.08; letter-spacing: -0.03em; color: #1c1f0e;"
        >
          {{ title }}
        </div>

        <div
          v-if="description"
          style="font-size: 22px; line-height: 1.4; color: #6b6e54; overflow: hidden; max-height: 93px;"
        >
          {{ description }}
        </div>
      </div>

      <div
        class="flex flex-col"
        style="gap: 18px; flex: 5; padding: 28px; border-radius: 20px; background-color: #ffffff; border: 1px solid #e6e7d2; box-shadow: 0 24px 48px -16px rgba(16, 185, 129, 0.18);"
      >
        <div
          class="flex items-center"
          style="gap: 10px; padding: 14px 18px; border: 1px solid #e6e7d2; border-radius: 12px; background-color: #f7f7eb;"
        >
          <div
            style="width: 20px; height: 20px; border-radius: 9999px; border: 2px solid #10b981; flex-shrink: 0;"
          />
          <div
            class="truncate"
            style="font-family: ui-monospace, monospace; font-size: 18px; color: #1c1f0e;"
          >
            {{ sampleUrl }}
          </div>
        </div>

        <div
          class="flex items-center justify-between"
          style="padding: 16px 18px; border-radius: 12px; background-color: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25);"
        >
          <div class="flex items-center" style="gap: 10px;">
            <div
              style="width: 10px; height: 10px; border-radius: 9999px; background-color: #10b981;"
            />
            <div style="font-size: 18px; font-weight: 600; color: #1c1f0e;">
              Indexed in Google
            </div>
          </div>
          <div style="font-size: 14px; color: #6b6e54;">
            Example
          </div>
        </div>

        <div style="font-size: 14px; color: #6b6e54;">
          Estimate from a Google site: search · No signup
        </div>
      </div>
    </div>
  </OgLayout>
</template>
