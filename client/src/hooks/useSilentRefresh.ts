import { useEffect } from "react";
import { useAuthStore } from "../stores/authStore";

export function useSilentRefresh() {
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    setLoading(false);
  }, [setLoading]);
}
