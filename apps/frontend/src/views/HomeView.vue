<script setup lang="ts">
import { useAuth } from "../composables/useAuth";

const { user, isAuthenticated, isLoading, signInWithGoogle, signOut } =
  useAuth();
</script>

<template>
  <main class="flex-1 flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <div class="text-center mb-10">
        <div class="inline-block mb-4">
          <div class="border-2 border-primary-700 px-5 py-2">
            <h1
              class="font-logo font-medium text-4xl tracking-widest text-primary-800 uppercase"
            >
              tocoop
            </h1>
          </div>
          <div
            class="border-b-2 border-l-2 border-r-2 border-primary-700 px-3 py-1"
          >
            <p class="font-logo text-xs tracking-wider text-primary-600">
              COST PER MONTH TRACKER
            </p>
          </div>
        </div>
        <p class="text-sm text-stone-500 leading-relaxed mt-4">
          Track the real cost of your purchases.<br />
          See how value grows over time.
        </p>
      </div>

      <div v-if="isLoading" class="h-40" aria-hidden="true"></div>

      <div v-else-if="!isAuthenticated" class="border border-stone-200 bg-white p-6">
        <h2
          class="font-logo text-xs tracking-wider text-stone-400 uppercase mb-6 text-center border-b border-stone-100 pb-3"
        >
          Sign In
        </h2>

        <button
          type="button"
          class="w-full border border-stone-300 hover:border-primary-400 py-2.5 text-sm font-medium text-stone-600 hover:text-primary-700 tracking-wide transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          @click="signInWithGoogle"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Sign in with Google
        </button>
      </div>

      <div v-else class="border border-stone-200 bg-white p-6">
        <h2
          class="font-logo text-xs tracking-wider text-stone-400 uppercase mb-6 text-center border-b border-stone-100 pb-3"
        >
          Account
        </h2>

        <div class="flex justify-center mb-5">
          <div
            class="w-20 h-20 rounded-full bg-primary-100 border-2 border-primary-300 flex items-center justify-center overflow-hidden"
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
              class="w-10 h-10 text-primary-500"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"
              />
            </svg>
          </div>
        </div>

        <div class="space-y-3">
          <div class="border border-stone-100 px-4 py-3">
            <p
              class="text-xs font-medium text-stone-400 uppercase tracking-wide mb-1"
            >
              Display Name
            </p>
            <p class="text-sm text-stone-800 font-medium">
              {{ user?.displayName }}
            </p>
          </div>
        </div>

        <div class="mt-6 pt-4 border-t border-stone-100 space-y-3">
          <RouterLink
            to="/items"
            class="block w-full bg-primary-600 hover:bg-primary-700 text-white py-2.5 text-sm font-medium tracking-wide uppercase transition-colors text-center"
          >
            Items
          </RouterLink>
          <button
            type="button"
            class="w-full border border-stone-300 hover:border-stone-400 py-2.5 text-sm font-medium text-stone-600 hover:text-stone-700 tracking-wide uppercase transition-colors"
            @click="signOut"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
