<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
  ApiError,
  deleteItem,
  fetchItem,
  updateItem,
  type UpdateItemInput,
} from "../lib/api";

const route = useRoute();
const router = useRouter();

const itemId = ref<string>("");
const name = ref("");
const purchaseDate = ref("");
const purchasePrice = ref<number | null>(null);
const disposalDate = ref("");

const isLoading = ref(true);
const isSubmitting = ref(false);
const isDeleting = ref(false);
const errorMessage = ref<string | null>(null);
const confirmingDelete = ref(false);

function parseYearMonth(
  value: string,
): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function formatYearMonthInput(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

onMounted(async () => {
  const rawId = Array.isArray(route.params.itemId)
    ? route.params.itemId[0]
    : route.params.itemId;
  if (!rawId) {
    void router.replace({ name: "not-found" });
    return;
  }
  itemId.value = rawId;
  try {
    const item = await fetchItem(rawId);
    name.value = item.name;
    purchaseDate.value = formatYearMonthInput(
      item.purchaseYear,
      item.purchaseMonth,
    );
    purchasePrice.value = item.purchasePrice;
    if (item.disposalYear && item.disposalMonth) {
      disposalDate.value = formatYearMonthInput(
        item.disposalYear,
        item.disposalMonth,
      );
    } else {
      disposalDate.value = "";
    }
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      void router.replace({ name: "home" });
      return;
    }
    if (e instanceof ApiError && e.status === 404) {
      void router.replace({ name: "not-found" });
      return;
    }
    errorMessage.value =
      e instanceof Error ? e.message : "Failed to load item";
  } finally {
    isLoading.value = false;
  }
});

async function onSubmit() {
  errorMessage.value = null;

  const trimmed = name.value.trim();
  if (trimmed.length === 0) {
    errorMessage.value = "Name is required";
    return;
  }
  const ym = parseYearMonth(purchaseDate.value);
  if (!ym) {
    errorMessage.value = "Purchase date is required";
    return;
  }
  const price = purchasePrice.value;
  if (price === null || !Number.isInteger(price) || price < 0) {
    errorMessage.value = "Purchase price must be a non-negative integer";
    return;
  }

  const input: UpdateItemInput = {
    name: trimmed,
    purchaseYear: ym.year,
    purchaseMonth: ym.month,
    purchasePrice: price,
  };

  if (disposalDate.value !== "") {
    const dispYm = parseYearMonth(disposalDate.value);
    if (!dispYm) {
      errorMessage.value = "Invalid disposal date";
      return;
    }
    if (
      dispYm.year * 12 + dispYm.month <
      ym.year * 12 + ym.month
    ) {
      errorMessage.value = "Disposal date must be on or after purchase date";
      return;
    }
    input.disposalYear = dispYm.year;
    input.disposalMonth = dispYm.month;
  }

  isSubmitting.value = true;
  try {
    await updateItem(itemId.value, input);
    void router.push({
      name: "items-detail",
      params: { itemId: itemId.value },
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      void router.replace({ name: "home" });
      return;
    }
    if (e instanceof ApiError && e.status === 404) {
      void router.replace({ name: "not-found" });
      return;
    }
    errorMessage.value =
      e instanceof Error ? e.message : "Failed to update item";
  } finally {
    isSubmitting.value = false;
  }
}

function onDeleteClick() {
  errorMessage.value = null;
  confirmingDelete.value = true;
}

function onCancelDelete() {
  confirmingDelete.value = false;
}

async function onConfirmDelete() {
  errorMessage.value = null;
  isDeleting.value = true;
  try {
    await deleteItem(itemId.value);
    void router.push({ name: "items" });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      void router.replace({ name: "home" });
      return;
    }
    if (e instanceof ApiError && e.status === 404) {
      void router.replace({ name: "not-found" });
      return;
    }
    errorMessage.value =
      e instanceof Error ? e.message : "Failed to delete item";
    isDeleting.value = false;
  }
}
</script>

