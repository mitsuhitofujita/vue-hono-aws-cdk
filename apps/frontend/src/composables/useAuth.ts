import { computed, ref } from "vue";
import {
  fetchAuthSession,
  signInWithRedirect,
  signOut as amplifySignOut,
} from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";

export interface AuthUser {
  displayName: string;
  picture?: string;
}

const user = ref<AuthUser | null>(null);
const isLoading = ref(true);

async function refreshUser(): Promise<void> {
  try {
    const { tokens } = await fetchAuthSession();
    const payload = tokens?.idToken?.payload;
    if (!payload) {
      user.value = null;
      return;
    }
    const name = typeof payload.name === "string" ? payload.name : undefined;
    const email = typeof payload.email === "string" ? payload.email : undefined;
    const picture =
      typeof payload.picture === "string" ? payload.picture : undefined;
    user.value = {
      displayName: name ?? email ?? "",
      picture,
    };
  } catch {
    user.value = null;
  } finally {
    isLoading.value = false;
  }
}

let initialized = false;
function initAuth(): void {
  if (initialized) return;
  initialized = true;

  Hub.listen("auth", ({ payload }) => {
    switch (payload.event) {
      case "signedIn":
      case "signInWithRedirect":
      case "tokenRefresh":
        void refreshUser();
        break;
      case "signedOut":
        user.value = null;
        isLoading.value = false;
        break;
      case "signInWithRedirect_failure":
      case "tokenRefresh_failure":
        user.value = null;
        isLoading.value = false;
        break;
    }
  });

  void refreshUser();
}

export function useAuth() {
  initAuth();

  return {
    user,
    isAuthenticated: computed(() => user.value !== null),
    isLoading,
    signInWithGoogle: () => signInWithRedirect({ provider: "Google" }),
    signOut: () => amplifySignOut(),
  };
}
