/* ============================================================================
   Demo Mode store.

   A complete, persistent, in-browser replica of the Palace backend so the app
   is fully explorable without Python, a database or a TMDB key. State lives in
   localStorage under `palace.demo.v1` and can be reset from Settings.
   ========================================================================== */

import { isoDay } from '@/lib/format';
import type {
  Activity, Club, Friendship, List, ListItem, MediaType, Notification, Review,
  User, UserStats, WatchEvent,
} from '../types';
import { CATALOG, findTitle } from './catalog';

const KEY = 'palace.demo.v1';

interface ProgressEntry {
  /** "s1e4" keys of watched episodes. */
  episodes: string[];
  watched: boolean;       // movies
  minutes: number;        // total watched minutes
  updated: string;
}

interface DemoState {
  seq: number;
  me: number;
  users: User[];
  lists: List[];
  items: ListItem[];
  clubs: Club[];
  clubMembers: { club_id: number; user_id: number }[];
  reviews: Review[];
  activity: Activity[];
  notifications: Notification[];
  friends: Friendship[];
  progress: Record<string, ProgressEntry>;
  events: WatchEvent[];
  settings: { displayed_list: number | null; pinned_lists: number[]; pinned_clubs: number[] };
}

let state: DemoState;

/* ------------------------------------------------------------------ helpers */
const nextId = () => ++state.seq;
const now = () => new Date().toISOString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86400_000).toISOString();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* quota */ }
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function progressKey(mediaType: MediaType, tmdbId: number) {
  return `${mediaType}:${tmdbId}`;
}

/* --------------------------------------------------------------------- seed */
const DEFAULT_LISTS = ['Want to watch', 'Currently watching', 'Watched', 'Favourites'];

