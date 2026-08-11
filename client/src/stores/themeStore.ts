import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
}

const getInitialTheme = (): ThemeMode => {
  const saved = localStorage.getItem("app_theme") as ThemeMode;
  if (saved === "light" || saved === "dark" || saved === "system") {
    return saved;
  }
  return "dark";
};

export const applyThemeToDOM = (targetTheme: ThemeMode) => {
  const root = document.documentElement;
  let isDark = targetTheme === "dark";

  if (targetTheme === "system") {
    isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  }

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

  setTheme: (theme: ThemeMode) => {
    localStorage.setItem("app_theme", theme);
    set({ theme });
    applyThemeToDOM(theme);
  },

  toggleTheme: () => {
    const current = get().theme;
    let next: ThemeMode = "light";
    if (current === "light") next = "dark";
    else if (current === "dark") next = "light";
    else next = "light";

    get().setTheme(next);
  },
}));
