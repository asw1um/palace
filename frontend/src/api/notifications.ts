import client from './client';
import type { Notification } from '@/types/api';

export async function getNotifications(): Promise<Notification[]> {
  const res = await client.get('/notifications/user');
  return res.data.notifications || [];
}

export async function markRead(id: number): Promise<void> {
  await client.post(`/notifications/user/${id}/read`);
}

export async function markUnread(id: number): Promise<void> {
  await client.post(`/notifications/user/${id}/unread`);
}

export async function deleteNotification(id: number): Promise<void> {
  await client.delete(`/notifications/user/${id}`);
}

export async function markAllRead(): Promise<void> {
  await client.post('/notifications/user/read-all');
}

export async function acceptInvite(id: number): Promise<void> {
  await client.post(`/notifications/invite/${id}/accept`);
}

export async function declineInvite(id: number): Promise<void> {
  await client.post(`/notifications/invite/${id}/decline`);
}
