<script setup lang="ts">
const {
  title = '',
  description = '',
  readTime = '',
  publishedAt = '',
  author = 'Harlan Wilton',
} = defineProps<{
  title?: string
  description?: string
  readTime?: string
  publishedAt?: string
  author?: string
}>()

const publishedLabel = formatGuideDate(publishedAt)
</script>

<template>
  <OgLayout>
    <div style="margin-bottom: 40px;">
      <OgBrand :size="56" wordmark />
    </div>

    <div class="flex-1 flex flex-col justify-center" style="gap: 24px; max-width: 1040px;">
      <div class="flex items-center" style="gap: 12px;">
        <div style="width: 32px; height: 3px; background-color: #10b981; border-radius: 9999px;" />
        <div
          class="font-title"
          style="font-size: 22px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: #10b981;"
        >
          Guide
        </div>
      </div>

      <div
        v-if="title"
        class="font-title font-bold"
        style="font-size: 72px; line-height: 1.05; letter-spacing: -0.03em; color: #1c1f0e;"
      >
        {{ title }}
      </div>

      <div
        v-if="description"
        style="font-size: 28px; line-height: 1.4; color: #6b6e54;"
      >
        {{ description }}
      </div>
    </div>

    <div class="flex items-center" style="gap: 24px; margin-top: 32px; font-size: 22px; color: #6b6e54;">
      <div class="flex items-center" style="gap: 10px;">
        <img
          src="https://avatars.githubusercontent.com/u/5326365?v=4"
          alt=""
          style="width: 40px; height: 40px; border-radius: 9999px;"
        >
        <span style="color: #1c1f0e; font-weight: 600;">{{ author }}</span>
      </div>

      <div v-if="readTime" class="flex items-center" style="gap: 8px;">
        <div style="width: 6px; height: 6px; border-radius: 9999px; background-color: #e6e7d2;" />
        <span>{{ readTime }} read</span>
      </div>

      <div v-if="publishedLabel" class="flex items-center" style="gap: 8px;">
        <div style="width: 6px; height: 6px; border-radius: 9999px; background-color: #e6e7d2;" />
        <span>{{ publishedLabel }}</span>
      </div>
    </div>
  </OgLayout>
</template>
