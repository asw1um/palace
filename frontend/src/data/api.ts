/* ============================================================================
   One API surface for the whole app.

   Every function either talks to the Flask backend (`live`) or to the in-browser
   Demo store. Pages never need to know which.
   ========================================================================== */

import { client, isDemo, readFile, TOKEN_KEY } from './client';
import { demo, resetDemo } from './demo/store';
import { CATALOG, findTitle } from './demo/catalog';
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
    if (isDemo()) {
      const me = demo.me();
      localStorage.setItem(TOKEN_KEY, 'demo');
      return { access_token: 'demo', user: me };
    }
    const res = await client.post('/auth/login', { username, password });
    localStorage.setItem(TOKEN_KEY, res.data.access_token);
    return res.data;
  },

  async register(username: string, password: string, nickname?: string): Promise<AuthResponse> {
    if (isDemo()) {
      const me = demo.updateProfile({ username, nickname: nickname || username });
      localStorage.setItem(TOKEN_KEY, 'demo');
      return { access_token: 'demo', user: me };
    }
    const res = await client.post('/auth/register', { username, password, nickname });
    localStorage.setItem(TOKEN_KEY, res.data.access_token);
    return res.data;
  },

  async me(): Promise<User> {
    if (isDemo()) return demo.me();
    const res = await client.get('/auth/me', { silent: true });
    return res.data.user ?? res.data;
  },

  async updateProfile(patch: { nickname?: string; bio?: string }): Promise<User> {
    if (isDemo()) return demo.updateProfile(patch);
    const res = await client.put('/auth/profile', patch);
    return res.data.user ?? res.data;
  },

  async uploadPicture(file: File): Promise<string> {
    if (isDemo()) {
      const url = await readFile(file);
      demo.updateProfile({ profile_picture: url });
      return url;
    }
    const form = new FormData();
    form.append('file', file);
    const res = await client.post('/auth/upload-picture', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.url;
  },

  async uploadBanner(file: File): Promise<string> {
    if (isDemo()) {
      const url = await readFile(file);
      demo.updateProfile({ banner: url });
      return url;
    }
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
    const rows = isDemo()
      ? demo.lists()
      : ((await client.get('/lists/with-movies')).data as List[]).map(normaliseList);
    return applyOrder(rows, ORDER_KEY, 'mine');
  },

  async one(id: number): Promise<List | null> {
    const l = isDemo()
      ? demo.list(id)
      : normaliseList((await client.get(`/lists/${id}`)).data as List);
    if (!l) return null;
    return { ...l, items: applyOrder(l.items ?? [], ITEM_ORDER_KEY, String(id)) };
  },

  async create(name: string): Promise<List> {
    if (isDemo()) return demo.createList(name);
    const res = await client.post('/lists/', { name });
    return normaliseList(res.data);
  },

  async rename(id: number, name: string): Promise<void> {
    if (isDemo()) return demo.renameList(id, name);
    await client.put(`/lists/${id}/rename`, { name });
  },

  async remove(id: number): Promise<void> {
    if (isDemo()) return demo.deleteList(id);
    await client.delete(`/lists/${id}`);
  },

  async add(listId: number, title: { tmdb_id: number; media_type: MediaType; title: string; poster_url: string | null }) {
    if (isDemo()) return demo.addToList(listId, title);
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
    if (isDemo()) return demo.removeFromList(listId, itemId);
    await client.delete(`/lists/${listId}/remove/${itemId}`);
  },

  async pin(id: number, pinned: boolean) {
    if (isDemo()) {
      const s = demo.settings();
      demo.updateSettings({
        pinned_lists: pinned
          ? [...new Set([...s.pinned_lists, id])]
          : s.pinned_lists.filter((x) => x !== id),
      });
      return;
    }
    await client.post(`/lists/${id}/${pinned ? 'pin' : 'unpin'}`);
  },

  reorder(ids: number[]) {
    const map = readOrder(ORDER_KEY);
    map.mine = ids;
    writeOrder(ORDER_KEY, map);
    if (isDemo()) demo.reorderLists(ids);
  },

  reorderItems(listId: number, ids: number[]) {
    const map = readOrder(ITEM_ORDER_KEY);
    map[String(listId)] = ids;
    writeOrder(ITEM_ORDER_KEY, map);
    if (isDemo()) demo.reorderItems(listId, ids);
  },

  /** Which of my lists already hold this title — powers the duplicate warning. */
  async containing(tmdbId: number): Promise<List[]> {
    if (isDemo()) return demo.listsContaining(tmdbId);
    const all = await lists.all();
    return all.filter((l) => l.items?.some((i) => i.tmdb_id === tmdbId));
  },
};

