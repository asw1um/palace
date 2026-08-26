/* ============================================================================
   One API surface for the whole app.

   Every function either talks to the Flask backend (`live`) or to the in-browser
   Demo store. Pages never need to know which.
   ========================================================================== */

import { client, readFile, TOKEN_KEY } from './client';
import { rank } from '@/lib/fuzzy';
import type {
  Activity, AuthResponse, Club, Friendship, List, ListItem, MediaType,
  Notification, Review, TMDBResult, User, UserSettings, UserStats,
} from './types';

/* -------------------------------------------------------------------------- */
/* Normalisers                                                                 */
/* -------------------------------------------------------------------------- */

/** Backend lists carry `movies` + `shows`; the UI wants one `items` array. */
function normaliseList(l: List): List {
  if (l.items) return l;
  const items: ListItem[] = [
    ...(l.movies ?? []).map((m) => ({
      id: m.id,
      list_id: l.id,
      tmdb_id: m.tmdb_id ?? m.id,
      media_type: 'movie' as MediaType,
      title: m.title,
      poster_url: m.poster_url,
      runtime: m.runtime,
      release_date: m.release_date,
      added_at: m.added_at ?? '',
      watched: m.watched,
    })),
    ...(l.shows ?? []).map((s) => ({
      id: s.id,
      list_id: l.id,
      tmdb_id: s.tmdb_id ?? s.id,
      media_type: 'tv' as MediaType,
      title: s.title,
      poster_url: s.poster_url,
      seasons: s.seasons,
      total_episodes: s.seasons?.reduce((a, b) => a + b.episode_count, 0),
      release_date: s.release_date,
      added_at: s.added_at ?? '',
      watched: false,
    })),
  ];
  return {
    ...l,
    items,
    // Show counts were being left out of totals. — issue #46
    movie_count: items.filter((i) => i.media_type === 'movie').length,
    show_count: items.filter((i) => i.media_type === 'tv').length,
  };
}

/* -------------------------------------------------------------------------- */
/* Auth                                                                        */
/* -------------------------------------------------------------------------- */

