export const THEMES: { id: string; label: string; primary: string }[] = [
  { id: 'default', label: 'Default', primary: '#4da6ff' },
  { id: 'purple', label: 'Cosmic Purple', primary: '#a855f7' },
  { id: 'red', label: 'Ember Red', primary: '#f56565' },
  { id: 'green', label: 'Forest Green', primary: '#48bb78' },
  { id: 'orange', label: 'Sunset Orange', primary: '#ed8936' },
  { id: 'pink', label: 'Neon Pink', primary: '#ed64a6' },
  { id: 'teal', label: 'Ocean Teal', primary: '#38b2ac' },
];

function hexToRgb(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  const bigint = parseInt(v, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function darken(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = 1 - amt;
  return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
}

export const themeStore = {
  get: (): string => {
    try { return localStorage.getItem('palace_theme') || 'default'; } catch { return 'default'; }
  },
  set: (id: string) => {
    localStorage.setItem('palace_theme', id);
    themeStore.apply(id);
  },
  apply: (id: string) => {
    const t = THEMES.find(x => x.id === id) ?? THEMES[0];
    const [r, g, b] = hexToRgb(t.primary);
    const root = document.documentElement;

    root.style.setProperty('--t-primary', t.primary);
    root.style.setProperty('--t-glow', t.primary);
    root.style.setProperty('--t-r', String(r));
    root.style.setProperty('--t-g', String(g));
    root.style.setProperty('--t-b', String(b));

    // Pre-computed alpha variants for inline styles (CSS rgba() can't use var() inside)
    const alphas = [5, 8, 10, 12, 14, 15, 18, 20, 22, 25, 28, 30, 33, 35, 40, 44, 45, 50, 55, 60, 70, 75, 80, 88, 90, 95];
    for (const a of alphas) {
      const alpha = a / 100;
      root.style.setProperty(`--t-primary-${a}`, `rgba(${r},${g},${b},${alpha})`);
    }

    // Page background tints (subtle shift toward theme colour)
    root.style.setProperty('--bg-body', darken(t.primary, 0.88));
    root.style.setProperty('--bg-sidebar', darken(t.primary, 0.82));

    window.dispatchEvent(new CustomEvent('themechange', { detail: t }));
  },
  list: THEMES,
};