function seed(): DemoState {
  const s: DemoState = {
    seq: 100,
    me: 1,
    users: [],
    lists: [],
    items: [],
    clubs: [],
    clubMembers: [],
    reviews: [],
    activity: [],
    notifications: [],
    friends: [],
    progress: {},
    events: [],
    settings: { displayed_list: null, pinned_lists: [], pinned_clubs: [] },
  };
  state = s;

  const people: [string, string, string][] = [
    ['you', 'You', 'Watching too much, sleeping too little. Currently on a slow-cinema kick.'],
    ['mara', 'Mara', 'Horror apologist. Will defend the third act of anything.'],
    ['dev', 'Dev', 'Documentaries and long walks.'],
    ['pilar', 'Pilar', 'Animation, always. Ask me about frame rates.'],
    ['sasha', 'Sasha', 'Three shows at once, none of them finished.'],
    ['june', 'June', 'Comfort rewatches only.'],
  ];
  people.forEach(([username, nickname, bio], i) => {
    s.users.push({
      id: i + 1,
      username,
      nickname,
      bio,
      profile_picture: null,
      banner: null,
      created_at: daysAgo(400 - i * 30),
    });
  });
  s.seq = 100;

  // Lists ---------------------------------------------------------------
  DEFAULT_LISTS.forEach((name, i) => {
    s.lists.push({
      id: nextId(), name, user_id: 1, club_id: null, type: 'personal',
      movie_count: 0, show_count: 0, order: i, created_at: daysAgo(300),
    });
  });
  ['Rainy Sunday', 'Best of 2025'].forEach((name, i) => {
    s.lists.push({
      id: nextId(), name, user_id: 1, club_id: null, type: 'personal',
      movie_count: 0, show_count: 0, order: 4 + i, created_at: daysAgo(120 - i * 40),
    });
  });

  const byName = (n: string) => s.lists.find((l) => l.name === n)!;
  const add = (listName: string, tmdbId: number, ago: number, watched = false) => {
    const t = findTitle(tmdbId);
    if (!t) return;
    s.items.push({
      id: nextId(),
      list_id: byName(listName).id,
      tmdb_id: t.id,
      media_type: t.media_type,
      title: t.title,
      poster_url: t.poster_url,
      runtime: t.runtime,
      total_episodes: t.number_of_episodes,
      seasons: t.seasons,
      release_date: t.release_date,
      added_at: daysAgo(ago),
      watched,
    });
  };

  add('Want to watch', 9004, 12); add('Want to watch', 9010, 20);
  add('Want to watch', 9013, 4);  add('Want to watch', 9511, 30);
  add('Want to watch', 9017, 8);  add('Want to watch', 9015, 44);
  add('Currently watching', 9501, 6); add('Currently watching', 9504, 2);
  add('Currently watching', 9507, 11); add('Currently watching', 9002, 3);
  add('Watched', 9005, 60, true); add('Watched', 9009, 26, true);
  add('Watched', 9502, 90, true); add('Watched', 9001, 130, true);
  add('Watched', 9003, 180, true); add('Watched', 9505, 210, true);
  add('Watched', 9016, 42, true); add('Watched', 9510, 75, true);
  add('Favourites', 9005, 58); add('Favourites', 9502, 88); add('Favourites', 9009, 25);
  add('Rainy Sunday', 9007, 15); add('Rainy Sunday', 9003, 15); add('Rainy Sunday', 9509, 15);
  add('Best of 2025', 9009, 30); add('Best of 2025', 9018, 22); add('Best of 2025', 9504, 22);

  s.settings.displayed_list = byName('Currently watching').id;
  s.settings.pinned_lists = [byName('Currently watching').id, byName('Want to watch').id];

  // Clubs ---------------------------------------------------------------
  const clubSeeds: [string, string, number[]][] = [
    ['Sunday Cinema', 'Weekly picks, no phones, opinions encouraged.', [1, 2, 3, 5]],
    ['Deep Cuts', 'Obscure, difficult, occasionally brilliant.', [1, 4, 6]],
    ['Anime Night', 'One cour at a time. Subs, always.', [2, 4, 5, 6]],
  ];
  clubSeeds.forEach(([name, description, members], i) => {
    const id = nextId();
    s.clubs.push({
      id, name, description, image_url: null, admin_id: members[0],
      mod_ids: members.slice(1, 2), helper_ids: [], created_at: daysAgo(250 - i * 40),
      member_count: members.length,
    });
    members.forEach((u) => s.clubMembers.push({ club_id: id, user_id: u }));
    const listId = nextId();
    s.lists.push({
      id: listId, name: `${name} queue`, user_id: null, club_id: id, type: 'club',
      movie_count: 0, show_count: 0, order: 0, created_at: daysAgo(240 - i * 40),
    });
    [9013, 9006, 9503][i] && s.items.push({
      id: nextId(), list_id: listId, tmdb_id: [9013, 9006, 9503][i],
      media_type: findTitle([9013, 9006, 9503][i])!.media_type,
      title: findTitle([9013, 9006, 9503][i])!.title,
      poster_url: findTitle([9013, 9006, 9503][i])!.poster_url,
      added_at: daysAgo(10), watched: false,
    });
  });
  s.settings.pinned_clubs = [s.clubs[0].id];

  // Reviews --------------------------------------------------------------
  const reviewSeeds: [number, number, number, string, boolean][] = [
    [1, 9005, 9, 'The hearing-loss sequence is the best twenty minutes of film I saw all year. **No notes.**', false],
    [1, 9009, 10, 'Every frame is a painting and I mean that in the least annoying way possible.', false],
    [2, 9010, 6, 'Genuinely scared me twice, bored me once. Net positive.', true],
    [3, 9011, 8, 'Slow, patient, gorgeous. Watch it on the biggest screen you can find.', false],
    [4, 9509, 9, 'The best thing on television and it is aimed at seven year olds.', false],
    [5, 9501, 8, 'Season two loses the thread a little but the finale earns it back.', true],
    [2, 9005, 8, 'Overrated by about one point, which still makes it very good.', false],
    [6, 9502, 10, 'I have rewatched the town hall episode four times.', false],
  ];
  reviewSeeds.forEach(([userId, tmdbId, rating, body, spoilers], i) => {
    const t = findTitle(tmdbId)!;
    s.reviews.push({
      id: nextId(), user_id: userId, tmdb_id: tmdbId, media_type: t.media_type,
      title: t.title, poster_url: t.poster_url, rating, body,
      contains_spoilers: spoilers, created_at: daysAgo(60 - i * 6),
      likes: (i * 3) % 7, dislikes: i % 2, my_reaction: null,
    });
  });

  // Friends --------------------------------------------------------------
  s.friends = [
    { id: nextId(), user: s.users[1], status: 'accepted', since: daysAgo(120) },
    { id: nextId(), user: s.users[3], status: 'accepted', since: daysAgo(64) },
    { id: nextId(), user: s.users[4], status: 'incoming', since: daysAgo(2) },
  ];

  // Watch history + progress ---------------------------------------------
  const watchedShows = [9501, 9504, 9507, 9502];
  watchedShows.forEach((id, idx) => {
    const t = findTitle(id)!;
    const eps: string[] = [];
    const seasons = t.seasons ?? [];
    const upto = idx === 3 ? seasons.length : 1;
    seasons.slice(0, upto).forEach((se, si) => {
      const cap = si === upto - 1 && idx !== 3 ? Math.ceil(se.episode_count * 0.6) : se.episode_count;
      for (let e = 1; e <= cap; e++) eps.push(`s${se.season_number}e${e}`);
    });
    s.progress[progressKey('tv', id)] = {
      episodes: eps, watched: idx === 3, minutes: eps.length * 45, updated: daysAgo(idx * 3),
    };
  });
  [9005, 9009, 9001, 9003, 9016, 9502].forEach((id, i) => {
    const t = findTitle(id)!;
    if (t.media_type !== 'movie') return;
    s.progress[progressKey('movie', id)] = {
      episodes: [], watched: true, minutes: t.runtime ?? 110, updated: daysAgo(i * 9 + 3),
    };
  });

  // Heatmap: ~10 months of plausible activity
  const events: WatchEvent[] = [];
  for (let d = 300; d >= 0; d--) {
    const date = new Date(Date.now() - d * 86400_000);
    const weekend = [0, 6].includes(date.getDay());
    const roll = Math.random();
    const chance = weekend ? 0.62 : 0.3;
    if (roll < chance) {
      const count = 1 + Math.floor(Math.random() * (weekend ? 4 : 2));
      events.push({ date: isoDay(date), count, minutes: count * (35 + Math.floor(Math.random() * 60)) });
    }
  }
  // Guarantee the last few days so the demo opens with a believable streak.
  for (let d = 2; d >= 0; d--) {
    const day = isoDay(new Date(Date.now() - d * 86400_000));
    if (!events.some((e) => e.date === day)) {
      events.push({ date: day, count: 1 + (d % 2), minutes: 45 + d * 20 });
    }
  }
  s.events = events;

  // Activity feed --------------------------------------------------------
  const feed: [number, string, string, number][] = [
    [2, 'review', 'reviewed **Static Bloom**', 1],
    [1, 'watched', 'finished **Gilded Static** season 1', 2],
    [3, 'list', 'created the list **Slow Cinema**', 3],
    [4, 'club', 'joined **Anime Night**', 4],
    [1, 'added', 'added 3 titles to **Want to watch**', 5],
    [5, 'progress', 'is 60% through **Second Sun**', 6],
    [6, 'review', 'reviewed **The Provincial**', 8],
    [2, 'club', 'created the club **Deep Cuts**', 11],
    [1, 'review', 'reviewed **Vermilion**', 13],
    [3, 'watched', 'watched **Latitude Zero**', 16],
  ];
  feed.forEach(([userId, type, description, ago]) => {
    s.activity.push({
      id: nextId(), event_type: type, user_id: userId, club_id: null, list_id: null,
      movie_id: null, show_id: null, description, data: {}, created_at: daysAgo(ago),
      actor: s.users.find((u) => u.id === userId),
    });
  });

  // Notifications --------------------------------------------------------
  const notes: [string, string, string, number, boolean][] = [
    ['friend', 'Friend request', 'Sasha wants to be friends.', 2, false],
    ['club', 'Club invite', 'Pilar invited you to Anime Night.', 3, false],
    ['review', 'New reaction', 'Mara liked your review of Vermilion.', 5, true],
    ['activity', 'Club pick', 'Sunday Cinema picked Midnight Cartographers for this week.', 7, true],
  ];
  notes.forEach(([type, title, message, ago, read]) => {
    s.notifications.push({
      id: nextId(), type, title, message, is_read: read,
      created_at: daysAgo(ago), data: {},
    });
  });

  return s;
}

