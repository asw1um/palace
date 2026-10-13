/* ============================================================================
   One API surface for the whole app.

   Every function either talks to the Flask backend (`live`) or to the in-browser
   Demo store. Pages never need to know which.
   ========================================================================== */

import { client, readFile, TOKEN_KEY } from './client';
import { rank } from '@/lib/fuzzy';
import { episodeKey, type SeasonInfo } from '@/lib/episodes';
import type {
  Activity, AuthResponse, Club, EpisodeInfo, Friendship, List, ListItem, MediaType,
  Notification, PersonDetails, PersonResult, Review, ReviewComment, SharedList, TMDBResult,
  UpcomingEpisode, User, UserSettings, UserStats,
} from './types';

/** Two-letter country from the browser's language (en-GB -> GB), for "where to watch". */
function region(): string {
  const code = typeof navigator === 'undefined' ? '' : navigator.language.split('-')[1] ?? '';
  return /^[A-Za-z]{2}$/.test(code) ? code.toUpperCase() : 'US';
}

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

  /** Changing the password signs every other device out and returns a fresh token for this one. */
  async changePassword(current: string, next: string): Promise<void> {
    const res = await client.post('/auth/change-password', { current_password: current, new_password: next });
    localStorage.setItem(TOKEN_KEY, res.data.access_token);
  },

  async deleteAccount(password: string): Promise<void> {
    await client.post('/auth/delete-account', { password });
  },

  /** Everything stored about the account, for the user to keep. */
  async exportData(): Promise<unknown> {
    return (await client.get('/auth/export')).data;
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
    const res = await client.get('/lists/with-movies');
    const rows = ((res.data.lists ?? res.data) as List[]).map(normaliseList);
    return applyOrder(rows, ORDER_KEY, 'mine');
  },

  async one(id: number): Promise<List | null> {
    const res = await client.get(`/lists/${id}`);
    const l = normaliseList((res.data.list ?? res.data) as List);
    return { ...l, items: applyOrder(l.items ?? [], ITEM_ORDER_KEY, String(id)) };
  },

  async create(name: string): Promise<List> {
    const res = await client.post('/lists', { name });
    return normaliseList(res.data.list ?? res.data);
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

  /** Turns on a public read-only link for the list and returns its token. */
  async share(id: number): Promise<string> {
    return (await client.post(`/lists/${id}/share`)).data.token;
  },

  async unshare(id: number): Promise<void> {
    await client.delete(`/lists/${id}/share`);
  },

  /** What a share link shows. Needs no login. */
  async shared(token: string): Promise<SharedList> {
    return (await client.get(`/shared/${encodeURIComponent(token)}`, { silent: true })).data;
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
    const club = res.data.club ?? res.data;
    return {
      ...club,
      // The detail response carries the members themselves rather than a count.
      member_count: club.member_count ?? club.members?.length ?? 0,
      lists: (club.lists ?? []).map(normaliseList),
    };
  },
  async create(name: string, description: string): Promise<Club> {
    const res = await client.post('/clubs', { name, description });
    return res.data.club ?? res.data;
  },
  async join(id: number) {
    await client.post(`/clubs/${id}/join`);
  },
  async leave(id: number) {
    await client.post(`/clubs/${id}/leave`);
  },
  async createList(clubId: number, name: string): Promise<List> {
    const res = await client.post(`/clubs/${clubId}/lists`, { name });
    return normaliseList(res.data.list ?? res.data);
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
    const user = res.data.user ?? res.data;
    return res.data.lists ? { ...user, lists: (res.data.lists as List[]).map(normaliseList) } : user;
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
    const res = await client.get(`/${mediaType === 'tv' ? 'tv' : 'movie'}/${id}`, {
      params: { region: region() },
    });
    return res.data;
  },
  /** Actors and crew matching a name. */
  async people(query: string): Promise<PersonResult[]> {
    if (!query.trim()) return [];
    const res = await client.get('/search/person', { params: { query }, silent: true });
    return res.data.results ?? [];
  },
  /** Real episode names, air dates and runtimes for one season. */
  async season(tmdbId: number, seasonNumber: number): Promise<EpisodeInfo[]> {
    const res = await client.get(`/tv/${tmdbId}/season/${seasonNumber}`, { silent: true });
    return res.data.episodes ?? [];
  },
  /** A cast/crew member plus everything they've worked on. */
  async person(id: number): Promise<PersonDetails | null> {
    const res = await client.get(`/person/${id}/credits`);
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
    comment_count: r.comment_count ?? 0,
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
  async comments(reviewId: number): Promise<ReviewComment[]> {
    return (await client.get(`/reviews/${reviewId}/comments`, { silent: true })).data.comments ?? [];
  },
  async addComment(reviewId: number, content: string): Promise<ReviewComment> {
    return (await client.post(`/reviews/${reviewId}/comments`, { content })).data.comment;
  },
  async removeComment(commentId: number) {
    await client.delete(`/reviews/comments/${commentId}`);
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

export { episodeKey };

/** The episode someone stopped partway through, and how many minutes in. */
export interface WatchPosition {
  season: number;
  episode: number;
  minutes: number;
}

export interface ProgressEntry {
  episodes: string[];
  watched: boolean;
  minutes: number;
  updated: string;
  /** Films: full length the minutes are measured against. */
  total?: number;
  /** Series: a saved spot inside an episode. */
  position?: WatchPosition | null;
}

function toPosition(row: any): WatchPosition | null {
  return row ? { season: row.season_number, episode: row.episode_number, minutes: row.minutes ?? 0 } : null;
}

/** A film counts as watched once the minutes reach its length. */
function filmWatched(minutes: number, total: number): boolean {
  return total > 0 ? minutes >= total : minutes > 0;
}

export const progress = {
  /** Everything the user has watched, keyed by `"movie:123"` / `"tv:456"`. */
  async summary(): Promise<Record<string, ProgressEntry>> {
    try {
      const res = await client.get('/watchlist/all-progress', { silent: true });
      const out: Record<string, ProgressEntry> = {};
      const data = res.data ?? {};
      // Shows come back as { showId: { "season-episode": watched } }.
      for (const [showId, episodes] of Object.entries(data.shows ?? {})) {
        const eps = Object.entries(episodes as Record<string, boolean>)
          .filter(([, v]) => v)
          .map(([k]) => episodeKey(...(k.split('-').map(Number) as [number, number])));
        out[`tv:${showId}`] = { episodes: eps, watched: false, minutes: eps.length * 45, updated: '' };
      }
      for (const [showId, row] of Object.entries(data.positions ?? {})) {
        const key = `tv:${showId}`;
        out[key] = { ...(out[key] ?? { episodes: [], watched: false, minutes: 0, updated: '' }), position: toPosition(row) };
      }
      for (const [movieId, row] of Object.entries(data.movies ?? {})) {
        const { watched_minutes: minutes = 0, total_minutes: total = 0 } = (row ?? {}) as {
          watched_minutes?: number; total_minutes?: number;
        };
        out[`movie:${movieId}`] = { episodes: [], watched: filmWatched(minutes, total), minutes, total, updated: '' };
      }
      return out;
    } catch {
      return {};
    }
  },

  async forTitle(mediaType: MediaType, tmdbId: number) {
    if (mediaType === 'movie') {
      const res = await client.get(`/watchlist/movie-progress/${tmdbId}`, { silent: true }).catch(() => null);
      const watchedMinutes: number = res?.data?.watched_minutes ?? 0;
      const total: number = res?.data?.total_minutes ?? 0;
      return {
        episodes: [], watched: filmWatched(watchedMinutes, total), minutes: watchedMinutes, total,
        updated: '', position: null,
      };
    }
    const res = await client.get(`/watchlist/progress/${tmdbId}`, { silent: true }).catch(() => null);
    const rows: { season_number: number; episode_number: number; watched: boolean }[] =
      res?.data?.progress ?? [];
    const episodes = rows.filter((r) => r.watched).map((r) => episodeKey(r.season_number, r.episode_number));
    return {
      episodes, watched: false, minutes: episodes.length * 45, total: 0, updated: '',
      position: toPosition(res?.data?.position),
    };
  },

  /** Next episodes still to air for series in the user's lists, soonest first. */
  async upcoming(): Promise<UpcomingEpisode[]> {
    const res = await client.get('/watchlist/upcoming', { silent: true, timeout: 60_000 });
    return res.data.episodes ?? [];
  },

  /** Remembers the minute someone stopped at inside an episode. */
  async setPosition(tmdbId: number, season: number, episode: number, minutes: number) {
    await client.put('/watchlist/position', {
      show_id: tmdbId, season_number: season, episode_number: episode, minutes,
    });
  },

  async clearPosition(tmdbId: number) {
    await client.delete(`/watchlist/position/${tmdbId}`);
  },

  /** Sets how far into a film someone is; `total` is the film's length. */
  async setMovieMinutes(tmdbId: number, minutes: number, total: number) {
    await client.post('/watchlist/movie-progress', {
      movie_id: tmdbId, watched_minutes: minutes, total_minutes: total,
    });
  },

  async setEpisode(tmdbId: number, season: number, episode: number, watched: boolean, cascade: boolean) {
    await client.post('/watchlist/progress', {
      show_id: tmdbId, season_number: season, episode_number: episode, watched, cascade,
    });
  },

  /** Marks whole seasons watched or unwatched in one request. */
  async setSeasons(
    tmdbId: number,
    seasons: { season_number: number; episode_count: number }[],
    watched: boolean,
  ) {
    await client.post('/watchlist/bulk-show-progress', { show_id: tmdbId, watched, seasons });
  },

  /** Marks a movie watched — parity with shows. — issue #33 */
  async setMovieWatched(tmdbId: number, watched: boolean, runtime?: number | null) {
    // Callers that know the length (including one the user entered) pass it in.
    const total = runtime || (await discover.details(tmdbId, 'movie').catch(() => null))?.runtime || 100;
    await client.post('/watchlist/movie-progress', {
      movie_id: tmdbId,
      watched_minutes: watched ? total : 0,
      total_minutes: total,
    });
  },
};

/* -------------------------------------------------------------------------- */
/* Custom runtimes and season counts                                           */
/* -------------------------------------------------------------------------- */

/** What a user has overridden for one title, where TMDB is wrong or has nothing. */
export interface CustomMeta {
  tmdb_id: number;
  media_type: MediaType;
  runtime: number | null;
  seasons: SeasonInfo[] | null;
}

export const customMedia = {
  /** Every override the user has saved, keyed like progress: `"movie:123"` / `"tv:456"`. */
  async all(): Promise<Record<string, CustomMeta>> {
    const res = await client.get('/custom-media', { silent: true });
    const out: Record<string, CustomMeta> = {};
    for (const row of (res.data.items ?? []) as CustomMeta[]) out[`${row.media_type}:${row.tmdb_id}`] = row;
    return out;
  },
  async setRuntime(tmdbId: number, runtime: number) {
    await client.put(`/custom-media/movie/${tmdbId}`, { runtime });
  },
  async setSeasons(tmdbId: number, seasons: SeasonInfo[]) {
    await client.put(`/custom-media/tv/${tmdbId}`, { seasons });
  },
  async reset(mediaType: MediaType, tmdbId: number) {
    await client.delete(`/custom-media/${mediaType}/${tmdbId}`);
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
  /** Pass `theirLists` for someone else's profile; without it the viewer's own lists are used. */
  async forUser(userId: number, theirLists?: List[]): Promise<UserStats> {
    // Titles come from lists and ratings from reviews; watch time, streak and the
    // heatmap come from the backend, bucketed into days in this browser's timezone.
    const [myLists, myReviews, watch] = await Promise.all([
      theirLists ? Promise.resolve(theirLists) : lists.all().catch(() => [] as List[]),
      reviews.byUser(userId).catch(() => [] as Review[]),
      client
        .get(`/watchlist/stats/${userId}`, { params: { tz: -new Date().getTimezoneOffset() }, silent: true })
        .then((res) => res.data as Partial<Pick<UserStats, 'episodes' | 'minutes' | 'streak' | 'heatmap'>>)
        .catch(() => null),
    ]);
    const items = myLists.flatMap((l) => l.items ?? []);
    const unique = new Set(items.map((i) => i.tmdb_id));
    return {
      titles: unique.size,
      movies: items.filter((i) => i.media_type === 'movie').length,
      episodes: watch?.episodes ?? 0,
      minutes: watch?.minutes ?? 0,
      reviews: myReviews.length,
      avgRating: myReviews.length
        ? myReviews.reduce((a, r) => a + r.rating, 0) / myReviews.length
        : 0,
      rewatches: 0,
      streak: watch?.streak ?? 0,
      heatmap: watch?.heatmap ?? [],
      topGenres: [],
    };
  },
};