<template>
  <main class="flex-1 px-4 py-8">
    <div class="w-full max-w-sm mx-auto">
      <div class="mb-6">
        <h1
          class="font-logo text-xs tracking-wider text-stone-400 uppercase border-b border-stone-200 pb-2"
        >
          Item Edit
        </h1>
      </div>

      <div
        v-if="isLoading"
        class="border-t border-b border-stone-200 bg-white"
      >
        <div class="px-4 py-4 text-sm text-stone-400">Loading...</div>
      </div>

      <template v-else>
        <form @submit.prevent="onSubmit">
          <div class="bg-white border-t border-b border-stone-200 px-4 py-4">
            <label
              for="item-name"
              class="block font-logo text-xs tracking-wider text-stone-400 uppercase mb-2"
              >Name</label
            >
            <input
              id="item-name"
              v-model="name"
              type="text"
              required
              placeholder="エアコン"
              class="w-full bg-transparent border-0 border-b border-stone-200 focus:border-primary-600 focus:outline-none text-base text-stone-800 font-medium py-1 placeholder:text-stone-300"
            />
          </div>

          <div
            class="mt-6 bg-white border-t border-b border-stone-200 px-4 py-4"
          >
            <label
              for="purchase-price"
              class="block font-logo text-xs tracking-wider text-stone-400 uppercase mb-2"
              >Purchase Price</label
            >
            <div class="flex items-baseline gap-2">
              <span class="font-logo text-base text-stone-500">¥</span>
              <input
                id="purchase-price"
                v-model.number="purchasePrice"
                type="number"
                inputmode="numeric"
                min="0"
                step="1"
                required
                placeholder="100000"
                class="flex-1 bg-transparent border-0 border-b border-stone-200 focus:border-primary-600 focus:outline-none font-logo text-base text-stone-800 tracking-wider py-1 placeholder:text-stone-300 text-right"
              />
            </div>
          </div>

          <div
            class="mt-6 bg-white border-t border-b border-stone-200 px-4 py-4"
          >
            <label
              for="purchase-date"
              class="block font-logo text-xs tracking-wider text-stone-400 uppercase mb-2"
              >Purchase Date</label
            >
            <input
              id="purchase-date"
              v-model="purchaseDate"
              type="month"
              required
              class="w-full bg-transparent border-0 border-b border-stone-200 focus:border-primary-600 focus:outline-none font-logo text-base text-stone-800 tracking-wider py-1"
            />
          </div>

          <div
            class="mt-6 bg-white border-t border-b border-stone-200 px-4 py-4"
          >
            <label
              for="disposal-date"
              class="block font-logo text-xs tracking-wider text-stone-400 uppercase mb-2"
              >Disposal Date</label
            >
            <input
              id="disposal-date"
              v-model="disposalDate"
              type="month"
              class="w-full bg-transparent border-0 border-b border-stone-200 focus:border-primary-600 focus:outline-none font-logo text-base text-stone-800 tracking-wider py-1"
            />
          </div>

          <div
            v-if="errorMessage"
            role="alert"
            class="mt-6 border border-stone-200 bg-white px-4 py-4 text-sm text-stone-600"
          >
            {{ errorMessage }}
          </div>

          <div class="mt-8 flex justify-end">
            <button
              type="submit"
              :disabled="isSubmitting"
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
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span class="font-logo text-xs tracking-widest uppercase"
                >Apply</span
              >
            </button>
          </div>
        </form>

        <div class="mt-12 pt-6 border-t border-stone-200">
          <p
            class="font-logo text-xs tracking-wider text-stone-400 uppercase mb-3"
          >
            Danger Zone
          </p>

          <div v-if="!confirmingDelete" class="flex justify-end">
            <button
              type="button"
              class="inline-flex items-center gap-2 border border-red-700 bg-white hover:bg-red-50 text-red-700 px-4 py-2 transition-colors"
              @click="onDeleteClick"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
                />
              </svg>
              <span class="font-logo text-xs tracking-widest uppercase"
                >Delete</span
              >
            </button>
          </div>

          <div
            v-else
            class="border border-red-300 bg-red-50 px-4 py-4"
          >
            <p class="text-sm text-red-800 mb-4">
              This will permanently delete this item. This action cannot be
              undone.
            </p>
            <div class="flex items-center justify-end gap-3">
              <button
                type="button"
                :disabled="isDeleting"
                class="inline-flex items-center gap-2 border border-stone-300 bg-white hover:bg-stone-100 text-stone-700 px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                @click="onCancelDelete"
              >
                <span class="font-logo text-xs tracking-widest uppercase"
                  >Cancel</span
                >
              </button>
              <button
                type="button"
                :disabled="isDeleting"
                class="inline-flex items-center gap-2 border border-red-700 bg-red-600 hover:bg-red-700 text-white px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                @click="onConfirmDelete"
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
                  />
                </svg>
                <span class="font-logo text-xs tracking-widest uppercase"
                  >Confirm Delete</span
                >
              </button>
            </div>
          </div>
        </div>
      </template>
    </div>
  </main>
</template>
