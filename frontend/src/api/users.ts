import client from './client';
import type { User } from '@/types/api';

export async function getUsers(): Promise<User[]> {
  const res = await client.get('/auth/users');
  return res.data.users || [];
}

<<<<<<< Updated upstream
export async function getUser(username: string): Promise<User> {
  const res = await client.get(`/auth/users/${username}`);
=======
export async function get_user(id: number): Promise<User> {
  const res = await client.get(`/auth/users/${id}`);
>>>>>>> Stashed changes
  return res.data;
}
