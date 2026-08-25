import axios from 'axios';
import { toast } from 'sonner';

export const TOKEN_KEY = 'palace.token';
export const MODE_KEY = 'palace.mode'; // 'auto' | 'demo' | 'live'

export const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const url: string = err.config?.url ?? '';
    if (err.response?.status === 401 && !url.includes('/auth/me') && !url.includes('/auth/login')) {
      localStorage.removeItem(TOKEN_KEY);
      window.location.assign('/login');
    }
    // Silence the probe and expected 404s; surface everything else once.
    if (!err.config?.silent) {
      const msg = err.response?.data?.error || err.response?.data?.msg || err.message;
      if (msg && err.response?.status !== 404) toast.error(String(msg));
    }
    return Promise.reject(err);
  },
);

/* -------------------------------------------------------------------------- */
/* Run mode                                                                    */
/* -------------------------------------------------------------------------- */

export type RunMode = 'live' | 'demo';

let mode: RunMode = 'demo';
let detected = false;

export function currentMode(): RunMode {
  return mode;
}

export function isDemo(): boolean {
  return mode === 'demo';
}

export function modePreference(): 'auto' | 'demo' | 'live' {
  return (localStorage.getItem(MODE_KEY) as 'auto' | 'demo' | 'live') ?? 'auto';
}

export function setModePreference(pref: 'auto' | 'demo' | 'live') {
  localStorage.setItem(MODE_KEY, pref);
  window.location.reload();
}

/**
 * Decides whether to talk to the Flask backend or run entirely in the browser.
 * `auto` (the default) pings the API once and falls back to Demo Mode.
 */
export async function detectMode(): Promise<RunMode> {
  if (detected) return mode;
  detected = true;
  const pref = modePreference();
  if (pref === 'demo') { mode = 'demo'; return mode; }
  try {
    await axios.get('/api/', { timeout: 1000, headers: { Accept: 'application/json' } });
    mode = 'live';
  } catch {
    mode = pref === 'live' ? 'live' : 'demo';
  }
  return mode;
}

/** Reads a File into a data URL (used for avatars, banners, backdrops). */
export function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

declare module 'axios' {
  export interface AxiosRequestConfig {
    /** Suppress the global error toast for this request. */
    silent?: boolean;
  }
}
