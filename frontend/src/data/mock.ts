import type { User, Movie, Show, List, Club, Activity, TMDBResult } from '@/types/api';

export const mockUser: User = {
  id: 1,
  nickname: 'duran',
  profile_picture: null,
  banner: null,
};

export const mockUsers: User[] = [
  { id: 1, nickname: 'duran' },
  { id: 2, nickname: 'sarah' },
  { id: 3, nickname: 'mike' },
  { id: 4, nickname: 'jenna' },
  { id: 5, nickname: 'alex' },
];

// Movies in user's lists (poster_url null = use placeholder)
export const mockMovies: Movie[] = [
  { id: 1, title: 'Inception', poster_url: null, tmdb_id: 27205, user_id: 1 },
  { id: 2, title: 'The Matrix', poster_url: null, tmdb_id: 603, user_id: 1 },
  { id: 3, title: 'Interstellar', poster_url: null, tmdb_id: 157336, user_id: 1 },
  { id: 4, title: 'Pulp Fiction', poster_url: null, tmdb_id: 680, user_id: 1 },
  { id: 5, title: 'The Dark Knight', poster_url: null, tmdb_id: 155, user_id: 1 },
  { id: 6, title: 'Parasite', poster_url: null, tmdb_id: 496243, user_id: 1 },
  { id: 7, title: 'Spirited Away', poster_url: null, tmdb_id: 129, user_id: 1 },
  { id: 8, title: 'Everything Everywhere All at Once', poster_url: null, tmdb_id: 545611, user_id: 1 },
  { id: 9, title: 'The Grand Budapest Hotel', poster_url: null, tmdb_id: 120467, user_id: 1 },
  { id: 10, title: 'Blade Runner 2049', poster_url: null, tmdb_id: 335984, user_id: 1 },
  { id: 11, title: 'Dune: Part Two', poster_url: null, tmdb_id: 693134, user_id: 1 },
  { id: 12, title: 'Oppenheimer', poster_url: null, tmdb_id: 872585, user_id: 1 },
];

// TV shows with episode tracking
export const mockShows: Show[] = [
  {
    id: 101, title: 'Breaking Bad', poster_url: null, tmdb_id: 1396, user_id: 1,
    total_seasons: 5, current_season: 3, current_episode: 5,
    seasons: [
      { season_number: 1, episode_count: 7 },
      { season_number: 2, episode_count: 13 },
      { season_number: 3, episode_count: 13 },
      { season_number: 4, episode_count: 13 },
      { season_number: 5, episode_count: 16 },
    ]
  },
  {
    id: 102, title: 'The Office', poster_url: null, tmdb_id: 2316, user_id: 1,
    total_seasons: 9, current_season: 4, current_episode: 7,
    seasons: [
      { season_number: 1, episode_count: 6 },
      { season_number: 2, episode_count: 22 },
      { season_number: 3, episode_count: 25 },
      { season_number: 4, episode_count: 19 },
      { season_number: 5, episode_count: 28 },
      { season_number: 6, episode_count: 26 },
      { season_number: 7, episode_count: 26 },
      { season_number: 8, episode_count: 24 },
      { season_number: 9, episode_count: 25 },
    ]
  },
  {
    id: 103, title: 'Severance', poster_url: null, tmdb_id: 95396, user_id: 1,
    total_seasons: 1, current_season: 1, current_episode: 3,
    seasons: [
      { season_number: 1, episode_count: 9 },
    ]
  },
  {
    id: 104, title: 'Attack on Titan', poster_url: null, tmdb_id: 1429, user_id: 1,
    total_seasons: 4, current_season: 2, current_episode: 12,
    seasons: [
      { season_number: 1, episode_count: 25 },
      { season_number: 2, episode_count: 12 },
      { season_number: 3, episode_count: 22 },
      { season_number: 4, episode_count: 30 },
    ]
  },
];

// Lists with content
export const mockLists: List[] = [
  {
    id: 1, name: 'Want to Watch', user_id: 1, club_id: null, type: 'personal',
    movie_count: 3, show_count: 0,
    movies: [mockMovies[2], mockMovies[9], mockMovies[10]],
  },
  {
    id: 2, name: 'Watched', user_id: 1, club_id: null, type: 'personal',
    movie_count: 4, show_count: 0,
    movies: [mockMovies[0], mockMovies[1], mockMovies[3], mockMovies[5]],
  },
  {
    id: 3, name: 'Currently Watching', user_id: 1, club_id: null, type: 'personal',
    movie_count: 2, show_count: 0,
    movies: [mockMovies[4], mockMovies[6]],
  },
  {
    id: 4, name: 'Anime', user_id: 1, club_id: null, type: 'personal',
    movie_count: 2, show_count: 0,
    movies: [mockMovies[6], mockMovies[11]],
  },
];

