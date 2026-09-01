export const THEME_KEY = 'mingldingl_control_theme';
export type Theme = 'light' | 'dark';

const listeners = new Set<(theme: Theme) => void>();

export function getStoredTheme(): Theme {
  return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
}

function paint(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  listeners.forEach((fn) => fn(theme));
}

export function applyTheme(theme: Theme): void {
  paint(theme);
  localStorage.setItem(THEME_KEY, theme);
}

/** Reflect a theme another tab already persisted — repaints without writing back. */
export function syncTheme(theme: Theme): void {
  paint(theme);
}

export function subscribeTheme(fn: (theme: Theme) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
