import type { TMDBResult } from '../types';

/* ---------------------------------------------------------------------------
   Demo Mode catalogue.

   Palace normally pulls posters from TMDB. Demo Mode has to work with no API
   key and no network, so every poster here is generated as an inline SVG —
   deterministic gradient art derived from the title. Swap in the real backend
   and genuine artwork takes over automatically.
   ------------------------------------------------------------------------ */

const PAIRS: [string, string][] = [
  ['#1e3a8a', '#7c3aed'], ['#0f766e', '#22d3ee'], ['#7f1d1d', '#f59e0b'],
  ['#4c1d95', '#ec4899'], ['#134e4a', '#84cc16'], ['#831843', '#fb7185'],
  ['#1e293b', '#38bdf8'], ['#3f2d0f', '#fbbf24'], ['#0c4a6e', '#a78bfa'],
  ['#312e81', '#22d3ee'], ['#4a044e', '#f472b6'], ['#14532d', '#facc15'],
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Deterministic poster art for a title. */
export function art(title: string, kind: 'poster' | 'backdrop' = 'poster'): string {
  const h = hash(title);
  const [a, b] = PAIRS[h % PAIRS.length];
  const angle = 20 + (h % 60);
  const w = kind === 'poster' ? 300 : 780;
  const ht = kind === 'poster' ? 450 : 440;
  const words = title.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > 14) {
      lines.push(line.trim());
      line = word;
    } else line += ` ${word}`;
  }
  if (line.trim()) lines.push(line.trim());

  const fs = kind === 'poster' ? 30 : 54;
  const text =
    kind === 'poster'
      ? lines
          .slice(0, 4)
          .map(
            (l, i) =>
              `<text x="26" y="${330 + i * (fs + 4)}" font-family="Inter,system-ui,sans-serif" font-size="${fs}" font-weight="800" fill="#ffffff" opacity="0.94">${esc(l)}</text>`,
          )
          .join('')
      : '';

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${ht}" width="${w}" height="${ht}">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1" gradientTransform="rotate(${angle} .5 .5)">
<stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
<radialGradient id="v" cx="50%" cy="30%" r="80%">
<stop offset="0" stop-color="#ffffff" stop-opacity=".26"/><stop offset="1" stop-color="#000000" stop-opacity=".55"/></radialGradient>
</defs>
<rect width="${w}" height="${ht}" fill="url(#g)"/>
<circle cx="${(h % 60) + 20}%" cy="${(h % 40) + 12}%" r="34%" fill="#ffffff" opacity=".12"/>
<circle cx="${(h % 45) + 45}%" cy="${(h % 30) + 62}%" r="26%" fill="#000000" opacity=".16"/>
<rect width="${w}" height="${ht}" fill="url(#v)"/>
${text}</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

interface Seed {
  id: number;
  media_type: 'movie' | 'tv';
  title: string;
  year: string;
  rating: number;
  genres: string[];
  overview: string;
  runtime?: number;
  seasons?: number[];
}

