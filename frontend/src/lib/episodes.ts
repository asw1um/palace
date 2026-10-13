/** Season and episode helpers shared by the title modal, dashboard and API layer. */

export interface SeasonInfo {
  season_number: number;
  episode_count: number;
}

export interface EpisodeRef {
  season: number;
  episode: number;
}

/** The key the UI uses for one episode, e.g. `s2e5`. */
export function episodeKey(season: number, episode: number): string {
  return `s${season}e${episode}`;
}

export function countEpisodes(seasons: SeasonInfo[]): number {
  return seasons.reduce((a, s) => a + s.episode_count, 0);
}

/**
 * Where to pick a series back up: the first unwatched episode after the latest
 * one watched. Someone who skipped the pilot is not sent back to it, but once
 * they reach the end any gaps they left are offered. Specials (season 0) are
 * left out. Returns null when there is nothing left to watch.
 */
export function nextEpisode(seasons: SeasonInfo[], watched: Set<string>): EpisodeRef | null {
  const order: EpisodeRef[] = [...seasons]
    .filter((s) => s.season_number > 0)
    .sort((a, b) => a.season_number - b.season_number)
    .flatMap((s) =>
      Array.from({ length: s.episode_count }, (_, i) => ({ season: s.season_number, episode: i + 1 })),
    );
  const seen = (r: EpisodeRef) => watched.has(episodeKey(r.season, r.episode));

  let latest = -1;
  order.forEach((r, i) => {
    if (seen(r)) latest = i;
  });
  return order.slice(latest + 1).find((r) => !seen(r)) ?? order.find((r) => !seen(r)) ?? null;
}

/** "S2 E5" */
export function episodeLabel(ref: EpisodeRef): string {
  return `S${ref.season} E${ref.episode}`;
}
