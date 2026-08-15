import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";
import { api } from "../lib/api";

export function useSilentRefresh() {
  const setLoading = useAuthStore((state) => state.setLoading);
  const setUser = useAuthStore((state) => state.setUser);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    let isMounted = true;

    const syncUserProfile = async () => {
      if (!isAuthenticated) {
        setLoading(false);
        return;
      }

      try {
        const res = await api.get("/users/me");
        if (isMounted && res.data) {
          const currentUser = useAuthStore.getState().user;
          setUser({
            ...currentUser,
            ...res.data,
            targetAttendance: res.data.targetAttendance ?? currentUser?.targetAttendance ?? 75,
          });
        }
      } catch (err) {
        // Dev user or offline fallback
        console.warn("Silent profile sync skipped or unauthenticated:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    syncUserProfile();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, setLoading, setUser]);
}

