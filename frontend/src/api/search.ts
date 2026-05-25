import client from './client';
import type { TMDBResult } from '@/types/api';

export async function searchMedia(query: string): Promise<TMDBResult[]> {
  const res = await client.get('/search/multi', { params: { query } });
  return res.data.results || [];
}

export async function getTrending(): Promise<TMDBResult[]> {
  const res = await client.get('/discover');
  return res.data.results || [];
}

export async function get_movie_details(id: number): Promise<TMDBResult> {
  const res = await client.get(`/movie/${id}`);
  return res.data;
}

export async function get_tv_details(id: number): Promise<TMDBResult> {
  const res = await client.get(`/tv/${id}`);
  return res.data;
}

export interface EpisodeDetail {
  episode_number: number;
  name: string;
  overview: string;
  air_date: string;
  runtime: number | null;
  still_url: string | null;
}

export async function get_season_details(show_id: number, season_number: number): Promise<{ season_number: number; name: string; episodes: EpisodeDetail[] } | null> {
  try {
    const res = await client.get(`/tv/${show_id}/season/${season_number}`);
    return res.data;
  } catch {
    return null;
  }
}

export interface PersonResult {
  id: number;
  name: string;
  profile_url: string | null;
  department: string;
  popularity: number;
  known_for: { id: number; title: string; media_type: string; poster_url: string | null }[];
}

export interface PersonCredits {
  id: number;
  name: string;
  profile_url: string | null;
  department: string;
  biography: string;
  credits: {
    id: number;
    media_type: 'movie' | 'tv';
    title: string;
    poster_url: string | null;
    release_date: string;
    rating: number | null;
    popularity: number;
    role: string;
  }[];
}

export async function searchPeople(query: string): Promise<PersonResult[]> {
  const res = await client.get('/search/person', { params: { query } });
  return res.data.results || [];
}

export async function get_person_credits(personId: number): Promise<PersonCredits | null> {
  try {
    const res = await client.get(`/person/${personId}/credits`);
    return res.data;
  } catch {
    return null;
  }
}

export async function getMediaDetails(id: number): Promise<TMDBResult | null> {
  try {
    const showData = await get_tv_details(id);
    if (showData && showData.seasons && showData.seasons.length > 0) {
      return { ...showData, media_type: 'tv' };
    }
  } catch { /* not a show */ }
  try {
    const movieData = await get_movie_details(id);
    if (movieData) {
      return { ...movieData, media_type: 'movie' };
    }
  } catch { /* not a movie */ }
  return null;
}
