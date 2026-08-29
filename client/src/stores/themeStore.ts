import { create } from "zustand";

export type ThemeMode = "light" | "dark";

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const getInitialTheme = (): ThemeMode => {
  const saved = localStorage.getItem("app_theme");
  if (saved === "light" || saved === "dark") {
    return saved;
  }
  return "dark"; // Default to dark if empty or 'system' was saved previously
};

export const applyThemeToDOM = (targetTheme: ThemeMode) => {
  const root = document.documentElement;
  const isDark = targetTheme === "dark";

  if (isDark) {
    root.classList.remove("light");
    root.classList.add("dark");
    root.style.colorScheme = "dark";
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
    root.style.colorScheme = "light";
  }
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),

  setTheme: (theme: string) => {
    const validTheme = theme === "light" ? "light" : "dark";
    localStorage.setItem("app_theme", validTheme);
    set({ theme: validTheme });
    applyThemeToDOM(validTheme);
  },

  toggleTheme: () => {
    const current = get().theme;
    get().setTheme(current === "light" ? "dark" : "light");
  },
}));
