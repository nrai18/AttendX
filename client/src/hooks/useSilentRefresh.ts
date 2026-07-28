import { useEffect } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";

export function useSilentRefresh() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const logout = useAuthStore((state) => state.logout);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    let isMounted = true;

    async function attemptRefresh() {
      try {
        // Attempt silent refresh on app launch (using httpOnly cookie)
        const refreshRes = await api.post("/auth/refresh");
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
