<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ApiError, fetchItem, type Item } from "../lib/api";

const route = useRoute();
const router = useRouter();

const item = ref<Item | null>(null);
const isLoading = ref(true);
const errorMessage = ref<string | null>(null);

function formatYearMonth(year: number, month: number): string {
  return `${year}.${String(month).padStart(2, "0")}`;
}

function formatYen(n: number): string {
  return `¥${n.toLocaleString("en-US")}`;
}

function monthsInOperation(
  purchaseYear: number,
  purchaseMonth: number,
  refYear: number,
  refMonth: number,
): number {
  const diff = (refYear - purchaseYear) * 12 + (refMonth - purchaseMonth) + 1;
  return diff < 1 ? 1 : diff;
}

const isDisposed = computed(() => !!(item.value?.disposalYear && item.value?.disposalMonth));

const referenceDate = computed(() => {
  if (item.value && item.value.disposalYear && item.value.disposalMonth) {
    return { year: item.value.disposalYear, month: item.value.disposalMonth };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
});

const months = computed(() =>
  item.value
    ? monthsInOperation(
        item.value.purchaseYear,
        item.value.purchaseMonth,
        referenceDate.value.year,
        referenceDate.value.month,
      )
    : 0,
);

const costPerMonth = computed(() =>
  item.value ? Math.floor(item.value.purchasePrice / months.value) : 0,
);

onMounted(async () => {
  const itemId = Array.isArray(route.params.itemId) ? route.params.itemId[0] : route.params.itemId;
  if (!itemId) {
    void router.replace({ name: "not-found" });
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
      void router.replace({ name: "not-found" });
      return;
    }
    errorMessage.value = e instanceof Error ? e.message : "Failed to load item";
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

      <div v-if="isLoading" class="border-t border-b border-stone-200 bg-white">
        <div class="px-4 py-4 text-sm text-stone-400">Loading...</div>
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
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="font-logo text-xs tracking-wider text-stone-400 uppercase mb-1">Name</p>
              <p
                class="text-base font-medium truncate"
                :class="isDisposed ? 'text-stone-500' : 'text-stone-800'"
              >
                {{ item.name }}
              </p>
            </div>
            <span
              v-if="isDisposed"
              class="font-logo text-[10px] tracking-widest uppercase text-stone-500 border border-stone-300 px-1.5 py-0.5 leading-none whitespace-nowrap"
              >Disposed</span
            >
          </div>
        </div>

        <dl class="mt-6 bg-white border-t border-b border-stone-200 divide-y divide-stone-100">
          <div class="flex items-baseline justify-between px-4 py-4">
            <dt class="font-logo text-xs tracking-wider text-stone-400 uppercase">
              Purchase Price
            </dt>
            <dd class="font-logo text-sm text-stone-800 tracking-wider">
              {{ formatYen(item.purchasePrice) }}
            </dd>
          </div>
          <div class="flex items-baseline justify-between px-4 py-4">
            <dt class="font-logo text-xs tracking-wider text-stone-400 uppercase">Purchase Date</dt>
            <dd class="font-logo text-sm text-stone-800 tracking-wider">
              {{ formatYearMonth(item.purchaseYear, item.purchaseMonth) }}
            </dd>
          </div>
          <div
            v-if="isDisposed && item.disposalYear && item.disposalMonth"
            class="flex items-baseline justify-between px-4 py-4"
          >
            <dt class="font-logo text-xs tracking-wider text-stone-400 uppercase">Disposal Date</dt>
            <dd class="font-logo text-sm text-stone-800 tracking-wider">
              {{ formatYearMonth(item.disposalYear, item.disposalMonth) }}
            </dd>
          </div>
        </dl>

        <div
          class="mt-6 border-2 px-4 py-5"
          :class="isDisposed ? 'border-stone-400 bg-stone-100' : 'border-primary-700 bg-primary-50'"
        >
          <div class="flex items-center justify-center gap-2 mb-2">
            <p
              class="font-logo text-xs tracking-wider uppercase"
              :class="isDisposed ? 'text-stone-500' : 'text-primary-700'"
            >
              Cost per Month
            </p>
            <span
              v-if="isDisposed"
              class="font-logo text-[10px] tracking-widest uppercase text-stone-500 border border-stone-400 px-1.5 py-0.5 leading-none whitespace-nowrap"
              >Final</span
            >
          </div>
          <p
            class="font-logo text-3xl tracking-wider text-center"
            :class="isDisposed ? 'text-stone-600' : 'text-primary-800'"
          >
            {{ formatYen(costPerMonth) }}
          </p>
          <p
            class="font-logo text-xs tracking-wider uppercase mt-2 text-center"
            :class="isDisposed ? 'text-stone-500' : 'text-primary-600'"
          >
            {{ formatYearMonth(referenceDate.year, referenceDate.month) }} / Month {{ months
            }}{{ isDisposed ? " (disposed)" : "" }}
          </p>
        </div>

        <div class="mt-6 flex justify-end">
          <RouterLink
            :to="{ name: 'items-edit', params: { itemId: item.itemId } }"
            class="inline-flex items-center gap-2 border border-primary-700 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="square"
                stroke-linejoin="miter"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <span class="font-logo text-xs tracking-widest uppercase">Edit</span>
          </RouterLink>
        </div>
      </template>
    </div>
  </main>
</template>