/* -------------------------------------------------------------------------- */
/* Clubs                                                                       */
/* -------------------------------------------------------------------------- */

export const clubs = {
  async all(): Promise<{ my_clubs: Club[]; all_clubs: Club[] }> {
    if (isDemo()) return demo.clubs();
    const res = await client.get('/clubs');
    const map = (c: Club) => ({ ...c, lists: (c.lists ?? []).map(normaliseList) });
    return {
      my_clubs: (res.data.my_clubs ?? []).map(map),
      all_clubs: (res.data.all_clubs ?? []).map(map),
    };
  },
  async one(id: number): Promise<Club | null> {
    if (isDemo()) return demo.club(id);
    const res = await client.get(`/clubs/${id}`);
    return { ...res.data, lists: (res.data.lists ?? []).map(normaliseList) };
  },
  async create(name: string, description: string): Promise<Club> {
    if (isDemo()) return demo.createClub(name, description);
    const res = await client.post('/clubs', { name, description });
    return res.data;
  },
  async join(id: number) {
    if (isDemo()) return demo.joinClub(id);
    await client.post(`/clubs/${id}/join`);
  },
  async leave(id: number) {
    if (isDemo()) return demo.leaveClub(id);
    await client.post(`/clubs/${id}/leave`);
  },
  async createList(clubId: number, name: string): Promise<List> {
    if (isDemo()) return demo.createList(name, clubId);
    const res = await client.post(`/clubs/${clubId}/lists`, { name });
    return normaliseList(res.data);
  },
  async pin(id: number, pinned: boolean) {
    if (isDemo()) {
      const s = demo.settings();
      demo.updateSettings({
        pinned_clubs: pinned
          ? [...new Set([...s.pinned_clubs, id])]
          : s.pinned_clubs.filter((x) => x !== id),
      });
      return;
    }
    await client.post(`/clubs/${id}/${pinned ? 'pin' : 'unpin'}`);
  },
};

/* -------------------------------------------------------------------------- */
/* People                                                                      */
/* -------------------------------------------------------------------------- */

export const people = {
  async all(): Promise<User[]> {
    if (isDemo()) return demo.users();
    const res = await client.get('/auth/users');
    return res.data.users ?? res.data;
  },
  async one(username: string): Promise<User | null> {
    if (isDemo()) return demo.user(username);
    const res = await client.get(`/auth/users/${username}`);
    return res.data.user ?? res.data;
  },
  /** Friends are Demo-only until the backend ships them. — issue #113 */
  async friends(): Promise<Friendship[]> {
    return isDemo() ? demo.friends() : [];
  },
  async addFriend(userId: number) {
    if (isDemo()) demo.addFriend(userId);
  },
  async respondFriend(id: number, accept: boolean) {
    if (isDemo()) demo.respondFriend(id, accept);
  },
  async removeFriend(id: number) {
    if (isDemo()) demo.removeFriend(id);
  },
};

/* -------------------------------------------------------------------------- */
/* Search & discovery                                                          */
/* -------------------------------------------------------------------------- */

export const discover = {
  async trending(): Promise<TMDBResult[]> {
    if (isDemo()) return [...CATALOG].sort((a, b) => b.popularity - a.popularity);
    const res = await client.get('/discover');
    return res.data.results ?? res.data;
  },
  async search(query: string): Promise<TMDBResult[]> {
    if (!query.trim()) return [];
    if (isDemo()) return rank(CATALOG, query, (c) => `${c.title} ${c.genres?.join(' ') ?? ''}`);
    const res = await client.get('/search/multi', { params: { query } });
    return res.data.results ?? res.data;
  },
  async details(id: number, mediaType: MediaType): Promise<TMDBResult | null> {
    if (isDemo()) return findTitle(id) ?? null;
    const res = await client.get(`/${mediaType === 'tv' ? 'tv' : 'movie'}/${id}`);
    return res.data;
  },
  /** Local title corpus used for "did you mean" suggestions. */
  corpus(): string[] {
    return CATALOG.map((c) => c.title);
  },
};

