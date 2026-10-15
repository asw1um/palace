import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Check, Clock, Eye, ExternalLink, HelpCircle, ListPlus, PlayCircle, Plus, Star, ThumbsDown,
  ThumbsUp, Trash2, Users, X,
} from '@/lib/icons';
import { toast } from 'sonner';
import {
  discover, lists as listsApi, progress as progressApi, reviews as reviewsApi, type WatchPosition,
} from '@/data/api';
import { seriesProgress } from '@/lib/episodes';
import type { EpisodeInfo, Review, TMDBResult } from '@/data/types';
import { percent, runtime as fmtRuntime, timeAgo, titleCase, year } from '@/lib/format';
import { emit } from '@/lib/bus';
import { useAuth } from '@/data/AuthContext';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Avatar, CheckBox, Chip, Empty, Panel, Ring, Skeleton, Stars, Tabs } from './ui/Bits';
import { Switch, Textarea } from './ui/Field';
import { Markdown, MARKDOWN_HELP } from './Markdown';
import { useAppData, type TitleRef } from './AppData';
import { FilmProgress, NextUpBar, SeasonEditor } from './WatchTools';
import { MoreLikeThis, ReviewComments, WhereToWatch } from './TitleExtras';

type Tab = 'overview' | 'episodes' | 'reviews';