const SEEDS: Seed[] = [
  { id: 9001, media_type: 'movie', title: 'The Lighthouse Keeper', year: '2023-10-06', rating: 8.1, genres: ['Drama', 'Mystery'], overview: 'Two keepers on a storm-battered rock discover the light is not the only thing burning.', runtime: 118 },
  { id: 9002, media_type: 'movie', title: 'Neon Harbour', year: '2024-02-14', rating: 7.4, genres: ['Thriller', 'Crime'], overview: 'A dock worker stumbles into a smuggling ring that runs deeper than the tide.', runtime: 132 },
  { id: 9003, media_type: 'movie', title: 'Paper Moons', year: '2022-08-19', rating: 7.9, genres: ['Romance', 'Drama'], overview: 'A letter written in 1974 finally reaches the person it was meant for.', runtime: 104 },
  { id: 9004, media_type: 'movie', title: 'Iron Meridian', year: '2025-05-30', rating: 6.8, genres: ['Action', 'Sci-Fi'], overview: 'The last convoy crosses a continent that no longer wants to be crossed.', runtime: 146 },
  { id: 9005, media_type: 'movie', title: 'Glasshouse Sonata', year: '2021-11-12', rating: 8.4, genres: ['Drama', 'Music'], overview: 'A pianist loses her hearing and finds a completely different instrument.', runtime: 127 },
  { id: 9006, media_type: 'movie', title: 'Cold Orbit', year: '2024-09-27', rating: 7.1, genres: ['Sci-Fi', 'Thriller'], overview: 'Six months alone on a decaying station, and the logs have started answering back.', runtime: 111 },
  { id: 9007, media_type: 'movie', title: 'The Quiet Bakery', year: '2023-03-03', rating: 7.7, genres: ['Comedy', 'Drama'], overview: 'A failing bakery, a stubborn grandmother, and one very persistent food critic.', runtime: 98 },
  { id: 9008, media_type: 'movie', title: 'Saltwater Kings', year: '2020-07-17', rating: 7.2, genres: ['Adventure', 'Drama'], overview: 'Three brothers, one boat, and a debt the sea keeps calling in.', runtime: 121 },
  { id: 9009, media_type: 'movie', title: 'Vermilion', year: '2025-01-24', rating: 8.6, genres: ['Animation', 'Fantasy'], overview: 'A painter’s apprentice discovers her master has been mixing memories into the pigment.', runtime: 109 },
  { id: 9010, media_type: 'movie', title: 'Static Bloom', year: '2022-05-06', rating: 6.5, genres: ['Horror'], overview: 'The radio only plays between 3 and 4 a.m., and it knows your name.', runtime: 94 },
  { id: 9011, media_type: 'movie', title: 'Latitude Zero', year: '2024-11-08', rating: 7.8, genres: ['Documentary'], overview: 'Following the equator on foot, one village at a time.', runtime: 136 },
  { id: 9012, media_type: 'movie', title: 'Hollow Crown Road', year: '2021-04-23', rating: 7.0, genres: ['Western', 'Drama'], overview: 'A retired marshal takes one last ride, mostly to prove he still can.', runtime: 129 },
  { id: 9013, media_type: 'movie', title: 'Midnight Cartographers', year: '2023-12-15', rating: 8.2, genres: ['Adventure', 'Mystery'], overview: 'Every map they draw changes the city they drew it in.', runtime: 141 },
  { id: 9014, media_type: 'movie', title: 'Fever Dream Diner', year: '2025-07-11', rating: 6.9, genres: ['Comedy'], overview: 'The night shift at a roadside diner where nobody ever seems to leave.', runtime: 101 },
  { id: 9015, media_type: 'movie', title: 'Ash & Amber', year: '2020-10-02', rating: 7.6, genres: ['Drama', 'History'], overview: 'A glassblower rebuilds her town from the ruins of the fire that took it.', runtime: 124 },
  { id: 9016, media_type: 'movie', title: 'The Pet Girl of Sakurasou', year: '2022-01-28', rating: 8.0, genres: ['Animation', 'Romance'], overview: 'A dorm full of misfits, one impossible artist, and a very slow-moving miracle.', runtime: 106 },
  { id: 9017, media_type: 'movie', title: 'Signal Fire', year: '2024-06-21', rating: 7.3, genres: ['Thriller'], overview: 'A wildfire lookout picks up a transmission that should not exist.', runtime: 113 },
  { id: 9018, media_type: 'movie', title: 'Understory', year: '2025-03-14', rating: 8.3, genres: ['Drama'], overview: 'Beneath the canopy, a forest ranger keeps a promise for thirty years.', runtime: 117 },

  { id: 9501, media_type: 'tv', title: 'Gilded Static', year: '2023-01-11', rating: 8.5, genres: ['Drama', 'Sci-Fi'], overview: 'A broadcast engineer in 1962 finds tomorrow’s news arriving a day early.', seasons: [8, 10, 10] },
  { id: 9502, media_type: 'tv', title: 'The Provincial', year: '2021-09-02', rating: 8.8, genres: ['Drama', 'Politics'], overview: 'Small-town governance turns out to be a blood sport.', seasons: [10, 10, 10, 8] },
  { id: 9503, media_type: 'tv', title: 'Nightmarket', year: '2024-04-18', rating: 7.9, genres: ['Crime', 'Thriller'], overview: 'Everything is for sale after dark, including the people who run the stalls.', seasons: [8, 8] },
  { id: 9504, media_type: 'tv', title: 'Second Sun', year: '2025-02-06', rating: 8.7, genres: ['Sci-Fi'], overview: 'Terraforming was supposed to take a century. It took a decade, and something noticed.', seasons: [10, 10] },
  { id: 9505, media_type: 'tv', title: 'Bramble House', year: '2020-11-20', rating: 8.1, genres: ['Mystery', 'Drama'], overview: 'A country estate with seven guests, six alibis, and one very patient housekeeper.', seasons: [6, 6, 6] },
  { id: 9506, media_type: 'tv', title: 'Kitchen Confidentially', year: '2022-06-09', rating: 7.5, genres: ['Comedy'], overview: 'A three-star kitchen run entirely by people who should not be allowed near knives.', seasons: [12, 12, 10] },
  { id: 9507, media_type: 'tv', title: 'Long Way Down', year: '2023-08-25', rating: 8.9, genres: ['Drama', 'Adventure'], overview: 'Two strangers, one motorcycle, and eleven thousand kilometres of not talking about it.', seasons: [9, 9] },
  { id: 9508, media_type: 'tv', title: 'Cobalt Division', year: '2024-10-03', rating: 7.7, genres: ['Action', 'Crime'], overview: 'The unit that gets called when the other units get called off.', seasons: [8, 8, 8, 8] },
  { id: 9509, media_type: 'tv', title: 'Tidepool', year: '2025-06-13', rating: 8.4, genres: ['Animation', 'Family'], overview: 'A hand-painted series about the smallest creatures on the biggest coast.', seasons: [13, 13] },
  { id: 9510, media_type: 'tv', title: 'The Understudy', year: '2021-03-30', rating: 8.2, genres: ['Drama'], overview: 'She has waited nine years for someone to twist an ankle.', seasons: [8] },
  { id: 9511, media_type: 'tv', title: 'Frostline', year: '2022-12-01', rating: 7.6, genres: ['Thriller', 'Mystery'], overview: 'A research base, a missing crew, and 140 days until the sun comes back.', seasons: [6, 6] },
  { id: 9512, media_type: 'tv', title: 'Paper Tigers', year: '2024-01-16', rating: 8.0, genres: ['Comedy', 'Drama'], overview: 'Four consultants who have never actually solved anything, ever.', seasons: [10, 10] },
];

