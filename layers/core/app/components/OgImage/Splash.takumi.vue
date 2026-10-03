<script setup lang="ts">
const mockRows = [
  { url: '/blog/getting-started', status: 'Indexed', pass: true },
  { url: '/docs/configuration', status: 'Discovered', pass: false },
  { url: '/guides/seo-best-practices', status: 'Indexed', pass: true },
  { url: '/changelog/v2', status: 'Indexed', pass: true },
]
</script>

<template>
  <OgLayout>
    <div class="flex-1 flex items-center" style="gap: 48px;">
      <div class="flex flex-col" style="gap: 28px; flex: 7;">
        <div style="margin-bottom: 12px;">
          <OgBrand :size="72" wordmark />
        </div>

        <div
          class="font-title font-bold"
          style="font-size: 72px; line-height: 1.05; letter-spacing: -0.03em; color: #1c1f0e;"
        >
          Get your pages indexed.
        </div>

        <div
          style="font-size: 28px; line-height: 1.45; color: #6b6e54; max-width: 640px;"
        >
          Free, open-source tool to request Google indexing and monitor your Search Console data.
        </div>
      </div>

      <div
        class="flex flex-col"
        style="gap: 12px; flex: 5; padding: 28px; border-radius: 20px; background-color: #ffffff; border: 1px solid #e6e7d2; box-shadow: 0 24px 48px -16px rgba(16, 185, 129, 0.18);"
      >
        <div class="flex items-center" style="gap: 8px; padding-bottom: 8px; border-bottom: 1px solid #e6e7d2;">
          <div style="width: 10px; height: 10px; border-radius: 9999px; background-color: #10b981;" />
          <div style="font-size: 15px; font-weight: 600; color: #1c1f0e;">
            Live from Search Console
          </div>
        </div>

        <div
          v-for="row in mockRows"
          :key="row.url"
          class="flex items-center justify-between"
          style="padding: 10px 0; border-bottom: 1px solid #f1f2dc;"
        >
          <div
            class="truncate"
            style="font-family: ui-monospace, monospace; font-size: 17px; color: #1c1f0e; max-width: 280px;"
          >
            {{ row.url }}
          </div>
          <div
            class="flex items-center"
            style="gap: 6px; font-size: 14px; font-weight: 600;"
            :style="{ color: row.pass ? '#10b981' : '#a98b1f' }"
          >
            <div
              style="width: 8px; height: 8px; border-radius: 9999px;"
              :style="{ backgroundColor: row.pass ? '#10b981' : '#f59e0b' }"
            />
            {{ row.status }}
          </div>
        </div>
      </div>
    </div>
  </OgLayout>
</template>