export function MediaModal({
  open, target, onClose,
}: { open: boolean; target: TitleRef | null; onClose: () => void }) {
  const { openAddTo, quickAdd, cascadeEpisodes, custom, openMedia, fileWatched, fileStarted, lists } = useAppData();
  const { user } = useAuth();
  const [details, setDetails] = useState<TMDBResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [watchedEps, setWatchedEps] = useState<Set<string>>(new Set());
  const [movieWatched, setMovieWatched] = useState(false);
  const [movieMinutes, setMovieMinutes] = useState(0);
  const [position, setPosition] = useState<WatchPosition | null>(null);
  const [editSeasons, setEditSeasons] = useState(false);
  const [season, setSeason] = useState(1);
  const [rows, setRows] = useState<Review[]>([]);
  const [trailerOpen, setTrailerOpen] = useState(false);

  const isTv = target?.media_type === 'tv';

  const loadProgress = useCallback(async () => {
    if (!target) return;
    const p = await progressApi.forTitle(target.media_type, target.tmdb_id);
    setWatchedEps(new Set(p.episodes));
    setMovieWatched(p.watched);
    setMovieMinutes(p.minutes);
    setPosition(p.position ?? null);
    return p;
  }, [target]);

  const loadReviews = useCallback(async () => {
    if (!target) return;
    setRows(await reviewsApi.forTitle(target.tmdb_id, target.media_type).catch(() => []));
  }, [target]);

  useEffect(() => {
    if (!open || !target) return;
    setTab('overview');
    setSeason(1);
    setTrailerOpen(false);
    setEditSeasons(false);
    setLoading(true);
    discover
      .details(target.tmdb_id, target.media_type)
      .then((d) => setDetails(d ?? null))
      .catch(() => setDetails(null))
      .finally(() => setLoading(false));
    loadProgress();
    loadReviews();
  }, [open, target, loadProgress, loadReviews]);

  // The user's own runtime / season counts win over TMDB's where they've set them.
  const mine = target ? custom[`${target.media_type}:${target.tmdb_id}`] : undefined;
  const tmdbSeasons = details?.seasons ?? [];
  const seasons = mine?.seasons ?? tmdbSeasons;
  // Specials (season 0) don't count towards finishing a series.
  const { done: watchedCount, total: totalEpisodes } = seriesProgress(seasons, watchedEps);
  const runtime = mine?.runtime ?? details?.runtime ?? 0;
  const pct = isTv
    ? Math.min(100, percent(watchedCount, totalEpisodes))
    : movieWatched
      ? 100
      : runtime
        ? Math.min(100, percent(movieMinutes, runtime))
        : 0;

  const progressChanged = async () => {
    const p = await loadProgress();
    emit('progress');
    emit('lists');
    if (!target || !p) return;
    // Just finished it? File it under Watched.
    const { done, total } = seriesProgress(seasons, p.episodes);
    const finished = isTv ? total > 0 && done >= total : p.watched;
    if (finished) await fileWatched(target);
    else if (p.episodes.length || p.minutes > 0 || p.position) await fileStarted(target);
  };

  /** The user's lists that hold this title, with the item's id in each for removing it. */
  const inLists = useMemo(
    () =>
      !target
        ? []
        : lists.flatMap((l) => {
            const item = l.items?.find((i) => i.tmdb_id === target.tmdb_id && i.media_type === target.media_type);
            return item ? [{ list: l, itemId: item.id }] : [];
          }),
    [lists, target],
  );

  const removeFrom = async (listId: number, itemId: number, listName: string) => {
    await listsApi.removeItem(listId, itemId);
    toast.success(`Removed from ${titleCase(listName)}`);
    emit('lists');
  };

  const userScore = useMemo(() => {
    if (!rows.length) return null;
    return rows.reduce((a, r) => a + r.rating, 0) / rows.length;
  }, [rows]);

  const toggleEpisode = async (sNum: number, eNum: number, next: boolean) => {
    if (!target) return;
    await progressApi.setEpisode(target.tmdb_id, sNum, eNum, next, cascadeEpisodes);
    await progressChanged();
  };

  const toggleMovie = async () => {
    if (!target) return;
    await progressApi.setMovieWatched(target.tmdb_id, !movieWatched, runtime);
    setMovieWatched(!movieWatched);
    setMovieMinutes(!movieWatched ? runtime : 0);
    emit('progress');
    emit('lists');
    toast.success(!movieWatched ? 'Marked as watched' : 'Marked as unwatched');
    if (!movieWatched) await fileWatched(target);
  };

  const markSeason = async (sNum: number, watched: boolean) => {
    if (!target) return;
    const meta = seasons.find((s) => s.season_number === sNum);
    if (!meta) return;
    await progressApi.setSeasons(target.tmdb_id, [meta], watched);
    await progressChanged();
  };

  const tabs = [
    { value: 'overview' as Tab, label: 'Overview' },
    ...(isTv ? [{ value: 'episodes' as Tab, label: 'Episodes' }] : []),
    { value: 'reviews' as Tab, label: 'Reviews', count: rows.length },
  ];

  return (
    // Escape reaches every open dialog, so while the trailer is up it only closes that.
    <Modal
      open={open}
      onClose={trailerOpen ? () => setTrailerOpen(false) : onClose}
      hideHeader
      className="media-modal"
      width={940}
    >
      {loading && !details ? (
        <div className="stack gap-4" style={{ padding: 'var(--space-6)' }}>
          <Skeleton h={180} r="var(--r-md)" />
          <Skeleton h={24} w="50%" />
          <Skeleton h={80} />
        </div>
      ) : (
        <>
          <div className="media-hero">
            {(details?.backdrop_url || target?.poster_url) && (
              <div
                className="media-hero__bg"
                style={{ backgroundImage: `url(${details?.backdrop_url ?? target?.poster_url})` }}
              />
            )}
            <div className="media-hero__scrim" />
            {/* The pop-up has no header bar, and on a phone there is no room to tap outside it. */}
            <button className="media-hero__close" aria-label="Close" data-close onClick={onClose}>
              <X size={18} />
            </button>

            <div className="media-hero__poster">
              {target?.poster_url && (
                <Image
                  src={target.poster_url}
                  alt=""
                  width={130}
                  height={195}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </div>

            <div className="media-hero__meta stack gap-3 grow">
              <div>
                <div className="media-hero__title">{target?.title}</div>
                {details?.tagline && <div className="media-hero__tagline">{details.tagline}</div>}
              </div>

              <div className="row gap-2 wrap">
                <Chip tone="accent">{isTv ? 'Series' : 'Film'}</Chip>
                {year(details?.release_date ?? target?.release_date) && (
                  <Chip>{year(details?.release_date ?? target?.release_date)}</Chip>
                )}
                {details?.rating ? (
                  <Chip>
                    <Star size={12} /> {details.rating.toFixed(1)} TMDB
                  </Chip>
                ) : null}
                {userScore !== null && (
                  <Chip tone="accent">
                    <Users size={12} /> {(userScore / 2).toFixed(1)} Palace · {rows.length}
                  </Chip>
                )}
                {!isTv && runtime ? (
                  <Chip>
                    <Clock size={12} /> {fmtRuntime(runtime)}
                  </Chip>
                ) : null}
                {isTv && details?.number_of_seasons ? (
                  <Chip>
                    {details.number_of_seasons} season{details.number_of_seasons > 1 ? 's' : ''} ·{' '}
                    {totalEpisodes} eps
                  </Chip>
                ) : null}
              </div>

              <div className="row gap-2 wrap">
                <Button
                  variant="primary"
                  icon={<ListPlus size={15} />}
                  onClick={() => target && openAddTo(target)}
                >
                  Add to list
                </Button>
                <Button icon={<Plus size={15} />} onClick={() => target && quickAdd(target)}>
                  Want to watch
                </Button>
                {!isTv && (
                  <Button
                    variant={movieWatched ? 'soft' : 'default'}
                    icon={movieWatched ? <Check size={15} /> : <Eye size={15} />}
                    bounce
                    onClick={toggleMovie}
                  >
                    {movieWatched ? 'Watched' : 'Mark watched'}
                  </Button>
                )}
                {details?.trailer_key && (
                  <Button icon={<PlayCircle size={15} />} onClick={() => setTrailerOpen(true)}>
                    Play trailer
                  </Button>
                )}
                {details?.tmdb_url && (
                  <Button
                    variant="ghost"
                    icon={<ExternalLink size={15} />}
                    onClick={() => window.open(details.tmdb_url!, '_blank', 'noopener')}
                  >
                    TMDB
                  </Button>
                )}
                {pct > 0 && (
                  <div className="row gap-2" style={{ marginLeft: 'auto' }}>
                    <Ring value={pct} size={38} />
                    <span className="muted" style={{ fontSize: 'var(--text-xs)' }}>
                      {pct}% watched
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {inLists.length > 0 && (
            <div className="row gap-2 wrap in-lists" style={{ paddingTop: 'var(--space-4)' }}>
              <span className="faint" style={{ fontSize: 'var(--text-xs)' }}>In your lists:</span>
              {inLists.map(({ list, itemId }) => (
                <span key={list.id} className="chip in-lists__chip">
                  {titleCase(list.name)}
                  <button
                    aria-label={`Remove from ${titleCase(list.name)}`}
                    title={`Remove from ${titleCase(list.name)}`}
                    onClick={() => removeFrom(list.id, itemId, list.name)}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {target && details && (
            <div style={{ paddingTop: 'var(--space-4)' }}>
              {isTv ? (
                <NextUpBar
                  tmdbId={target.tmdb_id}
                  seasons={seasons}
                  watched={watchedEps}
                  position={position}
                  onChanged={progressChanged}
                />
              ) : (
                <FilmProgress
                  tmdbId={target.tmdb_id}
                  tmdbRuntime={details.runtime ?? 0}
                  customRuntime={mine?.runtime ?? null}
                  minutes={movieMinutes}
                  onChanged={progressChanged}
                />
              )}
            </div>
          )}

          <div style={{ padding: '0 var(--space-6)' }}>
            <Tabs tabs={tabs} value={tab} onChange={setTab} />
          </div>

          <div style={{ padding: 'var(--space-5) var(--space-6) var(--space-6)' }}>
            {tab === 'overview' && <Overview details={details} onNavigate={onClose} onOpen={openMedia} />}

            {tab === 'episodes' && isTv && target && (editSeasons || !seasons.length) && (
              <SeasonEditor
                tmdbId={target.tmdb_id}
                seasons={seasons}
                isCustom={!!mine?.seasons}
                hasTmdbData={tmdbSeasons.length > 0}
                onDone={() => setEditSeasons(false)}
              />
            )}

            {tab === 'episodes' && isTv && !editSeasons && seasons.length > 0 && (
              <Episodes
                tmdbId={target!.tmdb_id}
                onEdit={() => setEditSeasons(true)}
                isCustom={!!mine?.seasons}
                seasons={seasons}
                season={season}
                setSeason={setSeason}
                watched={watchedEps}
                onToggle={toggleEpisode}
                onMarkSeason={markSeason}
              />
            )}

            {tab === 'reviews' && target && (
              <Reviews
                rows={rows}
                meId={user?.id}
                target={target}
                onChanged={() => {
                  loadReviews();
                  emit('reviews');
                }}
              />
            )}
          </div>
        </>
      )}

      <Modal
        open={open && trailerOpen}
        onClose={() => setTrailerOpen(false)}
        title={`${target?.title ?? ''} — Trailer`}
        className="trailer-modal"
        width={960}
      >
        {trailerOpen && details?.trailer_key && (
          <div className="trailer-frame">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${details.trailer_key}?autoplay=1&rel=0`}
              title={`${target?.title ?? ''} trailer`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          </div>
        )}
      </Modal>
    </Modal>
  );
}

/* ----------------------------------------------------------------- Overview */
function Overview({
  details, onNavigate, onOpen,
}: { details: TMDBResult | null; onNavigate: () => void; onOpen: (ref: TitleRef) => void }) {
  if (!details) return <Empty title="No details available" />;
  return (
    <div className="stack gap-5">
      <p className="muted" style={{ maxWidth: '76ch' }}>
        {details.overview || 'No synopsis yet.'}
      </p>

      {!!details.genres?.length && (
        <div className="row gap-2 wrap">
          {details.genres.map((g) => (
            <Chip key={g}>{g}</Chip>
          ))}
        </div>
      )}

      {!!details.cast?.length && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
            Cast
          </div>
          <div className="row gap-4 wrap">
            {details.cast.slice(0, 15).map((c) => (
              <Link
                key={c.id}
                href={`/person/${c.id}`}
                className="row gap-2 cast-link"
                onClick={onNavigate}
              >
                <Avatar src={c.profile_url} name={c.name} size={34} />
                <div>
                  <div className="cast-link__name" style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    {c.name}
                  </div>
                  <div className="faint" style={{ fontSize: 'var(--text-xs)' }}>
                    {c.character}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <WhereToWatch providers={details.providers} />
      <MoreLikeThis items={details.similar} onOpen={onOpen} />
    </div>
  );
}

/** "16 Oct 2026", or "Thu 16 Oct" style wording is left to the browser's locale. */
function airDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ----------------------------------------------------------------- Episodes */
function Episodes({
  tmdbId, seasons, season, setSeason, watched, onToggle, onMarkSeason, onEdit, isCustom,
}: {
  tmdbId: number;
  onEdit: () => void;
  /** True when these counts are the user's own rather than TMDB's. */
  isCustom: boolean;
  seasons: { season_number: number; episode_count: number }[];
  season: number;
  setSeason: (n: number) => void;
  watched: Set<string>;
  onToggle: (s: number, e: number, next: boolean) => void;
  onMarkSeason: (s: number, watched: boolean) => void;
}) {
  const { cascadeEpisodes, setCascadeEpisodes } = useAppData();
  const current = seasons.find((s) => s.season_number === season) ?? seasons[0];
  const [info, setInfo] = useState<Record<number, EpisodeInfo>>({});

  // Real names, air dates and runtimes for the season on screen.
  useEffect(() => {
    if (!current) return;
    let alive = true;
    setInfo({});
    discover
      .season(tmdbId, current.season_number)
      .then((eps) => alive && setInfo(Object.fromEntries(eps.map((e) => [e.episode_number, e]))))
      .catch(() => {});
    return () => { alive = false; };
  }, [tmdbId, current?.season_number]);

  if (!seasons.length) return <Empty title="No episode data" />;

  const seasonDone = current
    ? Array.from({ length: current.episode_count }, (_, i) =>
        watched.has(`s${current.season_number}e${i + 1}`),
      ).every(Boolean)
    : false;

  return (
    <div className="stack gap-4">
      <div className="row gap-2 wrap between">
        <div className="row gap-2 wrap">
          {seasons.map((s) => {
            const done = Array.from({ length: s.episode_count }, (_, i) =>
              watched.has(`s${s.season_number}e${i + 1}`),
            ).filter(Boolean).length;
            return (
              <button
                key={s.season_number}
                className="chip"
                aria-pressed={s.season_number === season}
                onClick={() => setSeason(s.season_number)}
              >
                Season {s.season_number}
                <span className="faint">
                  {done}/{s.episode_count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="row gap-2">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            {isCustom ? 'Edit seasons (yours)' : 'Wrong episode count?'}
          </Button>
          <Button size="sm" onClick={() => current && onMarkSeason(current.season_number, !seasonDone)}>
            {seasonDone ? 'Unmark season' : 'Mark season watched'}
          </Button>
        </div>
      </div>

      <div className="row gap-3 between panel panel--inset" style={{ padding: 'var(--space-3)' }}>
        <div className="setting-row__text">
          <div className="setting-row__title">Fill in earlier episodes</div>
          <div className="setting-row__desc">
            Ticking episode 8 also marks 1–7 as watched. Turn this off if you skip around.
          </div>
        </div>
        <Switch checked={cascadeEpisodes} onChange={setCascadeEpisodes} label="Fill in earlier episodes" />
      </div>

      <div className="stack">
        {current &&
          Array.from({ length: current.episode_count }, (_, i) => {
            const num = i + 1;
            const key = `s${current.season_number}e${num}`;
            const isWatched = watched.has(key);
            return (
              <div key={key} className="episode-row" data-watched={isWatched}>
                <CheckBox
                  checked={isWatched}
                  label={`Season ${current.season_number} episode ${num}`}
                  onChange={(v) => onToggle(current.season_number, num, v)}
                />
                <span className="mono faint" style={{ fontSize: 'var(--text-xs)', width: 54 }}>
                  S{String(current.season_number).padStart(2, '0')}E{String(num).padStart(2, '0')}
                </span>
                <span className="episode-row__title grow truncate" title={info[num]?.overview || undefined}>
                  {info[num]?.name || `Episode ${num}`}
                </span>
                <span className="faint" style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>
                  {[
                    info[num]?.air_date ? airDate(info[num].air_date) : '',
                    info[num]?.runtime ? fmtRuntime(info[num].runtime) : '',
                  ].filter(Boolean).join(' · ')}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Reviews */
function Reviews({
  rows, meId, target, onChanged,
}: { rows: Review[]; meId?: number; target: TitleRef; onChanged: () => void }) {
  const mine = rows.find((r) => r.user_id === meId);
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [body, setBody] = useState(mine?.body ?? '');
  const [spoilers, setSpoilers] = useState(mine?.contains_spoilers ?? false);
  const [showHelp, setShowHelp] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRating(mine?.rating ?? 0);
    setBody(mine?.body ?? '');
    setSpoilers(mine?.contains_spoilers ?? false);
  }, [mine?.id]);

  const submit = async () => {
    if (!rating) {
      toast.error('Pick a rating first');
      return;
    }
    setBusy(true);
    try {
      await reviewsApi.upsert({
        tmdb_id: target.tmdb_id,
        media_type: target.media_type,
        rating,
        body: body.trim(),
        contains_spoilers: spoilers,
        title: target.title,
        poster_url: target.poster_url,
      });
      toast.success(mine ? 'Review updated' : 'Review posted');
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack gap-5">
      <Panel title={mine ? 'Your review' : 'Write a review'}>
        <div className="stack gap-3">
          <div className="row gap-3 wrap">
            <Stars value={rating} onChange={setRating} size={20} />
            <span className="faint">{rating ? `${(rating / 2).toFixed(1).replace(/\.0$/, '')} / 5` : 'No rating yet'}</span>
            <div className="grow" />
            <button className="chip" onClick={() => setShowHelp((s) => !s)}>
              <HelpCircle size={13} /> Formatting
            </button>
          </div>

          {showHelp && (
            <div className="panel panel--inset" style={{ padding: 'var(--space-3)' }}>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 'var(--space-2)' }}>
                {MARKDOWN_HELP.map(([syntax, meaning]) => (
                  <div key={syntax} className="row gap-2" style={{ fontSize: 'var(--text-xs)' }}>
                    <code className="mono">{syntax}</code>
                    <span className="faint">{meaning}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Textarea
            value={body}
            placeholder="What did you think? **bold**, *italic*, ||spoilers|| all work."
            onChange={(e) => setBody(e.target.value)}
          />

          {body.trim() && (
            <div className="panel panel--inset" style={{ padding: 'var(--space-3)' }}>
              <div className="eyebrow" style={{ marginBottom: 'var(--space-2)' }}>
                Preview
              </div>
              <Markdown text={body} />
            </div>
          )}

          <div className="row gap-3 between wrap">
            <label className="row gap-2" style={{ fontSize: 'var(--text-xs)' }}>
              <Switch checked={spoilers} onChange={setSpoilers} label="Contains spoilers" />
              Contains spoilers
            </label>
            <div className="row gap-2">
              {mine && (
                <Button
                  variant="danger"
                  size="sm"
                  icon={<Trash2 size={14} />}
                  onClick={async () => {
                    await reviewsApi.remove(mine.id);
                    toast.success('Review deleted');
                    onChanged();
                  }}
                >
                  Delete
                </Button>
              )}
              <Button variant="primary" disabled={busy} onClick={submit}>
                {mine ? 'Update review' : 'Post review'}
              </Button>
            </div>
          </div>
        </div>
      </Panel>

      {rows.filter((r) => r.user_id !== meId).length === 0 ? (
        <Empty title="No other reviews yet" icon={<Star size={22} />}>
          Be the first to say something about {target.title}.
        </Empty>
      ) : (
        <div className="stack gap-3">
          {rows
            .filter((r) => r.user_id !== meId)
            .map((r) => (
              <ReviewCard key={r.id} review={r} onChanged={onChanged} />
            ))}
        </div>
      )}
    </div>
  );
}

export function ReviewCard({ review, onChanged }: { review: Review; onChanged: () => void }) {
  const [revealed, setRevealed] = useState(!review.contains_spoilers);
  return (
    <article className="card" style={{ cursor: 'default' }}>
      <div className="row gap-3" style={{ marginBottom: 'var(--space-3)' }}>
        <Avatar src={review.user?.profile_picture} name={review.user?.nickname ?? review.user?.username} size={34} />
        <div className="grow">
          <div className="row gap-2">
            <strong style={{ fontSize: 'var(--text-sm)' }}>
              {review.user?.nickname ?? review.user?.username ?? 'Someone'}
            </strong>
            <Stars value={review.rating} size={13} />
            <span className="faint" style={{ fontSize: 'var(--text-xs)' }}>
              {(review.rating / 2).toFixed(1).replace(/\.0$/, '')} / 5
            </span>
          </div>
          <div className="faint" style={{ fontSize: 'var(--text-xs)' }}>
            {timeAgo(review.created_at)}
          </div>
        </div>
      </div>

      {review.contains_spoilers && !revealed ? (
        <button className="btn btn--soft btn--sm" onClick={() => setRevealed(true)}>
          <Eye size={14} /> This review has spoilers — reveal
        </button>
      ) : (
        <Markdown text={review.body} className="muted" />
      )}

      <div className="row gap-2 wrap" style={{ marginTop: 'var(--space-3)' }}>
        <button
          className="chip"
          aria-pressed={review.my_reaction === 'like'}
          onClick={async () => {
            await reviewsApi.react(review.id, 'like');
            onChanged();
          }}
        >
          <ThumbsUp size={13} /> {review.likes}
        </button>
        <button
          className="chip"
          aria-pressed={review.my_reaction === 'dislike'}
          onClick={async () => {
            await reviewsApi.react(review.id, 'dislike');
            onChanged();
          }}
        >
          <ThumbsDown size={13} /> {review.dislikes}
        </button>
        <ReviewComments reviewId={review.id} reviewAuthorId={review.user_id} count={review.comment_count ?? 0} />
      </div>
    </article>
  );
}
