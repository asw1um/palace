import client from './client';
import type { Activity } from '@/types/api';

export async function getActivity(limit = 50): Promise<Activity[]> {
  const res = await client.get('/activity', { params: { limit } });
  return res.data.activities || [];
}

export async function get_user_activity(limit = 50): Promise<Activity[]> {
  const res = await client.get('/activity/user', { params: { limit } });
  return res.data.activities || [];
}

export async function get_user_activity_by_id(user_id: number, limit = 50): Promise<Activity[]> {
  const res = await client.get(`/activity/user/${user_id}`, { params: { limit } });
  return res.data.activities || [];
}

export async function getGlobalActivity(limit = 50): Promise<Activity[]> {
  const res = await client.get('/activity/global', { params: { limit } });
  return res.data.activities || [];
}
