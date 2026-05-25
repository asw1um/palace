import client from './client';

export interface CustomMediaData {
  tmdb_id: number;
  media_type: 'movie' | 'tv';
  runtime?: number | null;
  seasons?: { season_number: number; episode_count: number }[] | null;
}

export async function get_custom_media(tmdb_id: number, media_type: 'movie' | 'tv'): Promise<CustomMediaData | null> {
  const res = await client.get(`/custom-media/${media_type}/${tmdb_id}`);
  return res.data ?? null;
}

export async function set_movie_runtime(tmdb_id: number, runtime: number): Promise<CustomMediaData> {
  const res = await client.put(`/custom-media/movie/${tmdb_id}`, { runtime });
  return res.data;
}

export async function set_show_seasons(
  tmdb_id: number,
  seasons: { season_number: number; episode_count: number }[]
): Promise<CustomMediaData> {
  const res = await client.put(`/custom-media/tv/${tmdb_id}`, { seasons });
  return res.data;
}
