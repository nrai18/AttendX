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

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyThemeToDOM("system");
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  return { theme, setTheme };
}

