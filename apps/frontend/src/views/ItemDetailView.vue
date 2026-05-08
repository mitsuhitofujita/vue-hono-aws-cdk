<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiError, fetchItem, type Item } from "../lib/api";

const route = useRoute();
const router = useRouter();

const item = ref<Item | null>(null);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);
const notFound = ref(false);

const now = new Date();
const refYear = now.getFullYear();
const refMonth = now.getMonth() + 1;

function formatYearMonth(year: number, month: number): string {
  return `${year}.${String(month).padStart(2, "0")}`;
}

function formatYen(n: number): string {
  return `¥${n.toLocaleString("en-US")}`;
}

function monthsInOperation(
  purchaseYear: number,
  purchaseMonth: number,
): number {
  const diff =
    (refYear - purchaseYear) * 12 + (refMonth - purchaseMonth) + 1;
  return diff < 1 ? 1 : diff;
}

const months = computed(() =>
  item.value
    ? monthsInOperation(item.value.purchaseYear, item.value.purchaseMonth)
    : 0,
);

const costPerMonth = computed(() =>
  item.value ? Math.floor(item.value.purchasePrice / months.value) : 0,
);

onMounted(async () => {
  const itemId = Array.isArray(route.params.itemId)
    ? route.params.itemId[0]
    : route.params.itemId;
  if (!itemId) {
    notFound.value = true;
    isLoading.value = false;
    return;
  }
  try {
    item.value = await fetchItem(itemId);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      void router.replace({ name: "home" });
      return;
    }
    if (e instanceof ApiError && e.status === 404) {
      notFound.value = true;
      return;
    }
    errorMessage.value =
      e instanceof Error ? e.message : "Failed to load item";
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
          Item Detail
        </h1>
      </div>

      <div
        v-if="isLoading"
        class="border-t border-b border-stone-200 bg-white"
      >
        <div class="px-4 py-4 text-sm text-stone-400">Loading...</div>
      </div>

      <div
        v-else-if="notFound"
        role="alert"
        class="border-t border-b border-stone-200 bg-white px-4 py-4 text-sm text-stone-600"
      >
        Item not found.
      </div>

      <div
        v-else-if="errorMessage"
        role="alert"
        class="border border-stone-200 bg-white px-4 py-4 text-sm text-stone-600"
      >
        {{ errorMessage }}
      </div>

      <template v-else-if="item">
        <div class="bg-white border-t border-b border-stone-200 px-4 py-4">
          <p
            class="font-logo text-xs tracking-wider text-stone-400 uppercase mb-1"
          >
            Name
          </p>
          <p class="text-base text-stone-800 font-medium">{{ item.name }}</p>
        </div>

        <dl
          class="mt-6 bg-white border-t border-b border-stone-200 divide-y divide-stone-100"
        >
          <div class="flex items-baseline justify-between px-4 py-4">
            <dt
              class="font-logo text-xs tracking-wider text-stone-400 uppercase"
            >
              Purchase Price
            </dt>
            <dd class="font-logo text-sm text-stone-800 tracking-wider">
              {{ formatYen(item.purchasePrice) }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between px-4 py-4">
            <dt
              class="font-logo text-xs tracking-wider text-stone-400 uppercase"
            >
              Purchase Date
            </dt>
            <dd class="font-logo text-sm text-stone-800 tracking-wider">
              {{ formatYearMonth(item.purchaseYear, item.purchaseMonth) }}
            </dd>
          </div>
        </dl>

        <div class="mt-6 border-2 border-primary-700 bg-primary-50 px-4 py-5">
          <p
            class="font-logo text-xs tracking-wider text-primary-700 uppercase mb-2 text-center"
          >
            Cost per Month
          </p>
          <p
            class="font-logo text-3xl text-primary-800 tracking-wider text-center"
          >
            {{ formatYen(costPerMonth) }}
          </p>
          <p
            class="font-logo text-xs tracking-wider text-primary-600 uppercase mt-2 text-center"
          >
            {{ formatYearMonth(refYear, refMonth) }} / Month {{ months }}
          </p>
        </div>

        <div class="mt-6 flex justify-end">
          <button
            type="button"
            disabled
            class="inline-flex items-center gap-2 border border-primary-700 bg-primary-600 text-white px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <span class="font-logo text-xs tracking-widest uppercase">Edit</span>
          </button>
        </div>
      </template>
    </div>
  </main>
</template>
