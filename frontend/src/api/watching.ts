import client from './client';
import type { Show } from '@/types/api';

export async function getWatching(): Promise<Show[]> {
  const res = await client.get('/movies/watching');
  return res.data.shows || [];
}

export async function getMyShows(): Promise<Show[]> {
  const res = await client.get('/movies/shows/my-shows');
  return res.data.shows || [];
}
