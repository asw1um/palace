import client from './client';

export interface AllProgress {
  shows: Record<number, Record<string, boolean>>;
  movies: Record<number, { watched_minutes: number; total_minutes: number }>;
}

export async function getAllProgress(): Promise<AllProgress> {
  const res = await client.get('/watchlist/all-progress');
  return res.data;
}

export async function getShowProgress(showId: number): Promise<Record<string, boolean>> {
  const res = await client.get(`/watchlist/progress/${showId}`);
  const map: Record<string, boolean> = {};
  for (const p of res.data.progress || []) {
    map[`${p.season_number}-${p.episode_number}`] = p.watched;
  }
  return map;
}

export async function updateShowProgress(
  showId: number,
  seasonNumber: number,
  episodeNumber: number,
  watched: boolean
): Promise<void> {
  await client.post('/watchlist/progress', {
    show_id: showId,
    season_number: seasonNumber,
    episode_number: episodeNumber,
    watched,
  });
}

export async function getMovieProgress(movieId: number): Promise<{ watched_minutes: number; total_minutes: number }> {
  const res = await client.get(`/watchlist/movie-progress/${movieId}`);
  return res.data;
}

export async function updateMovieProgress(
  movieId: number,
  watchedMinutes: number,
  totalMinutes: number
): Promise<void> {
  await client.post('/watchlist/movie-progress', {
    movie_id: movieId,
    watched_minutes: watchedMinutes,
    total_minutes: totalMinutes,
  });
}
