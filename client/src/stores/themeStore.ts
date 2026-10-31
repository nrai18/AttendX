import { create } from "zustand";
import { flushSync } from "react-dom";
import { triggerDynamicHUD } from "../components/ui/dynamic-island-hud";

export type ThemeMode = "light" | "dark";

interface ThemeState {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode, event?: any, suppressHUD?: boolean) => void;
  toggleTheme: (event?: any) => void;
}

const getInitialTheme = (): ThemeMode => {
  const saved = localStorage.getItem("app_theme");
  if (saved === "light" || saved === "dark") {
    return saved;
  }
  return "dark"; // Default to dark if empty or 'system' was saved previously
};

export const applyThemeToDOM = (targetTheme: ThemeMode, withTransition: boolean = false) => {
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

  if (withTransition) {
    root.classList.add("theme-transitioning");
    setTimeout(() => {
      root.classList.remove("theme-transitioning");
    }, 280);
  }
};

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),

  setTheme: (theme: string, event?: any, suppressHUD?: boolean) => {
    const validTheme = theme === "light" ? "light" : "dark";
    const currentTheme = get().theme;
    if (validTheme === currentTheme) return;

    localStorage.setItem("app_theme", validTheme);

    // Dynamic Island HUD pill notification for switching modes
    if (!suppressHUD) {
      triggerDynamicHUD({
        type: validTheme === "dark" ? "moon" : "sun",
        label: validTheme === "dark" ? "Dark Mode" : "Light Mode",
        durationMs: 2200,
      });
    }

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Hardware-accelerated View Transitions API (Chrome, Edge, Android WebView, Safari 18+)
    if (
      typeof document !== "undefined" &&
      "startViewTransition" in document &&
      !prefersReducedMotion
    ) {
      const root = document.documentElement;
      let clientX: number | undefined;
      let clientY: number | undefined;

      if (event) {
        if (
          typeof event.clientX === "number" &&
          typeof event.clientY === "number" &&
          (event.clientX !== 0 || event.clientY !== 0)
        ) {
          clientX = event.clientX;
          clientY = event.clientY;
        } else if (event.touches && event.touches[0]) {
          clientX = event.touches[0].clientX;
          clientY = event.touches[0].clientY;
        } else if (
          event.currentTarget &&
          typeof event.currentTarget.getBoundingClientRect === "function"
        ) {
          const rect = event.currentTarget.getBoundingClientRect();
          clientX = rect.left + rect.width / 2;
          clientY = rect.top + rect.height / 2;
        }
      }

      const hasCoordinates = clientX !== undefined && clientY !== undefined;

      if (hasCoordinates) {
        root.classList.add("theme-ripple-active");
      }

      const transition = (document as any).startViewTransition(() => {
        flushSync(() => {
          set({ theme: validTheme });
          applyThemeToDOM(validTheme, false);
        });
      });

      if (hasCoordinates && transition.ready) {
        const x = clientX!;
        const y = clientY!;
        const endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );

        transition.ready
          .then(() => {
            document.documentElement.animate(
              {
                clipPath: [
                  `circle(0px at ${x}px ${y}px)`,
                  `circle(${endRadius}px at ${x}px ${y}px)`,
                ],
              },
              {
                duration: 380,
                easing: "cubic-bezier(0.16, 1, 0.3, 1)",
                pseudoElement: "::view-transition-new(root)",
              }
            );
          })
          .catch(() => {});
      }

      if (transition.finished) {
        transition.finished
          .finally(() => {
            root.classList.remove("theme-ripple-active");
          })
          .catch(() => {});
      }
      return;
    }

    // High-performance CSS transition fallback for older runtimes
    set({ theme: validTheme });
    applyThemeToDOM(validTheme, true);
  },

  toggleTheme: (event?: any) => {
    const current = get().theme;
    get().setTheme(current === "light" ? "dark" : "light", event);
  },
}));

if (typeof document !== "undefined") {
  applyThemeToDOM(getInitialTheme(), false);
}
