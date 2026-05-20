import client from './client';
import type { User } from '@/types/api';

export async function getUsers(): Promise<User[]> {
  const res = await client.get('/auth/users');
  return res.data.users || [];
}

export async function getUser(id: number): Promise<User> {
  const res = await client.get(`/auth/users/${id}`);
  return res.data;
}
