import client from './client';
import type { Club } from '@/types/api';

export async function get_clubs(): Promise<{ my_clubs: Club[]; all_clubs: Club[] }> {
  const res = await client.get('/clubs');
  return res.data;
}

export async function get_club(id: number): Promise<Club> {
  const res = await client.get(`/clubs/${id}`);
  return res.data.club || res.data;
}

export async function create_club(name: string, description?: string): Promise<Club> {
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

export async function pin_club(club_id: number): Promise<void> {
  await client.post(`/clubs/${club_id}/pin`);
}

export async function unpin_club(club_id: number): Promise<void> {
  await client.post(`/clubs/${club_id}/unpin`);
}

export async function updateClub(id: number, data: { name?: string; description?: string }): Promise<Club> {
  const res = await client.put(`/clubs/${id}`, data);
  return res.data.club || res.data;
}

export async function create_club_list(club_id: number, name: string): Promise<import('@/types/api').List> {
  const res = await client.post(`/clubs/${club_id}/lists`, { name });
  return res.data.list || res.data;
}

export async function delete_club_list(club_id: number, list_id: number): Promise<void> {
  await client.delete(`/clubs/${club_id}/lists/${list_id}`);
}

export async function rename_club_list(club_id: number, list_id: number, name: string): Promise<void> {
  await client.post(`/clubs/${club_id}/lists/${list_id}/rename`, { name });
}

export async function get_club_activity(club_id: number, limit = 20): Promise<import('@/types/api').Activity[]> {
  const res = await client.get(`/activity/club/${club_id}`, { params: { limit } });
  return res.data.activities || [];
}

export async function getMyClubsWithLists(): Promise<Club[]> {
  const res = await client.get('/clubs/my-clubs-with-lists');
  return res.data.clubs || [];
}

export async function grant_mod(club_id: number, user_id: number): Promise<void> {
  await client.post(`/clubs/${club_id}/mods/${user_id}`);
}

export async function revoke_mod(club_id: number, user_id: number): Promise<void> {
  await client.delete(`/clubs/${club_id}/mods/${user_id}`);
}

export async function grant_helper(club_id: number, user_id: number): Promise<void> {
  await client.post(`/clubs/${club_id}/helpers/${user_id}`);
}

export async function revoke_helper(club_id: number, user_id: number): Promise<void> {
  await client.delete(`/clubs/${club_id}/helpers/${user_id}`);
}

export async function kick_member(club_id: number, user_id: number): Promise<void> {
  await client.post(`/clubs/${club_id}/kick/${user_id}`);
}

export async function uploadClubImage(id: number, file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await client.post(`/clubs/${id}/upload-image`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
