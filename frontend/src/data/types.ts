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
