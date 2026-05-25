export interface User {
  id: number;
  username?: string;
  nickname: string | null;
  bio?: string;
  profile_picture?: string | null;
  banner?: string | null;
  banner_pos_y?: number;
  banner_size?: string;
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
  time_ago: string;
  actor?: User;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  time_ago: string;
  data: Record<string, unknown>;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_url: string | null;
  order: number;
}

export interface TMDBResult {
  id: number;
  media_type: 'movie' | 'tv';
  title: string;
  overview: string;
  poster_url: string | null;
  backdrop_url: string | null;
  release_date: string;
  rating: number;
  popularity: number;
  genre_ids: number[];
  // Rich fields from backend search.py
  tagline?: string | null;
  status?: string | null;
  homepage?: string | null;
  imdb_id?: string | null;
  original_language?: string | null;
  genres?: string[];
  cast?: CastMember[];
  trailer_key?: string | null;
  tmdb_url?: string | null;
  // Movie-specific
  runtime?: number;
  // TV-specific
  number_of_seasons?: number;
  number_of_episodes?: number;
  episode_run_time?: number[];
  in_production?: boolean;
  created_by?: { id: number; name: string; profile_url: string | null }[];
  seasons?: { season_number: number; episode_count: number }[];
}

export interface UserSettings {
  user_id: number;
  displayed_list: number | null;
  pinned_lists: number[];
  pinned_clubs: number[];
  theme: string;
}

export interface ShowProgress {
  id: number;
  user_id: number;
  show_id: number;
  season_number: number;
  episode_number: number;
  watched: boolean;
  created_at?: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}
