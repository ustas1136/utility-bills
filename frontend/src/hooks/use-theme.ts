import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "light" | "dark" | "system";

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "system",
      setTheme: (theme) => set({ theme }),
    }),
    { name: "utility-bills-theme" },
  ),
);

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  root.classList.toggle("dark", isDark);
}

export function initTheme() {
  const { theme } = useThemeStore.getState();
  applyTheme(theme);

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      const { theme: current } = useThemeStore.getState();
      if (current === "system") applyTheme("system");
    });

  useThemeStore.subscribe((state) => applyTheme(state.theme));
}