export const CATALOG: TMDBResult[] = SEEDS.map((s) => ({
  id: s.id,
  media_type: s.media_type,
  title: s.title,
  overview: s.overview,
  poster_url: art(s.title),
  backdrop_url: art(s.title, 'backdrop'),
  release_date: s.year,
  rating: s.rating,
  popularity: 100 - SEEDS.indexOf(s),
  genres: s.genres,
  tagline: null,
  status: s.media_type === 'tv' ? 'Returning Series' : 'Released',
  runtime: s.runtime,
  number_of_seasons: s.seasons?.length,
  number_of_episodes: s.seasons?.reduce((a, b) => a + b, 0),
  seasons: s.seasons?.map((count, i) => ({ season_number: i + 1, episode_count: count })),
  cast: ['Ava Mercer', 'Idris Vale', 'Noor Haddad', 'Tomas Lindqvist', 'Rin Kobayashi', 'Elena Duarte']
    .slice(0, 5)
    .map((name, i) => ({
      id: 1000 + i,
      name,
      character: ['Lead', 'Detective', 'The Sister', 'Chief', 'Narrator'][i],
      profile_url: null,
      order: i,
    })),
  tmdb_url: null,
  trailer_key: null,
}));

export function findTitle(id: number): TMDBResult | undefined {
  return CATALOG.find((c) => c.id === id);
}
