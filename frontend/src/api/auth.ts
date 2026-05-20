import client from './client';
import type { User, AuthResponse } from '@/types/api';

export async function register(username: string, password: string, nickname?: string): Promise<AuthResponse> {
  const res = await client.post('/auth/register', { username, password, nickname });
  return res.data;
}

export async function login(username: string, password: string): Promise<AuthResponse> {
  const res = await client.post('/auth/login', { username, password });
  return res.data;
}

export async function getMe(): Promise<User> {
  const res = await client.get('/auth/me');
  return res.data;
}

export async function updateProfile(nickname?: string, bio?: string): Promise<User> {
  const res = await client.put('/auth/profile', { nickname, bio });
  return res.data;
}

export async function uploadPicture(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await client.post('/auth/upload-picture', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function uploadBanner(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await client.post('/auth/upload-banner', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