// Clubs
export const mockClubs: Club[] = [
  { id: 1, name: 'Cinephile Circle', description: 'For serious film lovers', admin_id: 2, created_at: '2024-01-15', member_count: 5 },
  { id: 2, name: 'Anime After Dark', description: 'Late night anime', admin_id: 3, created_at: '2024-02-20', member_count: 4 },
  { id: 3, name: 'Sitcom Syndicate', description: 'Comedy lovers', admin_id: 4, created_at: '2024-03-10', member_count: 6 },
  { id: 4, name: 'Sci-Fi Society', description: 'Future visions', admin_id: 5, created_at: '2024-01-05', member_count: 3 },
];

// Activity log
export const mockActivity: Activity[] = [
  { id: 1, event_type: 'user_added_movie', user_id: 1, club_id: null, list_id: 1, movie_id: 3, show_id: null, description: 'Added "Interstellar" to want to watch', data: { movie_title: 'Interstellar', list_name: 'want to watch' }, created_at: '2026-05-09T10:00:00Z', time_ago: '2m ago' },
  { id: 2, event_type: 'user_joined_club', user_id: 1, club_id: 1, list_id: null, movie_id: null, show_id: null, description: 'Joined Cinephile Circle', data: { club_name: 'Cinephile Circle' }, created_at: '2026-05-09T09:30:00Z', time_ago: '32m ago' },
  { id: 3, event_type: 'user_created_list', user_id: 1, club_id: null, list_id: 4, movie_id: null, show_id: null, description: 'Created list "anime"', data: { list_name: 'anime' }, created_at: '2026-05-09T08:00:00Z', time_ago: '2h ago' },
  { id: 4, event_type: 'user_added_movie', user_id: 2, club_id: null, list_id: 2, movie_id: 1, show_id: null, description: 'sarah added "Inception" to watched', data: { movie_title: 'Inception', list_name: 'watched' }, created_at: '2026-05-09T06:00:00Z', time_ago: '4h ago' },
  { id: 5, event_type: 'user_created_club', user_id: 3, club_id: 2, list_id: null, movie_id: null, show_id: null, description: 'mike created Anime After Dark', data: { club_name: 'Anime After Dark' }, created_at: '2026-05-08T20:00:00Z', time_ago: '14h ago' },
  { id: 6, event_type: 'user_added_movie', user_id: 1, club_id: 2, list_id: 5, movie_id: 7, show_id: null, description: 'Added "Spirited Away" to club list', data: { movie_title: 'Spirited Away', list_name: 'Weekly Watch', club_name: 'Anime After Dark' }, created_at: '2026-05-08T18:00:00Z', time_ago: '16h ago' },
  { id: 7, event_type: 'user_added_show', user_id: 1, club_id: null, list_id: 3, movie_id: null, show_id: 101, description: 'Added "Breaking Bad" to currently watching', data: { show_title: 'Breaking Bad', list_name: 'currently watching' }, created_at: '2026-05-08T14:00:00Z', time_ago: '20h ago' },
  { id: 8, event_type: 'new_user', user_id: 5, club_id: null, list_id: null, movie_id: null, show_id: null, description: 'alex joined Palace', data: {}, created_at: '2026-05-08T10:00:00Z', time_ago: '1d ago' },
];