/* -------------------------------------------------------------------------- */
/* Reviews                                                                     */
/* -------------------------------------------------------------------------- */

export const reviews = {
  async forTitle(tmdbId: number, mediaType: MediaType): Promise<Review[]> {
    if (isDemo()) return demo.reviewsFor(tmdbId);
    const res = await client.get(`/reviews/title/${tmdbId}/${mediaType}`);
    return res.data.reviews ?? res.data;
  },
  async byUser(userId: number): Promise<Review[]> {
    if (isDemo()) return demo.reviewsBy(userId);
    const res = await client.get(`/reviews/user/${userId}`);
    return res.data.reviews ?? res.data;
  },
  async upsert(input: { tmdb_id: number; media_type: MediaType; rating: number; body: string; contains_spoilers?: boolean }) {
    if (isDemo()) return demo.upsertReview(input);
    const res = await client.post('/reviews', input);
    return res.data;
  },
  async remove(id: number) {
    if (isDemo()) return demo.deleteReview(id);
    await client.delete(`/reviews/${id}`);
  },
  async react(id: number, reaction: 'like' | 'dislike') {
    if (isDemo()) return demo.reactToReview(id, reaction);
    await client.post(`/reviews/${id}/react`, { reaction });
  },
  /** Average of user ratings, shown next to the TMDB score. — issue #111 */
  async average(tmdbId: number, mediaType: MediaType): Promise<{ avg: number; count: number }> {
    if (isDemo()) return demo.averageRating(tmdbId);
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
    if (isDemo()) return demo.allProgress();
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
    if (isDemo()) return demo.progress(mediaType, tmdbId);
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
    if (isDemo()) return demo.setEpisode(tmdbId, season, episode, watched, cascade);
    await client.post('/watchlist/progress', {
      show_id: tmdbId, season_number: season, episode_number: episode, watched, cascade,
    });
  },

  /** Marks a movie watched — parity with shows. — issue #33 */
  async setMovieWatched(tmdbId: number, watched: boolean) {
    if (isDemo()) return demo.setMovieWatched(tmdbId, watched);
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
    if (isDemo()) return demo.activity(scope).slice(0, limit);
    const res = await client.get(scope === 'me' ? '/activity/user' : '/activity/global', {
      params: { limit },
    });
    return res.data.activities ?? res.data;
  },
};

export const notifications = {
  async all(): Promise<Notification[]> {
    if (isDemo()) return demo.notifications();
    const res = await client.get('/notifications/user');
    return res.data.notifications ?? res.data;
  },
  async setRead(id: number, read: boolean) {
    if (isDemo()) return demo.markRead(id, read);
    await client.post(`/notifications/user/${id}/${read ? 'read' : 'unread'}`);
  },
  async readAll() {
    if (isDemo()) return demo.markAllRead();
    await client.post('/notifications/user/read-all');
  },
  async remove(id: number) {
    if (isDemo()) return demo.removeNotification(id);
    await client.delete(`/notifications/user/${id}`);
  },
};

export const settings = {
  async get(): Promise<UserSettings> {
    if (isDemo()) {
      const s = demo.settings();
      return { user_id: demo.me().id, theme: 'custom', ...s };
    }
    const res = await client.get('/settings');
    return res.data;
  },
  async update(patch: Partial<UserSettings>) {
    if (isDemo()) {
      demo.updateSettings({
        displayed_list: patch.displayed_list ?? undefined,
        pinned_lists: patch.pinned_lists,
        pinned_clubs: patch.pinned_clubs,
      });
      return;
    }
    await client.put('/settings', patch);
  },
};

export const stats = {
  async forUser(userId: number): Promise<UserStats> {
    if (isDemo()) return demo.stats(userId);
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

export { resetDemo };
