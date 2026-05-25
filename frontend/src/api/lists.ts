import client from './client';
import type { List } from '@/types/api';

export async function get_lists(): Promise<List[]> {
  const res = await client.get('/lists');
  return res.data.lists || [];
}

export async function get_lists_with_movies(): Promise<List[]> {
  const res = await client.get('/lists/with-movies');
  return res.data.lists || [];
}

export async function get_pinned_lists(): Promise<List[]> {
  const res = await client.get('/lists/pinned');
  return res.data.lists || [];
}

export async function get_list(id: number): Promise<List> {
  const res = await client.get(`/lists/${id}`);
  return res.data.list || res.data;
}

export async function create_list(name: string): Promise<List> {
  const res = await client.post('/lists', { name });
  return res.data.list || res.data;
}

export async function rename_list(id: number, name: string): Promise<List> {
  const res = await client.put(`/lists/${id}/rename`, { name });
  return res.data.list || res.data;
}

export async function delete_list(id: number): Promise<void> {
  await client.delete(`/lists/${id}`);
}

export async function add_movie_to_list(list_id: number, movieData: { tmdb_id: number; title: string; poster_url?: string | null; media_type?: string }): Promise<void> {
  await client.post(`/lists/${list_id}/add`, { movie: movieData });
}

export async function remove_movie_from_list(list_id: number, movie_id: number): Promise<void> {
  await client.delete(`/lists/${list_id}/remove/${movie_id}`);
}

export async function pin_list(list_id: number): Promise<void> {
  await client.post(`/lists/${list_id}/pin`);
}

export async function unpin_list(list_id: number): Promise<void> {
  await client.post(`/lists/${list_id}/unpin`);
}
