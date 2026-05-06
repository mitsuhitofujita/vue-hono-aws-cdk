<script setup lang="ts">
import { useRoute } from "vue-router";
import AppHeader from "./components/AppHeader.vue";
import AppFooter from "./components/AppFooter.vue";

const route = useRoute();
</script>

<template>
  <AppHeader v-if="route.meta.showAppHeader" />
  <RouterView />
  <AppFooter />
</template>
