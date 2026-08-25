export type Density = 'comfortable' | 'compact';

export interface ThemeState {
  accent: string;
  header: string;    // panel / section header gradient base color
  density: Density;
  radius: number;    // 0.4–1.5 multiplier
  textSize: number;  // 0.9–1.2 multiplier
}

export interface Preset {
  id: string;
  name: string;
  accent: string;
  header: string;
}

export const PRESETS: Preset[] = [
  { id: 'default',  name: 'Default',  accent: '#2563EB', header: '#1e4c80' },
  { id: 'midnight', name: 'Midnight', accent: '#6ea8fe', header: '#1e3a6e' },
  { id: 'orchid',   name: 'Orchid',   accent: '#c084fc', header: '#4a1d96' },
  { id: 'ember',    name: 'Ember',    accent: '#fb7185', header: '#881337' },
  { id: 'matcha',   name: 'Matcha',   accent: '#4ade80', header: '#14532d' },
  { id: 'slate',    name: 'Slate',    accent: '#94a3b8', header: '#1e293b' },
];

export const DEFAULT_THEME: ThemeState = {
  accent: '#2563EB',
  header: '#1e4c80',
  density: 'comfortable',
  radius: 1,
  textSize: 1,
};

export const THEME_KEY = 'palace.theme.v2';

export function loadTheme(): ThemeState {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (!raw) return { ...DEFAULT_THEME };
    return { ...DEFAULT_THEME, ...(JSON.parse(raw) as Partial<ThemeState>) };
  } catch {
    return { ...DEFAULT_THEME };
  }
}

export function saveTheme(t: ThemeState) {
  try {
    localStorage.setItem(THEME_KEY, JSON.stringify(t));
  } catch {
    /* quota — non fatal */
  }
}

/** Mixes two hex colors. ratio=1 → all c1, ratio=0 → all c2. */
function mixHex(c1: string, c2: string, ratio: number): string {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  const r = Math.round(a.r * ratio + b.r * (1 - ratio));
  const g = Math.round(a.g * ratio + b.g * (1 - ratio));
  const bv = Math.round(a.b * ratio + b.b * (1 - ratio));
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${bv.toString(16).padStart(2,'0')}`;
}

/** Writes the theme onto the document element. Always dark mode. */
export function applyTheme(t: ThemeState) {
  const el = document.documentElement;
  el.dataset.mode = 'dark';
  el.dataset.density = t.density;
  el.style.setProperty('--accent', t.accent);
  el.style.setProperty('--on-accent', readableOn(t.accent));
  // Use the chosen header color only when the user customised it; otherwise let
  // the chrome (top bar, panels, heatmap) follow the accent so the whole UI
  // matches the theme you picked instead of staying the default blue.
  const h = t.header && t.header !== DEFAULT_THEME.header ? t.header : t.accent;
  el.style.setProperty('--header', h);

  el.style.setProperty('--bg',            mixHex(h, '#0f1118', 0.22));
  el.style.setProperty('--bg-subtle',     mixHex(h, '#141820', 0.28));
  el.style.setProperty('--surface-1',     mixHex(h, '#1e2230', 0.24));
  el.style.setProperty('--surface-2',     mixHex(h, '#222838', 0.30));
  el.style.setProperty('--surface-3',     mixHex(h, '#282e40', 0.34));
  el.style.setProperty('--surface-inset', mixHex(h, '#181e2a', 0.25));
  el.style.setProperty('--border',        mixHex(h, '#2a3040', 0.36));
  el.style.setProperty('--line',          mixHex(h, '#2a3040', 0.36));
  el.style.setProperty('--line-strong',   mixHex(h, '#3a4050', 0.46));

  el.style.setProperty('--radius-scale', String(t.radius));
  el.style.setProperty('--font-scale', String(t.textSize));
  el.style.setProperty('--poster-min', '150px');

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', '#0B1220');
}

/** Picks black or white text for a given background color (WCAG-ish). */
export function readableOn(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const lum = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lum(r) + 0.7152 * lum(g) + 0.0722 * lum(b);
  return L > 0.45 ? '#080b13' : '#ffffff';
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let v = hex.replace('#', '').trim();
  if (v.length === 3) v = v.split('').map((c) => c + c).join('');
  const n = Number.parseInt(v || '000000', 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function isHex(value: string): boolean {
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

export function normaliseHex(value: string): string {
  let v = value.trim().replace('#', '');
  if (v.length === 3) v = v.split('').map((c) => c + c).join('');
  return `#${v.toLowerCase()}`;
}
