export type ThemeMode = 'auto' | 'light' | 'dark';
export const ACCENTS = ['blue', 'teal', 'violet', 'amber', 'rose'] as const;
export type Accent = (typeof ACCENTS)[number];

const systemDark = matchMedia('(prefers-color-scheme: dark)');

export function getThemeMode(): ThemeMode {
  try {
    const m = localStorage.getItem('themeMode');
    return m === 'light' || m === 'dark' ? m : 'auto';
  } catch {
    return 'auto';
  }
}

export function getAccent(): Accent {
  try {
    const a = localStorage.getItem('accent');
    return (ACCENTS as readonly string[]).includes(a ?? '') ? (a as Accent) : 'blue';
  } catch {
    return 'blue';
  }
}

export function effectiveTheme(): 'light' | 'dark' {
  const m = getThemeMode();
  return m === 'auto' ? (systemDark.matches ? 'dark' : 'light') : m;
}

export function applyTheme() {
  document.documentElement.dataset.theme = effectiveTheme();
  document.documentElement.dataset.accent = getAccent();
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

export function setAccent(a: Accent) {
  try {
    localStorage.setItem('accent', a);
  } catch {
    /* storage unavailable: accent still applies for this page view */
  }
  applyTheme();
}

systemDark.addEventListener('change', applyTheme);
