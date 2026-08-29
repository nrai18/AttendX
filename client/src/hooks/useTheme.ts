import { useEffect } from "react";
import { useThemeStore, applyThemeToDOM } from "../stores/themeStore";
import { useAuthStore } from "../stores/authStore";

export function useTheme() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (user?.theme && !localStorage.getItem("app_theme")) {
      setTheme(user.theme as any);
    }
  }, [user?.theme, setTheme]);

  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  return { theme, setTheme };
}