// Trending from TMDB
export const mockTrending: TMDBResult[] = [
  {
    id: 1, media_type: 'movie', title: 'Dune: Part Two',
    overview: 'Paul Atreides unites with Chani and the Fremen while on a warpath of revenge against the conspirators who destroyed his family. Facing a choice between the love of his life and the fate of the known universe, he endeavors to prevent a terrible future only he can foresee.',
    poster_url: null, backdrop_url: null, release_date: '2024-03-01', rating: 8.2, popularity: 95, genre_ids: [878, 12],
    tagline: 'Long live the fighters.', status: 'Released', homepage: 'https://www.dunemovie.com',
    imdb_id: 'tt15239678', tmdb_url: 'https://www.themoviedb.org/movie/693134',
    original_language: 'en', runtime: 166,
    genres: ['Science Fiction', 'Adventure'],
    cast: [
      { id: 101, name: 'Timothee Chalamet', character: 'Paul Atreides', profile_url: null, order: 0 },
      { id: 102, name: 'Zendaya', character: 'Chani', profile_url: null, order: 1 },
      { id: 103, name: 'Rebecca Ferguson', character: 'Lady Jessica', profile_url: null, order: 2 },
      { id: 104, name: 'Javier Bardem', character: 'Stilgar', profile_url: null, order: 3 },
      { id: 105, name: 'Josh Brolin', character: 'Gurney Halleck', profile_url: null, order: 4 },
      { id: 106, name: 'Austin Butler', character: 'Feyd-Rautha', profile_url: null, order: 5 },
      { id: 107, name: 'Florence Pugh', character: 'Princess Irulan', profile_url: null, order: 6 },
      { id: 108, name: 'Dave Bautista', character: 'Beast Rabban', profile_url: null, order: 7 },
    ],
    trailer_key: 'Way9Dexny3w',
  },
  {
    id: 2, media_type: 'tv', title: 'Severance',
    overview: 'Mark leads a team of office workers whose memories have been surgically divided between their work and personal lives. When a mysterious colleague appears outside of work, it begins a journey to discover the truth about their jobs.',
    poster_url: null, backdrop_url: null, release_date: '2022-02-18', rating: 8.7, popularity: 88, genre_ids: [18, 9648, 878],
    tagline: 'Mind-bending mystery thriller.', status: 'Returning Series', homepage: null,
    imdb_id: null, tmdb_url: 'https://www.themoviedb.org/tv/95396',
    original_language: 'en', episode_run_time: [60],
    number_of_seasons: 2, number_of_episodes: 19, in_production: true,
    genres: ['Drama', 'Mystery', 'Sci-Fi & Fantasy'],
    seasons: [
      { season_number: 1, episode_count: 9 },
      { season_number: 2, episode_count: 10 },
    ],
    cast: [
      { id: 201, name: 'Adam Scott', character: 'Mark Scout', profile_url: null, order: 0 },
      { id: 202, name: 'Britt Lower', character: 'Helly Riggs', profile_url: null, order: 1 },
      { id: 203, name: 'John Turturro', character: 'Irving Bailiff', profile_url: null, order: 2 },
      { id: 204, name: 'Christopher Walken', character: 'Burt Goodman', profile_url: null, order: 3 },
      { id: 205, name: 'Patricia Arquette', character: 'Harmony Cobel', profile_url: null, order: 4 },
      { id: 206, name: 'Zach Cherry', character: 'Dylan George', profile_url: null, order: 5 },
    ],
    trailer_key: 'xZ8J1J2l3m4',
    created_by: [{ id: 301, name: 'Dan Erickson', profile_url: null }],
  },
  {
    id: 3, media_type: 'movie', title: 'Oppenheimer',
    overview: 'The story of American scientist J. Robert Oppenheimer and his role in the development of the atomic bomb. The film explores how one mans brilliance and ambition changed the course of history, and the moral weight that comes with creating the most destructive weapon humanity has ever known.',
    poster_url: null, backdrop_url: null, release_date: '2023-07-21', rating: 8.1, popularity: 90, genre_ids: [18, 36],
    tagline: 'The world forever changes.', status: 'Released', homepage: null,
    imdb_id: 'tt15398776', tmdb_url: 'https://www.themoviedb.org/movie/872585',
    original_language: 'en', runtime: 180,
    genres: ['Drama', 'History', 'Thriller'],
    cast: [
      { id: 701, name: 'Cillian Murphy', character: 'J. Robert Oppenheimer', profile_url: null, order: 0 },
      { id: 702, name: 'Emily Blunt', character: 'Katherine Oppenheimer', profile_url: null, order: 1 },
      { id: 703, name: 'Matt Damon', character: 'Leslie Groves', profile_url: null, order: 2 },
      { id: 704, name: 'Robert Downey Jr.', character: 'Lewis Strauss', profile_url: null, order: 3 },
      { id: 705, name: 'Florence Pugh', character: 'Jean Tatlock', profile_url: null, order: 4 },
      { id: 706, name: 'Josh Hartnett', character: 'Ernest Lawrence', profile_url: null, order: 5 },
      { id: 707, name: 'Casey Affleck', character: 'Boris Pash', profile_url: null, order: 6 },
    ],
    trailer_key: 'bB6eLxB_sD8',
  },
  {
    id: 4, media_type: 'tv', title: 'The Bear',
    overview: 'Carmy, a young fine-dining chef, comes home to Chicago to run his family sandwich shop after a heartbreaking death in his family. A ragtag crew of deli employees must balance their own dreams with the harsh reality of running a struggling small business.',
    poster_url: null, backdrop_url: null, release_date: '2022-06-23', rating: 8.6, popularity: 82, genre_ids: [18],
    tagline: 'Every second counts.', status: 'Returning Series', homepage: null,
    imdb_id: null, tmdb_url: 'https://www.themoviedb.org/tv/136315',
    original_language: 'en', episode_run_time: [30],
    number_of_seasons: 3, number_of_episodes: 28, in_production: true,
    genres: ['Drama'],
    seasons: [
      { season_number: 1, episode_count: 8 },
      { season_number: 2, episode_count: 10 },
      { season_number: 3, episode_count: 10 },
    ],
    cast: [
      { id: 501, name: 'Jeremy Allen White', character: 'Carmen Berzatto', profile_url: null, order: 0 },
      { id: 502, name: 'Ayo Edebiri', character: 'Sydney Adamu', profile_url: null, order: 1 },
      { id: 503, name: 'Ebon Moss-Bachrach', character: 'Richard Jerimovich', profile_url: null, order: 2 },
      { id: 504, name: 'Lionel Boyce', character: 'Marcus', profile_url: null, order: 3 },
      { id: 505, name: 'Lisa Colon-Zayas', character: 'Tina', profile_url: null, order: 4 },
    ],
    trailer_key: '4y0L1xAK1qQ',
    created_by: [{ id: 601, name: 'Christopher Storer', profile_url: null }],
  },
  {
    id: 5, media_type: 'movie', title: 'Poor Things',
    overview: 'The incredible tale and fantastical evolution of Bella Baxter, a young woman brought back to life by the brilliant and unorthodox scientist Dr. Godwin Baxter. Under Baxters protection, Bella is eager to learn. Hungry for the worldliness she is lacking, Bella runs off with Duncan Wedderburn, a slick and debauched lawyer, on a whirlwind adventure across the continents.',
    poster_url: null, backdrop_url: null, release_date: '2023-12-08', rating: 7.9, popularity: 78, genre_ids: [878, 35, 10749],
    tagline: 'Shes not like other women. Literally.', status: 'Released', homepage: null,
    imdb_id: 'tt14230388', tmdb_url: 'https://www.themoviedb.org/movie/792307',
    original_language: 'en', runtime: 141,
    genres: ['Comedy', 'Science Fiction', 'Romance'],
    cast: [
      { id: 401, name: 'Emma Stone', character: 'Bella Baxter', profile_url: null, order: 0 },
      { id: 402, name: 'Willem Dafoe', character: 'Dr. Godwin Baxter', profile_url: null, order: 1 },
      { id: 403, name: 'Mark Ruffalo', character: 'Duncan Wedderburn', profile_url: null, order: 2 },
      { id: 404, name: 'Ramy Youssef', character: 'Max McCandles', profile_url: null, order: 3 },
      { id: 405, name: 'Jerrod Carmichael', character: 'Harry Astley', profile_url: null, order: 4 },
    ],
    trailer_key: 'ZFu7ZHfOG0Y',
  },
  {
    id: 6, media_type: 'tv', title: 'Slow Horses',
    overview: 'At Slough House, a dumping ground for failed MI5 agents, the disgraced spies are led by the despicable Jackson Lamb. When a young agent is kidnapped, the team must put aside their grievances and work together to save him from a dangerous far-right group.',
    poster_url: null, backdrop_url: null, release_date: '2022-04-01', rating: 8.0, popularity: 72, genre_ids: [18, 9648],
    tagline: 'Intelligence, inverted.', status: 'Returning Series', homepage: null,
    imdb_id: null, tmdb_url: 'https://www.themoviedb.org/tv/115646',
    original_language: 'en', episode_run_time: [45],
    number_of_seasons: 4, number_of_episodes: 24, in_production: true,
    genres: ['Drama', 'Mystery'],
    seasons: [
      { season_number: 1, episode_count: 6 },
      { season_number: 2, episode_count: 6 },
      { season_number: 3, episode_count: 6 },
      { season_number: 4, episode_count: 6 },
    ],
    cast: [
      { id: 801, name: 'Gary Oldman', character: 'Jackson Lamb', profile_url: null, order: 0 },
      { id: 802, name: 'Jack Lowden', character: 'River Cartwright', profile_url: null, order: 1 },
      { id: 803, name: 'Kristin Scott Thomas', character: 'Diana Taverner', profile_url: null, order: 2 },
      { id: 804, name: 'Saskia Reeves', character: 'Catherine Standish', profile_url: null, order: 3 },
      { id: 805, name: 'Jonathan Pryce', character: 'David Cartwright', profile_url: null, order: 4 },
    ],
    trailer_key: 'R9N3K5lZ5xE',
    created_by: [{ id: 901, name: 'Will Smith', profile_url: null }],
  },
  {
    id: 7, media_type: 'movie', title: 'Challengers',
    overview: 'Tennis player turned coach Tashi has taken her husband, Art, and transformed him from a mediocre player into a world-famous grand slam champion. To jolt him out of his recent losing streak, she signs him up for a challenger event, where he finds himself standing across the net from his former best friend and Tashis former boyfriend.',
    poster_url: null, backdrop_url: null, release_date: '2024-04-26', rating: 7.5, popularity: 75, genre_ids: [18, 10749],
    tagline: 'Her game. Her rules.', status: 'Released', homepage: null,
    imdb_id: 'tt16426418', tmdb_url: 'https://www.themoviedb.org/movie/937746',
    original_language: 'en', runtime: 131,
    genres: ['Drama', 'Romance'],
    cast: [
      { id: 1001, name: 'Zendaya', character: 'Tashi Duncan', profile_url: null, order: 0 },
      { id: 1002, name: "Josh O'Connor", character: 'Patrick Zweig', profile_url: null, order: 1 },
      { id: 1003, name: 'Mike Faist', character: 'Art Donaldson', profile_url: null, order: 2 },
    ],
    trailer_key: 'VobSnrP8y1k',
  },
  {
    id: 8, media_type: 'tv', title: 'Shogun',
    overview: 'When a mysterious European ship is found marooned in a nearby fishing village, its English pilot, John Blackthorne, comes bearing secrets that could help Lord Yoshii Toranaga tip the scales of power and vanquish his dangerous rival. But Blackthorne soon discovers that getting close to Toranaga is not so simple, especially when his translator, the enigmatic Lady Toda Mariko, enters the picture.',
    poster_url: null, backdrop_url: null, release_date: '2024-02-27', rating: 8.6, popularity: 85, genre_ids: [18, 10768],
    tagline: 'An epic saga of war, passion, and power.', status: 'Returning Series', homepage: null,
    imdb_id: null, tmdb_url: 'https://www.themoviedb.org/tv/126308',
    original_language: 'en', episode_run_time: [55],
    number_of_seasons: 2, number_of_episodes: 18, in_production: true,
    genres: ['Drama', 'War & Politics'],
    seasons: [
      { season_number: 1, episode_count: 10 },
      { season_number: 2, episode_count: 8 },
    ],
    cast: [
      { id: 1101, name: 'Hiroyuki Sanada', character: 'Lord Yoshii Toranaga', profile_url: null, order: 0 },
      { id: 1102, name: 'Cosmo Jarvis', character: 'John Blackthorne', profile_url: null, order: 1 },
      { id: 1103, name: 'Anna Sawai', character: 'Toda Mariko', profile_url: null, order: 2 },
      { id: 1104, name: 'Tadanobu Asano', character: 'Kashigi Yabushige', profile_url: null, order: 3 },
    ],
    trailer_key: 'yAN5RPqhtac',
    created_by: [{ id: 1201, name: 'Rachel Kondo', profile_url: null }],
  },
];

// Pattern styles for poster placeholders
export const posterPatterns = [
  'repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(255,255,255,0.04) 8px, rgba(255,255,255,0.04) 10px)',
  'radial-gradient(circle, rgba(255,255,255,0.04) 2px, transparent 2px)',
  'repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(255,255,255,0.035) 8px, rgba(255,255,255,0.035) 10px)',
  'repeating-linear-gradient(90deg, transparent, transparent 6px, rgba(255,255,255,0.03) 6px, rgba(255,255,255,0.03) 8px)',
  'repeating-linear-gradient(0deg, transparent, transparent 8px, rgba(255,255,255,0.035) 8px, rgba(255,255,255,0.035) 10px)',
  'repeating-linear-gradient(30deg, transparent, transparent 10px, rgba(255,255,255,0.03) 10px, rgba(255,255,255,0.03) 12px)',
];
