import axios from 'axios';
import { toast } from 'sonner';

export const TOKEN_KEY = 'palace.token';

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
    if (!err.config?.silent) {
      const msg = err.response?.data?.error || err.response?.data?.msg || err.message;
      if (msg && err.response?.status !== 404) toast.error(String(msg));
    }
    return Promise.reject(err);
  },
);

/* -------------------------------------------------------------------------- */
/* Run mode — the app always talks to the real (FastAPI) backend. No demo.     */
/* -------------------------------------------------------------------------- */

export type RunMode = 'live';

export function currentMode(): RunMode {
  return 'live';
}

export function isDemo(): boolean {
  return false;
}

export async function detectMode(): Promise<RunMode> {
  return 'live';
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
