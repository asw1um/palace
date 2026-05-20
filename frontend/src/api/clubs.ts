import client from './client';
import type { Club } from '@/types/api';

export async function getClubs(): Promise<{ my_clubs: Club[]; all_clubs: Club[] }> {
  const res = await client.get('/clubs');
  return res.data;
}

export async function getClub(id: number): Promise<Club> {
  const res = await client.get(`/clubs/${id}`);
  return res.data.club || res.data;
}

export async function createClub(name: string, description?: string): Promise<Club> {
  const res = await client.post('/clubs', { name, description });
  return res.data.club || res.data;
}

export async function joinClub(id: number): Promise<void> {
  await client.post(`/clubs/${id}/join`);
}

export async function leaveClub(id: number): Promise<void> {
  await client.post(`/clubs/${id}/leave`);
}

export async function getPinnedClubs(): Promise<Club[]> {
  const res = await client.get('/clubs/pinned');
  return res.data.clubs || [];
}

export async function pinClub(clubId: number): Promise<void> {
  await client.post(`/clubs/${clubId}/pin`);
}

export async function unpinClub(clubId: number): Promise<void> {
  await client.post(`/clubs/${clubId}/unpin`);
}

export async function updateClub(id: number, data: { name?: string; description?: string }): Promise<Club> {
  const res = await client.put(`/clubs/${id}`, data);
  return res.data.club || res.data;
}

export async function createClubList(clubId: number, name: string): Promise<import('@/types/api').List> {
  const res = await client.post(`/clubs/${clubId}/lists`, { name });
  return res.data.list || res.data;
}

export async function deleteClubList(clubId: number, listId: number): Promise<void> {
  await client.delete(`/clubs/${clubId}/lists/${listId}`);
}

export async function renameClubList(clubId: number, listId: number, name: string): Promise<void> {
  await client.post(`/clubs/${clubId}/lists/${listId}/rename`, { name });
}

export async function getClubActivity(clubId: number, limit = 20): Promise<import('@/types/api').Activity[]> {
  const res = await client.get(`/activity/club/${clubId}`, { params: { limit } });
  return res.data.activities || [];
}

export async function getMyClubsWithLists(): Promise<Club[]> {
  const res = await client.get('/clubs/my-clubs-with-lists');
  return res.data.clubs || [];
}

export async function grantMod(clubId: number, userId: number): Promise<void> {
  await client.post(`/clubs/${clubId}/mods/${userId}`);
}

export async function revokeMod(clubId: number, userId: number): Promise<void> {
  await client.delete(`/clubs/${clubId}/mods/${userId}`);
}

export async function uploadClubImage(id: number, file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await client.post(`/clubs/${id}/upload-image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
