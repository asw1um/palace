import client from './client';
import type { Activity } from '@/types/api';

export async function getActivity(limit = 50): Promise<Activity[]> {
  const res = await client.get('/activity', { params: { limit } });
  return res.data.activities || [];
}

export async function getUserActivity(limit = 50): Promise<Activity[]> {
  const res = await client.get('/activity/user', { params: { limit } });
  return res.data.activities || [];
}

export async function getUserActivityById(userId: number, limit = 50): Promise<Activity[]> {
  const res = await client.get(`/activity/user/${userId}`, { params: { limit } });
  return res.data.activities || [];
}

export async function getGlobalActivity(limit = 50): Promise<Activity[]> {
  const res = await client.get('/activity/global', { params: { limit } });
  return res.data.activities || [];
}
