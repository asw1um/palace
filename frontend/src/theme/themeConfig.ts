/**
 * The full shape of what a user can customise, plus the presets that ship
 * with Palace. Everything here is serialised to localStorage and mirrored to
 * the backend user settings when a session is available.
 */

export type Mode = 'dark' | 'light' | 'system';
export type Surface = 'glass' | 'solid' | 'flat';
export type Density = 'comfortable' | 'compact';
export type MotionPref = 'full' | 'reduced' | 'system';
export type Backdrop = 'mesh' | 'gradient' | 'solid' | 'video' | 'image';

export interface ThemeState {
  preset: string;
  mode: Mode;
  accent: string;
  accent2: string;
  surface: Surface;
  density: Density;
  radius: number;      // 0.4 – 1.5 multiplier
  fontScale: number;   // 0.9 – 1.2 multiplier
  motion: MotionPref;
  backdrop: Backdrop;
  /** Data URL or remote URL for backdrop: 'image' (issue #4). */
  backdropImage: string | null;
  /** How dense the poster grids are — min tile width in px. */
  posterSize: number;
  /** 12h vs 24h clock. */
  timeFormat: '12' | '24';
}

export interface Preset {
  id: string;
  name: string;
  accent: string;
  accent2: string;
  mode: Exclude<Mode, 'system'>;
}

export const PRESETS: Preset[] = [
  { id: 'midnight',  name: 'Midnight',   accent: '#6ea8fe', accent2: '#a855f7', mode: 'dark' },
  { id: 'abyss',     name: 'Abyss',      accent: '#38bdf8', accent2: '#0ea5e9', mode: 'dark' },
  { id: 'orchid',    name: 'Orchid',     accent: '#c084fc', accent2: '#f472b6', mode: 'dark' },
  { id: 'ember',     name: 'Ember',      accent: '#fb7185', accent2: '#f59e0b', mode: 'dark' },
  { id: 'matcha',    name: 'Matcha',     accent: '#4ade80', accent2: '#22d3ee', mode: 'dark' },
  { id: 'mango',     name: 'Mango',      accent: '#fbbf24', accent2: '#fb923c', mode: 'dark' },
  { id: 'noir',      name: 'Noir',       accent: '#d4d4d8', accent2: '#71717a', mode: 'dark' },
  { id: 'daylight',  name: 'Daylight',   accent: '#2563eb', accent2: '#7c3aed', mode: 'light' },
  { id: 'linen',     name: 'Linen',      accent: '#b45309', accent2: '#0d9488', mode: 'light' },
  { id: 'meadow',    name: 'Meadow',     accent: '#15803d', accent2: '#0891b2', mode: 'light' },
];

export const DEFAULT_THEME: ThemeState = {
  preset: 'midnight',
  mode: 'dark',
  accent: '#6ea8fe',
  accent2: '#a855f7',
  surface: 'glass',
  density: 'comfortable',
  radius: 1,
  fontScale: 1,
  motion: 'system',
  backdrop: 'mesh',
  backdropImage: null,
  posterSize: 150,
  timeFormat: '24',
};

export const THEME_KEY = 'palace.theme.v1';

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
    /* quota — non fatal, the theme just will not persist */
  }
}

/** Resolves `system` into a concrete mode. */
export function resolveMode(mode: Mode): 'dark' | 'light' {
  if (mode !== 'system') return mode;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function resolveMotion(pref: MotionPref): 'full' | 'reduced' {
  if (pref !== 'system') return pref;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'full';
}

/** Writes the whole theme onto the document element. */
export function applyTheme(t: ThemeState) {
  const el = document.documentElement;
  el.dataset.mode = resolveMode(t.mode);
  el.dataset.surface = t.surface;
  el.dataset.density = t.density;
  el.dataset.motion = resolveMotion(t.motion);
  el.style.setProperty('--accent', t.accent);
  el.style.setProperty('--accent-2', t.accent2);
  el.style.setProperty('--radius-scale', String(t.radius));
  el.style.setProperty('--font-scale', String(t.fontScale));
  el.style.setProperty('--poster-min', `${t.posterSize}px`);
  el.style.setProperty('--on-accent', readableOn(t.accent));

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolveMode(t.mode) === 'light' ? '#eef1f7' : '#080b13');
}

/** Picks black or white text for a given background colour (WCAG-ish). */
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