export const auth = {
  async login(username: string, password: string): Promise<AuthResponse> {
    const res = await client.post('/auth/login', { username, password });
    localStorage.setItem(TOKEN_KEY, res.data.access_token);
    return res.data;
  },

  async register(username: string, password: string, nickname?: string): Promise<AuthResponse> {
    const res = await client.post('/auth/register', { username, password, nickname });
    localStorage.setItem(TOKEN_KEY, res.data.access_token);
    return res.data;
  },

  async me(): Promise<User> {
    const res = await client.get('/auth/me', { silent: true });
    return res.data.user ?? res.data;
  },

  async updateProfile(patch: { nickname?: string; bio?: string }): Promise<User> {
    const res = await client.put('/auth/profile', patch);
    return res.data.user ?? res.data;
  },

  async uploadPicture(file: File): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    const res = await client.post('/auth/upload-picture', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.url;
  },

  async uploadBanner(file: File): Promise<string> {
    const form = new FormData();
    form.append('file', file);
    const res = await client.post('/auth/upload-banner', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.url;
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
  },
};

/* -------------------------------------------------------------------------- */
/* Lists                                                                       */
/* -------------------------------------------------------------------------- */

const ORDER_KEY = 'palace.listOrder';
const ITEM_ORDER_KEY = 'palace.itemOrder';

function readOrder(key: string): Record<string, number[]> {
  try { return JSON.parse(localStorage.getItem(key) ?? '{}'); } catch { return {}; }
}
function writeOrder(key: string, value: Record<string, number[]>) {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Applies the locally stored manual order to a set of rows. — issues #7, #24 */
function applyOrder<T extends { id: number }>(rows: T[], key: string, bucket: string): T[] {
  const order = readOrder(key)[bucket];
  if (!order?.length) return rows;
  const pos = new Map(order.map((id, i) => [id, i]));
  return [...rows].sort(
    (a, b) => (pos.get(a.id) ?? 1e6) - (pos.get(b.id) ?? 1e6),
  );
}

export const lists = {
  async all(): Promise<List[]> {
    const rows = ((await client.get('/lists/with-movies')).data as List[]).map(normaliseList);
    return applyOrder(rows, ORDER_KEY, 'mine');
  },

  async one(id: number): Promise<List | null> {
    const l = normaliseList((await client.get(`/lists/${id}`)).data as List);
    if (!l) return null;
    return { ...l, items: applyOrder(l.items ?? [], ITEM_ORDER_KEY, String(id)) };
  },

  async create(name: string): Promise<List> {
    const res = await client.post('/lists/', { name });
    return normaliseList(res.data);
  },

  async rename(id: number, name: string): Promise<void> {
    await client.put(`/lists/${id}/rename`, { name });
  },

  async remove(id: number): Promise<void> {
    await client.delete(`/lists/${id}`);
  },

  async add(listId: number, title: { tmdb_id: number; media_type: MediaType; title: string; poster_url: string | null }) {
    await client.post(`/lists/${listId}/add`, {
      movie: {
        tmdb_id: title.tmdb_id,
        title: title.title,
        poster_url: title.poster_url,
        media_type: title.media_type,
      },
    });
  },

  async removeItem(listId: number, itemId: number) {
    await client.delete(`/lists/${listId}/remove/${itemId}`);
  },

  async pin(id: number, pinned: boolean) {
    await client.post(`/lists/${id}/${pinned ? 'pin' : 'unpin'}`);
  },

  reorder(ids: number[]) {
    const map = readOrder(ORDER_KEY);
    map.mine = ids;
    writeOrder(ORDER_KEY, map);
  },

  reorderItems(listId: number, ids: number[]) {
    const map = readOrder(ITEM_ORDER_KEY);
    map[String(listId)] = ids;
    writeOrder(ITEM_ORDER_KEY, map);
  },

  /** Which of my lists already hold this title — powers the duplicate warning. */
  async containing(tmdbId: number): Promise<List[]> {
    const all = await lists.all();
    return all.filter((l) => l.items?.some((i) => i.tmdb_id === tmdbId));
  },
};

/* -------------------------------------------------------------------------- */
/* Clubs                                                                       */
/* -------------------------------------------------------------------------- */

export const clubs = {
  async all(): Promise<{ my_clubs: Club[]; all_clubs: Club[] }> {
    const res = await client.get('/clubs');
    const map = (c: Club) => ({ ...c, lists: (c.lists ?? []).map(normaliseList) });
    return {
      my_clubs: (res.data.my_clubs ?? []).map(map),
      all_clubs: (res.data.all_clubs ?? []).map(map),
    };
  },
  async one(id: number): Promise<Club | null> {
    const res = await client.get(`/clubs/${id}`);
    return { ...res.data, lists: (res.data.lists ?? []).map(normaliseList) };
  },
  async create(name: string, description: string): Promise<Club> {
    const res = await client.post('/clubs', { name, description });
    return res.data;
  },
  async join(id: number) {
    await client.post(`/clubs/${id}/join`);
  },
  async leave(id: number) {
    await client.post(`/clubs/${id}/leave`);
  },
  async createList(clubId: number, name: string): Promise<List> {
    const res = await client.post(`/clubs/${clubId}/lists`, { name });
    return normaliseList(res.data);
  },
  async pin(id: number, pinned: boolean) {
    await client.post(`/clubs/${id}/${pinned ? 'pin' : 'unpin'}`);
  },
};

/* -------------------------------------------------------------------------- */
/* People                                                                      */
/* -------------------------------------------------------------------------- */

export const people = {
  async all(): Promise<User[]> {
    const res = await client.get('/auth/users');
    return res.data.users ?? res.data;
  },
  async one(username: string): Promise<User | null> {
    const res = await client.get(`/auth/users/${username}`);
    return res.data.user ?? res.data;
  },
  /** Friends are Demo-only until the backend ships them. — issue #113 */
  async friends(): Promise<Friendship[]> {
    return [];
  },
  async addFriend(userId: number) {
  },
  async respondFriend(id: number, accept: boolean) {
  },
  async removeFriend(id: number) {
  },
};

/* -------------------------------------------------------------------------- */
/* Search & discovery                                                          */
/* -------------------------------------------------------------------------- */

export const discover = {
  async trending(): Promise<TMDBResult[]> {
    const res = await client.get('/discover');
    return res.data.results ?? res.data;
  },
  async search(query: string): Promise<TMDBResult[]> {
    if (!query.trim()) return [];
    const res = await client.get('/search/multi', { params: { query } });
    return res.data.results ?? res.data;
  },
  async details(id: number, mediaType: MediaType): Promise<TMDBResult | null> {
    const res = await client.get(`/${mediaType === 'tv' ? 'tv' : 'movie'}/${id}`);
    return res.data;
  },
  /** Local title corpus used for "did you mean" suggestions. */
  corpus(): string[] {
    return [];
  },
};

/* -------------------------------------------------------------------------- */
/* Reviews                                                                     */
/* -------------------------------------------------------------------------- */

/** FastAPI review → frontend shape (body/contains_spoilers/user/likes). */
function normaliseReview(r: any): Review {
  return {
    id: r.id,
    user_id: r.user_id,
    tmdb_id: r.tmdb_id,
    media_type: r.media_type,
    title: r.title ?? '',
    poster_url: r.poster_url ?? '',
    rating: r.rating ?? 0,
    body: r.content ?? '',
    contains_spoilers: r.is_spoiler ?? false,
    created_at: r.created_at ?? '',
    user: r.author
      ? { id: r.author.id, username: r.author.username, nickname: r.author.nickname, profile_picture: r.author.profile_picture }
      : undefined,
    likes: r.reactions?.likes ?? 0,
    dislikes: r.reactions?.dislikes ?? 0,
    my_reaction: r.reactions?.my_reaction ?? null,
  };
}

export const reviews = {
  async forTitle(tmdbId: number, mediaType: MediaType): Promise<Review[]> {
    const res = await client.get(`/reviews/title/${tmdbId}/${mediaType}`);
    return (res.data.reviews ?? res.data).map(normaliseReview);
  },
  async byUser(userId: number): Promise<Review[]> {
    const res = await client.get(`/reviews/user/${userId}`);
    return (res.data.reviews ?? res.data).map(normaliseReview);
  },
  async upsert(input: { tmdb_id: number; media_type: MediaType; rating: number; body: string; contains_spoilers?: boolean }) {
    const res = await client.post('/reviews', {
      tmdb_id: input.tmdb_id,
      media_type: input.media_type,
      rating: input.rating,
      content: input.body,
      is_spoiler: input.contains_spoilers ?? false,
    });
    return res.data;
  },
  async remove(id: number) {
    await client.delete(`/reviews/${id}`);
  },
  async react(id: number, reaction: 'like' | 'dislike') {
    await client.post(`/reviews/${id}/react`, { reaction });
  },
  /** Average of user ratings, shown next to the TMDB score. — issue #111 */
  async average(tmdbId: number, mediaType: MediaType): Promise<{ avg: number; count: number }> {
    const rows = await reviews.forTitle(tmdbId, mediaType);
    if (!rows.length) return { avg: 0, count: 0 };
    return { avg: rows.reduce((a, r) => a + r.rating, 0) / rows.length, count: rows.length };
  },
};

/* -------------------------------------------------------------------------- */
/* Progress                                                                    */
/* -------------------------------------------------------------------------- */

export interface ProgressEntry {
  episodes: string[];
  watched: boolean;
  minutes: number;
  updated: string;
}

export const progress = {
  /** Everything the user has watched, keyed by `"movie:123"` / `"tv:456"`. */
  async summary(): Promise<Record<string, ProgressEntry>> {
    try {
      const res = await client.get('/watchlist/all-progress', { silent: true });
      const out: Record<string, ProgressEntry> = {};
      const data = res.data ?? {};
      for (const [showId, episodes] of Object.entries(data.shows ?? data)) {
        const eps = Array.isArray(episodes)
          ? (episodes as string[])
          : Object.entries(episodes as Record<string, boolean>)
              .filter(([, v]) => v)
              .map(([k]) => k);
        out[`tv:${showId}`] = { episodes: eps, watched: false, minutes: eps.length * 45, updated: '' };
      }
      for (const [movieId, done] of Object.entries(data.movies ?? {})) {
        out[`movie:${movieId}`] = { episodes: [], watched: !!done, minutes: 0, updated: '' };
      }
      return out;
    } catch {
      return {};
    }
  },

  async forTitle(mediaType: MediaType, tmdbId: number) {
    if (mediaType === 'movie') {
      const res = await client.get(`/watchlist/movie-progress/${tmdbId}`, { silent: true }).catch(() => null);
      const watchedMinutes = res?.data?.watched_minutes ?? 0;
      return { episodes: [], watched: watchedMinutes > 0, minutes: watchedMinutes, updated: '' };
    }
    const res = await client.get(`/watchlist/progress/${tmdbId}`, { silent: true }).catch(() => null);
    const map: Record<string, boolean> = res?.data ?? {};
    const episodes = Object.entries(map).filter(([, v]) => v).map(([k]) => k);
    return { episodes, watched: false, minutes: episodes.length * 45, updated: '' };
  },

  async setEpisode(tmdbId: number, season: number, episode: number, watched: boolean, cascade: boolean) {
    await client.post('/watchlist/progress', {
      show_id: tmdbId, season_number: season, episode_number: episode, watched, cascade,
    });
  },

  /** Marks a movie watched — parity with shows. — issue #33 */
  async setMovieWatched(tmdbId: number, watched: boolean) {
    const meta = await discover.details(tmdbId, 'movie').catch(() => null);
    await client.post('/watchlist/movie-progress', {
      movie_id: tmdbId,
      watched_minutes: watched ? meta?.runtime ?? 100 : 0,
      total_minutes: meta?.runtime ?? 100,
    });
  },
};

/* -------------------------------------------------------------------------- */
/* Activity, notifications, settings, stats                                    */
/* -------------------------------------------------------------------------- */

export const activity = {
  async feed(scope: 'global' | 'me', limit = 50): Promise<Activity[]> {
    const res = await client.get(scope === 'me' ? '/activity/user' : '/activity/global', {
      params: { limit },
    });
    return res.data.activities ?? res.data;
  },
};

export const notifications = {
  async all(): Promise<Notification[]> {
    const res = await client.get('/notifications/user');
    return res.data.notifications ?? res.data;
  },
  async setRead(id: number, read: boolean) {
    await client.post(`/notifications/user/${id}/${read ? 'read' : 'unread'}`);
  },
  async readAll() {
    await client.post('/notifications/user/read-all');
  },
  async remove(id: number) {
    await client.delete(`/notifications/user/${id}`);
  },
};

export const settings = {
  async get(): Promise<UserSettings> {
    const res = await client.get('/settings');
    return res.data;
  },
  async update(patch: Partial<UserSettings>) {
    await client.put('/settings', patch);
  },
};

export const stats = {
  async forUser(userId: number): Promise<UserStats> {
    // The backend has no stats endpoint yet — derive what we can from lists.
    const [myLists, myReviews] = await Promise.all([
      lists.all().catch(() => [] as List[]),
      reviews.byUser(userId).catch(() => [] as Review[]),
    ]);
    const items = myLists.flatMap((l) => l.items ?? []);
    const unique = new Set(items.map((i) => i.tmdb_id));
    return {
      titles: unique.size,
      movies: items.filter((i) => i.media_type === 'movie').length,
      episodes: 0,
      minutes: items.reduce((a, i) => a + (i.runtime ?? 0), 0),
      reviews: myReviews.length,
      avgRating: myReviews.length
        ? myReviews.reduce((a, r) => a + r.rating, 0) / myReviews.length
        : 0,
      rewatches: 0,
      streak: 0,
      heatmap: [],
      topGenres: [],
    };
  },
};

