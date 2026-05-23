<script setup lang="ts">
import { RouterLink } from "vue-router";
</script>

<template>
  <main class="flex-1 px-4 py-8">
    <div class="w-full max-w-sm mx-auto">
      <div class="mb-6">
        <h1
          class="font-logo text-xs tracking-wider text-stone-400 uppercase border-b border-stone-200 pb-2"
        >
          Not Found
        </h1>
      </div>

      <div class="border-t border-b border-stone-200 bg-white px-4 py-6">
        <p class="text-sm text-stone-600 leading-relaxed">
          The page you're looking for doesn't exist or has been removed.
        </p>
      </div>

      <div class="mt-6 flex justify-end">
        <RouterLink
          :to="{ name: 'home' }"
          class="inline-flex items-center gap-2 border border-primary-700 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="square"
              stroke-linejoin="miter"
              stroke-width="2"
              d="M3 12l9-9 9 9M5 10v10h4v-6h6v6h4V10"
            />
          </svg>
          <span class="font-logo text-xs tracking-widest uppercase">Back to home</span>
        </RouterLink>
      </div>
    </div>
  </main>
</template>
