import client from './client';
import type { UserSettings } from '@/types/api';

export async function getSettings(): Promise<UserSettings> {
  const res = await client.get('/settings');
  return res.data;
}

export async function updateSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const res = await client.put('/settings', settings);
  return res.data;
}
