<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { fetchItems, ApiError, type Item } from "../lib/api";

const items = ref<Item[]>([]);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);
const router = useRouter();

function formatYearMonth(year: number, month: number): string {
  return `${year}.${String(month).padStart(2, "0")}`;
}

onMounted(async () => {
  try {
    items.value = await fetchItems();
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      void router.replace({ name: "home" });
      return;
    }
    errorMessage.value = e instanceof Error ? e.message : "Failed to load items";
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <main class="flex-1 px-4 py-8">
    <div class="w-full max-w-sm mx-auto">
      <div class="mb-6">
        <h1
          class="font-logo text-xs tracking-wider text-stone-400 uppercase border-b border-stone-200 pb-2"
        >
          Items
        </h1>
      </div>

      <div class="mb-6 flex justify-end">
        <button
          type="button"
          disabled
          aria-disabled="true"
          class="inline-flex items-center gap-2 border border-primary-700 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="square"
              stroke-linejoin="miter"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
          <span class="font-logo text-xs tracking-widest uppercase">Add</span>
        </button>
      </div>

      <div
        v-if="isLoading"
        class="border-t border-b border-stone-200 bg-white"
      >
        <div class="px-4 py-4 text-sm text-stone-400">Loading...</div>
      </div>

      <div
        v-else-if="errorMessage"
        role="alert"
        class="border border-stone-200 bg-white px-4 py-4 text-sm text-stone-600"
      >
        {{ errorMessage }}
      </div>

      <ul
        v-else-if="items.length === 0"
        class="border-t border-b border-stone-200 bg-white"
      >
        <li class="px-4 py-4 text-sm text-stone-400">No items yet.</li>
      </ul>

      <ul
        v-else
        class="border-t border-b border-stone-200 divide-y divide-stone-100 bg-white"
      >
        <li v-for="item in items" :key="item.itemId">
          <a
            href="#"
            class="flex items-baseline justify-between px-4 py-4 hover:bg-primary-50 transition-colors"
          >
            <span class="text-sm text-stone-800 font-medium">{{
              item.name
            }}</span>
            <span class="font-logo text-xs text-stone-500 tracking-wider">
              {{ formatYearMonth(item.purchaseYear, item.purchaseMonth) }}
            </span>
          </a>
        </li>
      </ul>

      <div class="mt-8 flex items-center justify-between">
        <button
          type="button"
          disabled
          aria-label="Previous page"
          class="w-10 h-10 rounded-full border border-stone-300 text-stone-500 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="square"
              stroke-linejoin="miter"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <span class="font-logo text-xs tracking-widest text-stone-500"
          >1 / 1</span
        >
        <button
          type="button"
          disabled
          aria-label="Next page"
          class="w-10 h-10 rounded-full border border-stone-300 text-stone-500 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <svg
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="square"
              stroke-linejoin="miter"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </div>
  </main>
</template>
