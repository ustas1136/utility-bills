import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Порядок тем для циклического переключения (⌘⇧L, палитра команд). */
export const THEMES = ["light", "comfort", "dark", "system"] as const;

/** Выбор пользователя. `system` разрешается в light/dark по настройке ОС. */
export type Theme = (typeof THEMES)[number];

/** Тема, которая реально попадает в `data-theme`. */
export type ResolvedTheme = Exclude<Theme, "system">;

/**
 * Возвращает следующую тему по кругу: light → comfort → dark → system → light.
 * Если тема неожиданно вне списка, indexOf вернёт -1 и мы начнём с начала.
 */
export function nextTheme(theme: Theme): Theme {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
}

/**
 * Ключ персиста. Продублирован строкой в inline-скрипте index.html —
 * он выполняется до загрузки модулей и не может импортировать эту константу.
 */
export const THEME_STORAGE_KEY = "utility-bills-theme";

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
    { name: THEME_STORAGE_KEY },
  ),
);

const systemTheme = (): ResolvedTheme =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

/**
 * Netvision 2.1 §2: первое открытие учитывает светлую/тёмную тему ОС,
 * тёплая («comfort») включается только явно и по системе не выбирается.
 */
export function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? systemTheme() : theme;
}

/**
 * Единственный источник темы — атрибут `data-theme` на `<html>` (§11).
 * Класс `.dark` больше не ставится: `dark:`-вариант в index.css слушает
 * и `[data-theme="dark"]`, и `.dark` (алиас для обратной совместимости).
 */
export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", resolveTheme(theme));
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
