import client from './client';
import type { List } from '@/types/api';

export async function getLists(): Promise<List[]> {
  const res = await client.get('/lists');
  return res.data.lists || [];
}

export async function getListsWithMovies(): Promise<List[]> {
  const res = await client.get('/lists/with-movies');
  return res.data.lists || [];
}

export async function getPinnedLists(): Promise<List[]> {
  const res = await client.get('/lists/pinned');
  return res.data.lists || [];
}

export async function getList(id: number): Promise<List> {
  const res = await client.get(`/lists/${id}`);
  return res.data.list || res.data;
}

export async function createList(name: string): Promise<List> {
  const res = await client.post('/lists', { name });
  return res.data.list || res.data;
}

export async function renameList(id: number, name: string): Promise<List> {
  const res = await client.put(`/lists/${id}/rename`, { name });
  return res.data.list || res.data;
}

export async function deleteList(id: number): Promise<void> {
  await client.delete(`/lists/${id}`);
}

export async function addMovieToList(listId: number, movieData: { tmdb_id: number; title: string; poster_url?: string | null; media_type?: string }): Promise<void> {
  await client.post(`/lists/${listId}/add`, { movie: movieData });
}

export async function removeMovieFromList(listId: number, movieId: number): Promise<void> {
  await client.delete(`/lists/${listId}/remove/${movieId}`);
}

export async function pinList(listId: number): Promise<void> {
  await client.post(`/lists/${listId}/pin`);
}

export async function unpinList(listId: number): Promise<void> {
  await client.post(`/lists/${listId}/unpin`);
}
