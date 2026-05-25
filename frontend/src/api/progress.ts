import client from './client';

export interface AllProgress {
  shows: Record<number, Record<string, boolean>>;
  movies: Record<number, { watched_minutes: number; total_minutes: number }>;
}

export async function getAllProgress(): Promise<AllProgress> {
  const res = await client.get('/watchlist/all-progress');
  return res.data;
}

export async function get_show_progress(show_id: number): Promise<Record<string, boolean>> {
  const res = await client.get(`/watchlist/progress/${show_id}`);
  const map: Record<string, boolean> = {};
  for (const p of res.data.progress || []) {
    map[`${p.season_number}-${p.episode_number}`] = p.watched;
  }
  return map;
}

export async function update_show_progress(
  show_id: number,
  season_number: number,
  episode_number: number,
  watched: boolean
): Promise<void> {
  await client.post('/watchlist/progress', {
    show_id,
    season_number,
    episode_number,
    watched,
  });
}

export async function get_movie_progress(movie_id: number): Promise<{ watched_minutes: number; total_minutes: number }> {
  const res = await client.get(`/watchlist/movie-progress/${movie_id}`);
  return res.data;
}

export async function update_movie_progress(
  movie_id: number,
  watched_minutes: number,
  total_minutes: number
): Promise<void> {
  await client.post('/watchlist/movie-progress', {
    movie_id,
    watched_minutes,
    total_minutes,
  });
}
