<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { ApiError, createItem } from "../lib/api";

const router = useRouter();

const today = new Date();
const defaultMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

const name = ref("");
const purchaseDate = ref(defaultMonth);
const purchasePrice = ref<number | null>(null);

const isSubmitting = ref(false);
const errorMessage = ref<string | null>(null);

function parseYearMonth(value: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;
  if (month < 1 || month > 12) return null;
  return { year, month };
}

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

  isSubmitting.value = true;
  try {
    await createItem({
      name: trimmed,
      purchaseYear: ym.year,
      purchaseMonth: ym.month,
      purchasePrice: price,
    });
    void router.push({ name: "items" });
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      void router.replace({ name: "home" });
      return;
    }
    errorMessage.value = e instanceof Error ? e.message : "Failed to create item";
  } finally {
    isSubmitting.value = false;
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
          Item Create
        </h1>
      </div>

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

        <div class="mt-6 bg-white border-t border-b border-stone-200 px-4 py-4">
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

        <div class="mt-6 bg-white border-t border-b border-stone-200 px-4 py-4">
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
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="square"
                stroke-linejoin="miter"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span class="font-logo text-xs tracking-widest uppercase">Apply</span>
          </button>
        </div>
      </form>
    </div>
  </main>
</template>