export function loadDemo(): DemoState {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      state = JSON.parse(raw) as DemoState;
      if (state.users?.length) return state;
    }
  } catch { /* fall through to reseed */ }
  state = seed();
  persist();
  return state;
}

export function resetDemo() {
  state = seed();
  persist();
}

/* =========================================================================
   Queries + mutations
   ====================================================================== */

function withItems(l: List): List {
  const items = state.items
    .filter((i) => i.list_id === l.id)
    .sort((a, b) => (a.id > b.id ? 1 : -1));
  return {
    ...l,
    items,
    movie_count: items.filter((i) => i.media_type === 'movie').length,
    // Counting shows too — settings used to only count movies. (issue #46)
    show_count: items.filter((i) => i.media_type === 'tv').length,
  };
}

export const demo = {
  /* -- session -------------------------------------------------------- */
  me(): User {
    const s = loadDemo();
    return s.users.find((u) => u.id === s.me)!;
  },
  updateProfile(patch: Partial<User>): User {
    const s = loadDemo();
    const me = s.users.find((u) => u.id === s.me)!;
    Object.assign(me, patch);
    persist();
    return clone(me);
  },

  /* -- lists ---------------------------------------------------------- */
  lists(): List[] {
    const s = loadDemo();
    return s.lists
      .filter((l) => l.type === 'personal' && l.user_id === s.me)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map(withItems);
  },
  list(id: number): List | null {
    const s = loadDemo();
    const l = s.lists.find((x) => x.id === id);
    return l ? withItems(l) : null;
  },
  createList(name: string, clubId: number | null = null): List {
    const s = loadDemo();
    const l: List = {
      id: nextId(), name, user_id: clubId ? null : s.me, club_id: clubId,
      type: clubId ? 'club' : 'personal', movie_count: 0, show_count: 0,
      order: s.lists.length, created_at: now(),
    };
    s.lists.push(l);
    demo.log('list', `created the list **${name}**`);
    persist();
    return withItems(l);
  },
  renameList(id: number, name: string) {
    const s = loadDemo();
    const l = s.lists.find((x) => x.id === id);
    if (l) l.name = name;
    persist();
  },
  deleteList(id: number) {
    const s = loadDemo();
    s.lists = s.lists.filter((l) => l.id !== id);
    s.items = s.items.filter((i) => i.list_id !== id);
    s.settings.pinned_lists = s.settings.pinned_lists.filter((x) => x !== id);
    if (s.settings.displayed_list === id) s.settings.displayed_list = null;
    persist();
  },
  reorderLists(ids: number[]) {
    const s = loadDemo();
    ids.forEach((id, i) => {
      const l = s.lists.find((x) => x.id === id);
      if (l) l.order = i;
    });
    persist();
  },

  /** Which of my lists already contain this title. — issue #50 */
  listsContaining(tmdbId: number): List[] {
    const s = loadDemo();
    const listIds = new Set(s.items.filter((i) => i.tmdb_id === tmdbId).map((i) => i.list_id));
    return s.lists.filter((l) => listIds.has(l.id));
  },

  addToList(listId: number, title: { tmdb_id: number; media_type: MediaType; title: string; poster_url: string | null }) {
    const s = loadDemo();
    if (s.items.some((i) => i.list_id === listId && i.tmdb_id === title.tmdb_id)) return;
    const meta = findTitle(title.tmdb_id);
    s.items.push({
      id: nextId(), list_id: listId, ...title,
      runtime: meta?.runtime, total_episodes: meta?.number_of_episodes, seasons: meta?.seasons,
      release_date: meta?.release_date, added_at: now(), watched: false,
    });
    const list = s.lists.find((l) => l.id === listId);
    demo.log('added', `added **${title.title}** to **${list?.name ?? 'a list'}**`);
    persist();
  },
  removeFromList(listId: number, itemId: number) {
    const s = loadDemo();
    s.items = s.items.filter((i) => !(i.id === itemId && i.list_id === listId));
    persist();
  },
  reorderItems(listId: number, ids: number[]) {
    const s = loadDemo();
    const others = s.items.filter((i) => i.list_id !== listId);
    const mine = ids
      .map((id) => s.items.find((i) => i.id === id))
      .filter(Boolean) as ListItem[];
    s.items = [...others, ...mine];
    persist();
  },

  /* -- clubs ---------------------------------------------------------- */
  clubs(): { my_clubs: Club[]; all_clubs: Club[] } {
    const s = loadDemo();
    const decorate = (c: Club): Club => {
      const memberIds = s.clubMembers.filter((m) => m.club_id === c.id).map((m) => m.user_id);
      return {
        ...c,
        member_count: memberIds.length,
        members: memberIds.map((id) => s.users.find((u) => u.id === id)!).filter(Boolean),
        lists: s.lists.filter((l) => l.club_id === c.id).map(withItems),
      };
    };
    const all = s.clubs.map(decorate);
    const mine = all.filter((c) => c.members?.some((m) => m.id === s.me));
    return { my_clubs: mine, all_clubs: all };
  },
  club(id: number): Club | null {
    return demo.clubs().all_clubs.find((c) => c.id === id) ?? null;
  },
  createClub(name: string, description: string): Club {
    const s = loadDemo();
    const c: Club = {
      id: nextId(), name, description, image_url: null, admin_id: s.me,
      mod_ids: [], helper_ids: [], created_at: now(), member_count: 1,
    };
    s.clubs.push(c);
    s.clubMembers.push({ club_id: c.id, user_id: s.me });
    demo.log('club', `created the club **${name}**`);
    persist();
    return demo.club(c.id)!;
  },
  joinClub(id: number) {
    const s = loadDemo();
    if (!s.clubMembers.some((m) => m.club_id === id && m.user_id === s.me)) {
      s.clubMembers.push({ club_id: id, user_id: s.me });
      demo.log('club', `joined **${s.clubs.find((c) => c.id === id)?.name}**`);
    }
    persist();
  },
  leaveClub(id: number) {
    const s = loadDemo();
    s.clubMembers = s.clubMembers.filter((m) => !(m.club_id === id && m.user_id === s.me));
    s.settings.pinned_clubs = s.settings.pinned_clubs.filter((x) => x !== id);
    persist();
  },

  /* -- users / friends ------------------------------------------------ */
  users(): User[] {
    return clone(loadDemo().users);
  },
  user(username: string): User | null {
    return loadDemo().users.find((u) => u.username === username) ?? null;
  },
  friends(): Friendship[] {
    return clone(loadDemo().friends);
  },
  addFriend(userId: number) {
    const s = loadDemo();
    if (s.friends.some((f) => f.user.id === userId)) return;
    const user = s.users.find((u) => u.id === userId);
    if (!user) return;
    s.friends.push({ id: nextId(), user, status: 'pending', since: now() });
    persist();
  },
  respondFriend(id: number, accept: boolean) {
    const s = loadDemo();
    const f = s.friends.find((x) => x.id === id);
    if (!f) return;
    if (accept) f.status = 'accepted';
    else s.friends = s.friends.filter((x) => x.id !== id);
    persist();
  },
  removeFriend(id: number) {
    const s = loadDemo();
    s.friends = s.friends.filter((f) => f.id !== id);
    persist();
  },

  /* -- reviews -------------------------------------------------------- */
  reviewsFor(tmdbId: number): Review[] {
    const s = loadDemo();
    return s.reviews
      .filter((r) => r.tmdb_id === tmdbId)
      .map((r) => ({ ...r, user: s.users.find((u) => u.id === r.user_id) }))
      .sort((a, b) => b.likes - a.likes);
  },
  reviewsBy(userId: number): Review[] {
    const s = loadDemo();
    return s.reviews
      .filter((r) => r.user_id === userId)
      .map((r) => ({ ...r, user: s.users.find((u) => u.id === r.user_id) }))
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  },
  upsertReview(input: { tmdb_id: number; media_type: MediaType; rating: number; body: string; contains_spoilers?: boolean }): Review {
    const s = loadDemo();
    const existing = s.reviews.find((r) => r.tmdb_id === input.tmdb_id && r.user_id === s.me);
    const t = findTitle(input.tmdb_id);
    if (existing) {
      Object.assign(existing, input, { updated_at: now() });
      persist();
      return clone(existing);
    }
    const r: Review = {
      id: nextId(), user_id: s.me, ...input, title: t?.title, poster_url: t?.poster_url ?? null,
      created_at: now(), likes: 0, dislikes: 0, my_reaction: null,
    };
    s.reviews.push(r);
    demo.log('review', `reviewed **${t?.title ?? 'a title'}**`);
    persist();
    return clone(r);
  },
  deleteReview(id: number) {
    const s = loadDemo();
    s.reviews = s.reviews.filter((r) => r.id !== id);
    persist();
  },
  reactToReview(id: number, reaction: 'like' | 'dislike') {
    const s = loadDemo();
    const r = s.reviews.find((x) => x.id === id);
    if (!r) return;
    if (r.my_reaction === reaction) {
      r[reaction === 'like' ? 'likes' : 'dislikes'] -= 1;
      r.my_reaction = null;
    } else {
      if (r.my_reaction) r[r.my_reaction === 'like' ? 'likes' : 'dislikes'] -= 1;
      r[reaction === 'like' ? 'likes' : 'dislikes'] += 1;
      r.my_reaction = reaction;
    }
    persist();
  },
  averageRating(tmdbId: number): { avg: number; count: number } {
    const rs = loadDemo().reviews.filter((r) => r.tmdb_id === tmdbId);
    if (!rs.length) return { avg: 0, count: 0 };
    return { avg: rs.reduce((a, r) => a + r.rating, 0) / rs.length, count: rs.length };
  },

  /* -- progress ------------------------------------------------------- */
  progress(mediaType: MediaType, tmdbId: number): ProgressEntry {
    const s = loadDemo();
    return s.progress[progressKey(mediaType, tmdbId)] ?? { episodes: [], watched: false, minutes: 0, updated: now() };
  },
  allProgress(): Record<string, ProgressEntry> {
    return clone(loadDemo().progress);
  },
  setEpisode(tmdbId: number, season: number, episode: number, watched: boolean, cascade: boolean) {
    const s = loadDemo();
    const key = progressKey('tv', tmdbId);
    const entry = s.progress[key] ?? { episodes: [], watched: false, minutes: 0, updated: now() };
    const t = findTitle(tmdbId);
    const set = new Set(entry.episodes);

    if (watched) {
      set.add(`s${season}e${episode}`);
      // Mark everything before it too, when the user opted in. — issue #42
      if (cascade && t?.seasons) {
        for (const se of t.seasons) {
          if (se.season_number > season) break;
          const cap = se.season_number === season ? episode : se.episode_count;
          for (let e = 1; e <= cap; e++) set.add(`s${se.season_number}e${e}`);
        }
      }
    } else {
      set.delete(`s${season}e${episode}`);
    }

    entry.episodes = [...set];
    entry.minutes = entry.episodes.length * 45;
    entry.updated = now();
    entry.watched = !!t?.number_of_episodes && entry.episodes.length >= t.number_of_episodes;
    s.progress[key] = entry;
    demo.bump(watched ? 1 : 0, watched ? 45 : 0);
    if (entry.watched) demo.onCompleted(tmdbId, t?.title ?? '');
    persist();
  },
  setMovieWatched(tmdbId: number, watched: boolean) {
    const s = loadDemo();
    const key = progressKey('movie', tmdbId);
    const t = findTitle(tmdbId);
    s.progress[key] = {
      episodes: [], watched, minutes: watched ? t?.runtime ?? 110 : 0, updated: now(),
    };
    if (watched) {
      demo.bump(1, t?.runtime ?? 110);
      demo.onCompleted(tmdbId, t?.title ?? '');
    }
    persist();
  },

  /**
   * When something is finished it leaves the "want to watch" / "currently
   * watching" lists and lands in "watched". — issue #36
   */
  onCompleted(tmdbId: number, title: string) {
    const s = loadDemo();
    const watchedList = s.lists.find((l) => l.user_id === s.me && /^watched$/i.test(l.name));
    const drop = s.lists.filter(
      (l) => l.user_id === s.me && /^(want to watch|currently watching)$/i.test(l.name),
    );
    const dropIds = new Set(drop.map((l) => l.id));
    const existing = s.items.find((i) => i.tmdb_id === tmdbId && dropIds.has(i.list_id));
    s.items = s.items.filter((i) => !(i.tmdb_id === tmdbId && dropIds.has(i.list_id)));
    if (watchedList && !s.items.some((i) => i.list_id === watchedList.id && i.tmdb_id === tmdbId)) {
      const meta = findTitle(tmdbId);
      s.items.push({
        id: nextId(), list_id: watchedList.id, tmdb_id: tmdbId,
        media_type: meta?.media_type ?? existing?.media_type ?? 'movie',
        title, poster_url: meta?.poster_url ?? null, added_at: now(), watched: true,
        runtime: meta?.runtime, total_episodes: meta?.number_of_episodes, seasons: meta?.seasons,
      });
    }
    demo.log('watched', `finished **${title}**`);
  },

  bump(count: number, minutes: number) {
    if (!count) return;
    const s = loadDemo();
    const today = isoDay(new Date());
    const e = s.events.find((x) => x.date === today);
    if (e) { e.count += count; e.minutes += minutes; }
    else s.events.push({ date: today, count, minutes });
  },

  /* -- stats ---------------------------------------------------------- */
  stats(userId: number): UserStats {
    const s = loadDemo();
    const mine = userId === s.me;
    const reviews = s.reviews.filter((r) => r.user_id === userId);
    const progressEntries = Object.entries(s.progress);
    const episodes = progressEntries.reduce((a, [, p]) => a + p.episodes.length, 0);
    const movies = progressEntries.filter(([k, p]) => k.startsWith('movie:') && p.watched).length;
    const minutes = progressEntries.reduce((a, [, p]) => a + p.minutes, 0);

    // Streak of consecutive days with activity
    const days = new Set(s.events.map((e) => e.date));
    let streak = 0;
    for (let d = 0; d < 400; d++) {
      const key = isoDay(new Date(Date.now() - d * 86400_000));
      if (days.has(key)) streak++;
      else if (d > 0) break;
    }

    const genreCount = new Map<string, number>();
    s.items
      .filter((i) => s.lists.find((l) => l.id === i.list_id)?.user_id === userId)
      .forEach((i) => {
        findTitle(i.tmdb_id)?.genres?.forEach((g) => genreCount.set(g, (genreCount.get(g) ?? 0) + 1));
      });

    return {
      titles: mine ? new Set(s.items.map((i) => i.tmdb_id)).size : 24,
      movies: mine ? movies : 12,
      episodes: mine ? episodes : 210,
      minutes: mine ? minutes : 15_400,
      reviews: reviews.length,
      avgRating: reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0,
      rewatches: mine ? 7 : 3,
      streak,
      heatmap: mine ? clone(s.events) : clone(s.events).filter((_, i) => i % 2 === 0),
      topGenres: [...genreCount.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
    };
  },

  /* -- activity / notifications --------------------------------------- */
  log(type: string, description: string) {
    const s = loadDemo();
    s.activity.unshift({
      id: nextId(), event_type: type, user_id: s.me, club_id: null, list_id: null,
      movie_id: null, show_id: null, description, data: {}, created_at: now(),
      actor: s.users.find((u) => u.id === s.me),
    });
    s.activity = s.activity.slice(0, 120);
  },
  activity(scope: 'global' | 'me'): Activity[] {
    const s = loadDemo();
    const rows = scope === 'me' ? s.activity.filter((a) => a.user_id === s.me) : s.activity;
    return clone(rows).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  },
  notifications(): Notification[] {
    return clone(loadDemo().notifications).sort(
      (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
    );
  },
  markRead(id: number, read = true) {
    const s = loadDemo();
    const n = s.notifications.find((x) => x.id === id);
    if (n) n.is_read = read;
    persist();
  },
  markAllRead() {
    loadDemo().notifications.forEach((n) => { n.is_read = true; });
    persist();
  },
  removeNotification(id: number) {
    const s = loadDemo();
    s.notifications = s.notifications.filter((n) => n.id !== id);
    persist();
  },

  /* -- settings -------------------------------------------------------- */
  settings() {
    return clone(loadDemo().settings);
  },
  updateSettings(patch: Partial<DemoState['settings']>) {
    const s = loadDemo();
    Object.assign(s.settings, patch);
    persist();
  },

  /* -- search ---------------------------------------------------------- */
  catalog: CATALOG,
};
