import axios from 'axios';
import { toast } from 'sonner';

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('palace_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('palace_token');
      // Don't hard-redirect on /auth/me — let AuthContext handle it gracefully.
      // For other endpoints, redirect to login.
      const url = err.config?.url || '';
      if (!url.includes('/auth/me')) {
        window.location.href = '/#/login';
      }
    }
    const msg = err.response?.data?.error || err.message || 'Network error';
    toast.error(msg);
    return Promise.reject(err);
  }
);

export default client;
