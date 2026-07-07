export type ThemeMode = "light" | "dark";

export interface AppTheme {
  id: string;
  name: string;
  mode: ThemeMode;
  accent: string;
  popular?: boolean;
}

const THEME_STORAGE_KEY = "bikapi:theme";
const DEFAULT_THEME_ID = "midnight";

export const APP_THEMES: AppTheme[] = [
  { id: "midnight", name: "Midnight Blue", mode: "dark", accent: "#6ca8ff", popular: true },
  { id: "graphite", name: "Graphite", mode: "dark", accent: "#f59e0b", popular: true },
  { id: "aurora", name: "Aurora", mode: "dark", accent: "#5eead4", popular: true },
  { id: "paper", name: "Paper Stack", mode: "light", accent: "#2563eb", popular: true },
  { id: "nord", name: "Nord Light", mode: "light", accent: "#0f766e", popular: true },
  { id: "matcha", name: "Matcha", mode: "light", accent: "#3f7a36", popular: true },
];

export function resolveTheme(themeId: string | null | undefined): AppTheme {
  return APP_THEMES.find((theme) => theme.id === themeId) ?? APP_THEMES[0];
}

export function loadThemePreference(): string {
  try {
    return resolveTheme(window.localStorage.getItem(THEME_STORAGE_KEY)).id;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

export function saveThemePreference(themeId: string) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, resolveTheme(themeId).id);
  } catch {
    // Storage can be blocked in some environments.
  }
}

export function applyTheme(themeId: string) {
  document.documentElement.dataset.theme = resolveTheme(themeId).id;
}
