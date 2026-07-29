import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";

let isRefreshing = false;
let refreshPromise: Promise<any> | null = null;

export function useSilentRefresh() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);
  const setLoading = useAuthStore((state) => state.setLoading);
  const hasAttempted = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function attemptRefresh() {
      if (hasAttempted.current) return;
      hasAttempted.current = true;

      try {
        if (!refreshPromise) {
          isRefreshing = true;
          // Attempt silent refresh on app launch (using httpOnly cookie)
          refreshPromise = api.post("/auth/refresh");
        }
        
        const refreshRes = await refreshPromise;
        const { accessToken } = refreshRes.data;

        // Fetch current user details with the new access token
        const userRes = await api.get("/users/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (isMounted) {
          setAuth(userRes.data, accessToken);
        }
      } catch (error) {
        if (isMounted) {
          logout();
        }
      } finally {
        isRefreshing = false;
        refreshPromise = null;
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    attemptRefresh();

    return () => {
      isMounted = false;
    };
  }, [setAuth, logout, setLoading]);
}
