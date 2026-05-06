<script setup lang="ts">
import { useAuth } from "../composables/useAuth";

const { user } = useAuth();
</script>

<template>
  <header class="border-b border-stone-200 bg-white">
    <div class="max-w-sm mx-auto px-4 py-3 flex items-center justify-between">
      <div class="border border-primary-700 px-3 py-1">
        <span
          class="font-logo font-medium text-base tracking-widest text-primary-800 uppercase"
          >tocoop</span
        >
      </div>
      <RouterLink
        to="/"
        aria-label="Back to home"
        class="w-9 h-9 rounded-full overflow-hidden border border-stone-200 hover:border-primary-400 transition-colors flex items-center justify-center bg-primary-100"
      >
        <img
          v-if="user?.picture"
          :src="user.picture"
          :alt="user.displayName"
          class="w-full h-full object-cover"
          referrerpolicy="no-referrer"
        />
        <svg
          v-else
          class="w-5 h-5 text-primary-500"
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
          />
        </svg>
      </RouterLink>
    </div>
  </header>
</template>
