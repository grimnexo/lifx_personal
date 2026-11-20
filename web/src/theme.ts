export type ThemeMode = 'auto' | 'light' | 'dark';

const systemDark = matchMedia('(prefers-color-scheme: dark)');

export function getThemeMode(): ThemeMode {
  try {
    const m = localStorage.getItem('themeMode');
    return m === 'light' || m === 'dark' ? m : 'auto';
  } catch {
    return 'auto';
  }
}

export function effectiveTheme(): 'light' | 'dark' {
  const m = getThemeMode();
  return m === 'auto' ? (systemDark.matches ? 'dark' : 'light') : m;
}

export function applyTheme() {
  document.documentElement.dataset.theme = effectiveTheme();
}

export function setThemeMode(m: ThemeMode) {
  try {
    if (m === 'auto') localStorage.removeItem('themeMode');
    else localStorage.setItem('themeMode', m);
  } catch {
    /* storage unavailable: theme still applies for this page view */
  }
  applyTheme();
}

systemDark.addEventListener('change', applyTheme);
