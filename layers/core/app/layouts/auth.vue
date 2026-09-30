<script setup lang="ts">
// Sign-in and sign-up are the dashboard's front door, so they take its theme,
// as nuxtseo.com's `pro-auth` layout does.
useHead({
  htmlAttrs: {
    class: 'dashboard-theme',
  },
  bodyAttrs: {
    class: 'dark:bg-gray-950',
  },
})
</script>

<template>
  <div class="min-h-screen px-4 py-14 flex items-center justify-center overlay">
    <Gradient />

    <UButton icon="i-heroicons-home" label="Home" to="/" color="neutral" class="absolute top-4" />

    <!-- The column used to be an unconstrained `div`, so at phone width the
         heading and buttons sat flush against both screen edges. -->
    <div class="w-full max-w-md">
      <slot />
    </div>
  </div>
</template>
