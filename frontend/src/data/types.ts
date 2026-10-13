export type MediaType = 'movie' | 'tv';

export interface User {
  id: number;
  username: string;
  nickname: string | null;
  bio?: string;
  profile_picture?: string | null;
  banner?: string | null;
  banner_pos_y?: number;
  pinned_list_ids?: number[];
  pinned_club_ids?: number[];
  created_at?: string;
  /** Only on a profile fetched by username. */
  lists?: List[];
}

export interface Movie {
  id: number;
  title: string;
  poster_url: string | null;
  tmdb_id?: number;
  user_id: number;
  runtime?: number;
  release_date?: string;
  added_at?: string;
  watched?: boolean;
}

export interface Show {
  id: number;
  title: string;
  poster_url: string | null;
  tmdb_id?: number;
  user_id: number;
  total_seasons: number;
  current_season: number | null;
  current_episode: number | null;
  seasons: { season_number: number; episode_count: number }[];
  release_date?: string;
  added_at?: string;
}

/**
 * A row inside a list. Both the live backend (which splits movies and shows)
 * and Demo Mode normalise to this so the UI only deals with one shape.
 */
export interface ListItem {
  id: number;
  list_id: number;
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  poster_url: string | null;
  runtime?: number;
  total_episodes?: number;
  seasons?: { season_number: number; episode_count: number }[];
  release_date?: string;
  added_at: string;
  watched?: boolean;
}

export interface List {
  id: number;
  name: string;
  user_id: number | null;
  club_id: number | null;
  type: 'personal' | 'club';
  movie_count: number;
  show_count: number;
  movies?: Movie[];
  shows?: Show[];
  items?: ListItem[];
  /** Client-side ordering, persisted locally. — issue #7 / #24 */
  order?: number;
  created_at?: string;
  updated_at?: string;
  /** Set when the list has a public share link (owner only). */
  share_token?: string | null;
}

export interface Club {
  id: number;
  name: string;
  description: string;
  image_url?: string | null;
  admin_id: number;
  mod_ids?: number[];
  helper_ids?: number[];
  created_at: string;
  member_count: number;
  members?: User[];
  lists?: List[];
}

export interface Activity {
  id: number;
  event_type: string;
  user_id: number | null;
  club_id: number | null;
  list_id: number | null;
  movie_id: number | null;
  show_id: number | null;
  description: string;
  data: Record<string, unknown>;
  created_at: string;
  time_ago?: string;
  actor?: User;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  time_ago?: string;
  data: Record<string, unknown>;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_url: string | null;
  order: number;
}

export interface PersonCredit {
  id: number;
  media_type: MediaType;
  title: string;
  poster_url: string | null;
  release_date: string;
  rating: number | null;
  popularity: number;
  role: string;
}

export interface PersonDetails {
  id: number;
  name: string;
  profile_url: string | null;
  department: string;
  biography: string;
  credits: PersonCredit[];
}

export interface TitleRef {
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  poster_url: string | null;
}

export interface TMDBResult {
  id: number;
  media_type: MediaType;
  title: string;
  overview: string;
  poster_url: string | null;
  backdrop_url: string | null;
  release_date: string;
  rating: number;
  popularity: number;
  genres?: string[];
  tagline?: string | null;
  status?: string | null;
  runtime?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: { season_number: number; episode_count: number }[];
  cast?: CastMember[];
  tmdb_url?: string | null;
  trailer_key?: string | null;
  /** Streaming / rent / buy options for the viewer's country, when TMDB has any. */
  providers?: WatchProviders | null;
  similar?: {
    id: number;
    media_type: MediaType;
    title: string;
    poster_url: string | null;
    release_date: string | null;
    rating: number | null;
  }[];
}

export interface WatchProvider {
  name: string;
  logo_url: string | null;
}

export interface WatchProviders {
  region: string;
  link: string | null;
  stream: WatchProvider[];
  rent: WatchProvider[];
  buy: WatchProvider[];
}

/** One episode as TMDB describes it. */
export interface EpisodeInfo {
  episode_number: number;
  name: string;
  overview: string;
  air_date: string;
  runtime: number | null;
}

/** The next episode still to air for a series in the user's lists. */
export interface UpcomingEpisode {
  show_id: number;
  title: string;
  poster_url: string | null;
  air_date: string;
  season_number: number;
  episode_number: number;
  name: string;
}

export interface ReviewComment {
  id: number;
  review_id: number;
  user_id: number;
  content: string;
  created_at: string;
  author: Pick<User, 'id' | 'username' | 'nickname' | 'profile_picture'> | null;
}

/** What a public share link exposes: no ids, no usernames. */
export interface SharedList {
  name: string;
  owner: string;
  is_club: boolean;
  items: { tmdb_id: number; media_type: MediaType; title: string; poster_url: string | null }[];
}

/** An actor or crew member from search. */
export interface PersonResult {
  id: number;
  name: string;
  profile_url: string | null;
  department: string;
}

export interface Review {
  id: number;
  user_id: number;
  tmdb_id: number;
  media_type: MediaType;
  title?: string;
  poster_url?: string | null;
  rating: number;
  body: string;
  contains_spoilers?: boolean;
  created_at: string;
  updated_at?: string;
  likes: number;
  dislikes: number;
  my_reaction?: 'like' | 'dislike' | null;
  user?: User;
  comment_count?: number;
}

export interface UserSettings {
  user_id: number;
  displayed_list: number | null;
  pinned_lists: number[];
  pinned_clubs: number[];
  theme: string;
}

/** One watch event, used by the contribution heatmap. — issue #44 */
export interface WatchEvent {
  date: string; // YYYY-MM-DD
  count: number;
  minutes: number;
}

/** Aggregate profile numbers. — issue #39 */
export interface UserStats {
  titles: number;
  movies: number;
  episodes: number;
  minutes: number;
  reviews: number;
  avgRating: number;
  rewatches: number;
  streak: number;
  heatmap: WatchEvent[];
  topGenres: { name: string; count: number }[];
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

export interface Friendship {
  id: number;
  user: User;
  status: 'pending' | 'accepted' | 'incoming';
  since: string;
}
