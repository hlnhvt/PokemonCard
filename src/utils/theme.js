// Colour themes. The palette lives in CSS variables (src/index.css) selected by
// <html data-theme="...">; the choice is remembered per device in localStorage.
export const THEMES = [
  { id: 'dark', label: 'Tối', metaColor: '#0f172a' },
  { id: 'light', label: 'Sáng', metaColor: '#f8fbff' },
  { id: 'ocean', label: 'Xanh biển', metaColor: '#2563eb' },
  { id: 'pokedex', label: 'Pokédex', metaColor: '#b91c1c' },
];

const STORAGE_KEY = 'pokescan_theme';

export function isTheme(id) {
  return THEMES.some((t) => t.id === id);
}

export function getInitialTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isTheme(saved)) return saved;
  } catch {
    // storage blocked (private mode): fall back to the default
  }
  return 'dark';
}

export function nextTheme(id) {
  const index = THEMES.findIndex((t) => t.id === id);
  return THEMES[(index + 1) % THEMES.length].id;
}

export function applyTheme(id) {
  const theme = THEMES.find((t) => t.id === id) || THEMES[0];
  const root = document.documentElement;
  root.dataset.theme = theme.id;
  root.classList.toggle('dark', theme.id !== 'light');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.metaColor);
  try {
    localStorage.setItem(STORAGE_KEY, theme.id);
  } catch {
    // not persisted; the theme still applies for this visit
  }
  return theme.id;
}
