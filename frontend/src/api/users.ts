import client from './client';
import type { User } from '@/types/api';

export async function getUsers(): Promise<User[]> {
  const res = await client.get('/auth/users');
  return res.data.users || [];
}

export async function get_user(username: string): Promise<User> {
  const res = await client.get(`/auth/users/${username}`);
  return res.data;
}
