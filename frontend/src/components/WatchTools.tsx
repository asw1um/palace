import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Check, Clock, Pencil, PlayCircle, RotateCcw } from '@/lib/icons';
import { customMedia, progress as progressApi, type WatchPosition } from '@/data/api';
import { episodeKey, nextEpisode, type SeasonInfo } from '@/lib/episodes';
import { runtime as fmtRuntime } from '@/lib/format';
import { emit } from '@/lib/bus';
import { Button } from './ui/Button';
import { Input, Slider } from './ui/Field';

/* -------------------------------------------------------------------------- */
/* Series: where to pick it back up                                            */
/* -------------------------------------------------------------------------- */

export function NextUpBar({
  tmdbId, seasons, watched, position, onChanged,
}: {
  tmdbId: number;
  seasons: SeasonInfo[];
  watched: Set<string>;
  /** The episode they stopped partway through, if they saved one. */
  position: WatchPosition | null;
  onChanged: () => void;
}) {
  // A saved spot wins until that episode is ticked off.
  const resume =
    position && !watched.has(episodeKey(position.season, position.episode)) ? position : null;
  const next = resume ?? nextEpisode(seasons, watched);
  const [minutes, setMinutes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMinutes(resume?.minutes ? String(resume.minutes) : '');
  }, [resume?.season, resume?.episode, resume?.minutes]);

  if (!seasons.length) return null;

  if (!next) {
    return (
      <div className="watch-bar">
        <Check size={16} style={{ color: 'var(--success)' }} />
        <strong>All caught up</strong>
        <span className="faint">Every episode is ticked off.</span>
      </div>
    );
  }

  const savePosition = async () => {
    const value = Math.max(0, Math.round(Number(minutes) || 0));
    if (value === (resume?.minutes ?? 0)) return;
    if (value > 0) {
      await progressApi.setPosition(tmdbId, next.season, next.episode, value);
      toast.success(`Saved: ${value} min into S${next.season} E${next.episode}`);
    } else {
      await progressApi.clearPosition(tmdbId);
    }
    onChanged();
  };

  const markWatched = async () => {
    setBusy(true);
    try {
      await progressApi.setEpisode(tmdbId, next.season, next.episode, true, false);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="watch-bar">
      <PlayCircle size={16} style={{ color: 'var(--accent)' }} />
      <div>
        <div className="eyebrow">{watched.size ? 'Next up' : 'Start with'}</div>
        <strong>
          Season {next.season} · Episode {next.episode}
        </strong>
      </div>
      <div className="grow" />
      <label className="row gap-2" style={{ fontSize: 'var(--text-xs)' }}>
        <span className="faint">Stopped partway?</span>
        <Input
          type="number"
          min={0}
          max={1000}
          inputMode="numeric"
          placeholder="0"
          aria-label={`Minutes watched of season ${next.season} episode ${next.episode}`}
          style={{ width: 68 }}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          onBlur={savePosition}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        <span className="faint">min in</span>
      </label>
      <Button variant="primary" size="sm" icon={<Check size={14} />} disabled={busy} onClick={markWatched}>
        Mark watched
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Series: fix the season / episode counts                                     */
/* -------------------------------------------------------------------------- */

export function SeasonEditor({
  tmdbId, seasons, isCustom, hasTmdbData, onDone,
}: {
  tmdbId: number;
  /** What is in use now: the user's own counts, or TMDB's. */
  seasons: SeasonInfo[];
  isCustom: boolean;
  hasTmdbData: boolean;
  onDone: () => void;
}) {
  const initial = seasons.filter((s) => s.season_number > 0).map((s) => String(s.episode_count));
  const [counts, setCounts] = useState<string[]>(initial.length ? initial : ['']);
  const [busy, setBusy] = useState(false);

  const resize = (n: number) => {
    const size = Math.max(1, Math.min(100, Math.round(n) || 1));
    setCounts((prev) => Array.from({ length: size }, (_, i) => prev[i] ?? ''));
  };

  const parsed = counts.map((c) => Math.round(Number(c)));
  const valid = parsed.every((n) => Number.isFinite(n) && n >= 1 && n <= 2000);

  const save = async () => {
    setBusy(true);
    try {
      await customMedia.setSeasons(
        tmdbId,
        parsed.map((episode_count, i) => ({ season_number: i + 1, episode_count })),
      );
      emit('custom');
      toast.success('Episode counts saved');
      onDone();
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await customMedia.reset('tv', tmdbId);
      emit('custom');
      toast.success('Back to TMDB’s episode counts');
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack gap-4">
      <div>
        <strong>{hasTmdbData ? 'Edit seasons' : 'Add seasons'}</strong>
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          {hasTmdbData
            ? 'If TMDB has the wrong episode counts, set your own. This only changes it for you.'
            : 'TMDB has no episode data for this series. Enter the seasons yourself to track it.'}
        </p>
      </div>

      <label className="row gap-3" style={{ fontSize: 'var(--text-sm)' }}>
        Number of seasons
        <Input
          type="number"
          min={1}
          max={100}
          style={{ width: 80 }}
          value={counts.length}
          onChange={(e) => resize(Number(e.target.value))}
        />
      </label>

      <div className="season-grid">
        {counts.map((c, i) => (
          <label key={i} className="stack gap-1" style={{ fontSize: 'var(--text-xs)' }}>
            <span className="faint">Season {i + 1}</span>
            <Input
              type="number"
              min={1}
              max={2000}
              placeholder="Episodes"
              value={c}
              onChange={(e) =>
                setCounts((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
              }
            />
          </label>
        ))}
      </div>

      <div className="row gap-2 wrap">
        <Button variant="primary" disabled={!valid || busy} onClick={save}>
          Save
        </Button>
        {(hasTmdbData || isCustom) && (
          <Button disabled={busy} onClick={onDone}>
            Cancel
          </Button>
        )}
        {isCustom && (
          <Button variant="ghost" icon={<RotateCcw size={14} />} disabled={busy} onClick={reset}>
            {hasTmdbData ? 'Use TMDB’s counts' : 'Remove my seasons'}
          </Button>
        )}
        {!valid && (
          <span className="faint" style={{ fontSize: 'var(--text-xs)' }}>
            Every season needs between 1 and 2000 episodes.
          </span>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Film: runtime (when TMDB lacks it) and how far in you are                   */
/* -------------------------------------------------------------------------- */

export function FilmProgress({
  tmdbId, tmdbRuntime, customRuntime, minutes, onChanged,
}: {
  tmdbId: number;
  tmdbRuntime: number;
  customRuntime: number | null;
  /** Minutes watched so far. */
  minutes: number;
  onChanged: () => void;
}) {
  const runtime = customRuntime ?? tmdbRuntime;
  const [value, setValue] = useState(minutes);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setValue(Math.min(minutes, runtime || minutes)), [minutes, runtime]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const saveRuntime = async () => {
    const n = Math.round(Number(draft));
    if (!Number.isFinite(n) || n < 1 || n > 1500) {
      toast.error('Enter a runtime between 1 and 1500 minutes');
      return;
    }
    await customMedia.setRuntime(tmdbId, n);
    // Keep "watched" meaning the whole film under the new length.
    if (minutes > 0) await progressApi.setMovieMinutes(tmdbId, minutes >= runtime && runtime ? n : Math.min(minutes, n), n);
    emit('custom');
    setEditing(false);
    toast.success('Runtime saved');
    onChanged();
  };

  const resetRuntime = async () => {
    await customMedia.reset('movie', tmdbId);
    emit('custom');
    setEditing(false);
    onChanged();
  };

  // Saves a moment after the slider stops moving rather than on every step.
  const slide = (v: number) => {
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await progressApi.setMovieMinutes(tmdbId, v, runtime);
      onChanged();
    }, 500);
  };

  if (!runtime || editing) {
    return (
      <div className="watch-bar">
        <Clock size={16} style={{ color: 'var(--accent)' }} />
        <div>
          <strong>{runtime ? 'Change runtime' : 'Add a runtime'}</strong>
          <div className="faint" style={{ fontSize: 'var(--text-xs)' }}>
            {runtime
              ? 'Only changes it for you.'
              : 'TMDB doesn’t list one for this film. Add it to track how far in you are.'}
          </div>
        </div>
        <div className="grow" />
        <Input
          type="number"
          min={1}
          max={1500}
          inputMode="numeric"
          placeholder="Minutes"
          aria-label="Runtime in minutes"
          style={{ width: 96 }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && saveRuntime()}
        />
        <Button variant="primary" size="sm" onClick={saveRuntime}>
          Save
        </Button>
        {editing && (
          <Button size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        )}
        {editing && customRuntime !== null && (
          <Button variant="ghost" size="sm" icon={<RotateCcw size={14} />} onClick={resetRuntime}>
            {tmdbRuntime ? 'Use TMDB’s' : 'Remove'}
          </Button>
        )}
      </div>
    );
  }

  const left = runtime - value;
  return (
    <div className="watch-bar">
      <PlayCircle size={16} style={{ color: 'var(--accent)' }} />
      <div style={{ minWidth: 150 }}>
        <div className="eyebrow">{value >= runtime ? 'Watched' : value > 0 ? 'Left off at' : 'Not started'}</div>
        <strong>
          {value ? fmtRuntime(value) : '0m'} of {fmtRuntime(runtime)}
        </strong>
        {value > 0 && left > 0 && (
          <span className="faint" style={{ fontSize: 'var(--text-xs)' }}> · {fmtRuntime(left)} left</span>
        )}
      </div>
      <div className="grow" style={{ minWidth: 140 }}>
        <Slider ariaLabel="Minutes watched" min={0} max={runtime} step={1} value={value} onChange={slide} />
      </div>
      <Button
        variant="ghost"
        size="sm"
        icon={<Pencil size={13} />}
        onClick={() => {
          setDraft(String(runtime));
          setEditing(true);
        }}
      >
        {customRuntime !== null ? 'Runtime (yours)' : 'Runtime'}
      </Button>
    </div>
  );
}
