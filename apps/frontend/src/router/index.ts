import { watch } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import { useAuth } from "../composables/useAuth";

const HomeView = () => import("../views/HomeView.vue");
const ItemsView = () => import("../views/ItemsView.vue");
const ItemCreateView = () => import("../views/ItemCreateView.vue");
const ItemDetailView = () => import("../views/ItemDetailView.vue");
const ItemEditView = () => import("../views/ItemEditView.vue");
const NotFoundView = () => import("../views/NotFoundView.vue");

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      name: "home",
      component: HomeView,
      meta: { requiresAuth: false, showAppHeader: false },
    },
    {
      path: "/items",
      name: "items",
      component: ItemsView,
      meta: { requiresAuth: true, showAppHeader: true },
    },
    {
      path: "/items/create",
      name: "items-create",
      component: ItemCreateView,
      meta: { requiresAuth: true, showAppHeader: true },
    },
    {
      path: "/items/:itemId",
      name: "items-detail",
      component: ItemDetailView,
      meta: { requiresAuth: true, showAppHeader: true },
    },
    {
      path: "/items/:itemId/edit",
      name: "items-edit",
      component: ItemEditView,
      meta: { requiresAuth: true, showAppHeader: true },
    },
    {
      path: "/:pathMatch(.*)*",
      name: "not-found",
      component: NotFoundView,
      meta: { requiresAuth: false, showAppHeader: true },
    },
  ],
});

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true;

  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading.value) {
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        stop();
        resolve();
      }, 3000);
      const stop = watch(isLoading, (loading) => {
        if (!loading) {
          clearTimeout(timeout);
          stop();
          resolve();
        }
      });
    });
  }

  return isAuthenticated.value ? true : { name: "home" };
});

export default router;
