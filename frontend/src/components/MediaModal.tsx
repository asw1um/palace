import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check, Clock, Eye, ExternalLink, HelpCircle, ListPlus, Plus, Star, ThumbsDown,
  ThumbsUp, Trash2, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { discover, progress as progressApi, reviews as reviewsApi } from '@/data/api';
import type { Review, TMDBResult } from '@/data/types';
import { percent, runtime as fmtRuntime, timeAgo, year } from '@/lib/format';
import { emit } from '@/lib/bus';
import { pop, staggerIn } from '@/lib/motion';
import { useAuth } from '@/data/AuthContext';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Avatar, CheckBox, Chip, Empty, Panel, Ring, Skeleton, Stars, Tabs } from './ui/Bits';
import { Switch, Textarea } from './ui/Field';
import { Markdown, MARKDOWN_HELP } from './Markdown';
import { useAppData, type TitleRef } from './AppData';

type Tab = 'overview' | 'episodes' | 'reviews';

export function MediaModal({
  open, target, onClose,
}: { open: boolean; target: TitleRef | null; onClose: () => void }) {
  const { openAddTo, quickAdd, cascadeEpisodes } = useAppData();
  const { user } = useAuth();
  const [details, setDetails] = useState<TMDBResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [watchedEps, setWatchedEps] = useState<Set<string>>(new Set());
  const [movieWatched, setMovieWatched] = useState(false);
  const [season, setSeason] = useState(1);
  const [rows, setRows] = useState<Review[]>([]);

  const isTv = target?.media_type === 'tv';

  const loadProgress = useCallback(async () => {
    if (!target) return;
    const p = await progressApi.forTitle(target.media_type, target.tmdb_id);
    setWatchedEps(new Set(p.episodes));
    setMovieWatched(p.watched);
  }, [target]);

  const loadReviews = useCallback(async () => {
    if (!target) return;
    setRows(await reviewsApi.forTitle(target.tmdb_id, target.media_type).catch(() => []));
  }, [target]);

  useEffect(() => {
    if (!open || !target) return;
    setTab('overview');
    setSeason(1);
    setLoading(true);
    discover
      .details(target.tmdb_id, target.media_type)
      .then((d) => setDetails(d ?? null))
      .catch(() => setDetails(null))
      .finally(() => setLoading(false));
    loadProgress();
    loadReviews();
  }, [open, target, loadProgress, loadReviews]);

  const seasons = details?.seasons ?? [];
  const totalEpisodes = details?.number_of_episodes ?? 0;
  const pct = isTv
    ? percent(watchedEps.size, totalEpisodes)
    : movieWatched
      ? 100
      : 0;

  const userScore = useMemo(() => {
    if (!rows.length) return null;
    return rows.reduce((a, r) => a + r.rating, 0) / rows.length;
  }, [rows]);

  const toggleEpisode = async (sNum: number, eNum: number, next: boolean) => {
    if (!target) return;
    await progressApi.setEpisode(target.tmdb_id, sNum, eNum, next, cascadeEpisodes);
    await loadProgress();
    emit('progress');
    emit('lists');
  };

  const toggleMovie = async () => {
    if (!target) return;
    await progressApi.setMovieWatched(target.tmdb_id, !movieWatched);
    setMovieWatched(!movieWatched);
    emit('progress');
    emit('lists');
    toast.success(!movieWatched ? 'Marked as watched' : 'Marked as unwatched');
  };

  const markSeason = async (sNum: number, watched: boolean) => {
    if (!target) return;
    const meta = seasons.find((s) => s.season_number === sNum);
    if (!meta) return;
    await progressApi.setEpisode(target.tmdb_id, sNum, watched ? meta.episode_count : 1, watched, true);
    await loadProgress();
    emit('progress');
  };

  const tabs = [
    { value: 'overview' as Tab, label: 'Overview' },
    ...(isTv ? [{ value: 'episodes' as Tab, label: 'Episodes' }] : []),
    { value: 'reviews' as Tab, label: 'Reviews', count: rows.length },
  ];

  return (
    <Modal open={open} onClose={onClose} hideHeader className="media-modal" width={940}>
      {loading && !details ? (
        <div className="stack gap-4" style={{ padding: 'var(--sp-6)' }}>
          <Skeleton h={180} r="var(--r-md)" />
          <Skeleton h={24} w="50%" />
          <Skeleton h={80} />
        </div>
      ) : (
        <>
          <div className="media-hero shine">
            {(details?.backdrop_url || target?.poster_url) && (
              <div
                className="media-hero__bg"
                style={{ backgroundImage: `url(${details?.backdrop_url ?? target?.poster_url})` }}
              />
            )}
            <div className="media-hero__scrim" />

            <div className="media-hero__poster">
              {target?.poster_url && <img src={target.poster_url} alt="" />}
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
                {/* Palace member average sits right next to the TMDB score — issue #111 */}
                {userScore !== null && (
                  <Chip tone="accent">
                    <Users size={12} /> {userScore.toFixed(1)} Palace · {rows.length}
                  </Chip>
                )}
                {!isTv && details?.runtime ? (
                  <Chip>
                    <Clock size={12} /> {fmtRuntime(details.runtime)}
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
                  // Movies get the same one-click "watched" shows have — issue #33
                  <Button
                    variant={movieWatched ? 'soft' : 'default'}
                    icon={movieWatched ? <Check size={15} /> : <Eye size={15} />}
                    bounce
                    onClick={toggleMovie}
                  >
                    {movieWatched ? 'Watched' : 'Mark watched'}
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
                    <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
                      {pct}% watched
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ padding: '0 var(--sp-6)' }}>
            <Tabs tabs={tabs} value={tab} onChange={setTab} />
          </div>

          <div style={{ padding: 'var(--sp-5) var(--sp-6) var(--sp-6)' }}>
            {tab === 'overview' && <Overview details={details} />}

            {tab === 'episodes' && isTv && (
              <Episodes
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
    </Modal>
  );
}

/* ----------------------------------------------------------------- Overview */
function Overview({ details }: { details: TMDBResult | null }) {
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
          <div className="eyebrow" style={{ marginBottom: 'var(--sp-3)' }}>
            Cast
          </div>
          <div className="row gap-4 wrap">
            {details.cast.slice(0, 8).map((c) => (
              <div key={c.id} className="row gap-2">
                <Avatar src={c.profile_url} name={c.name} size={34} />
                <div>
                  <div style={{ fontSize: 'var(--fs-13)', fontWeight: 600 }}>{c.name}</div>
                  <div className="faint" style={{ fontSize: 'var(--fs-11)' }}>
                    {c.character}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- Episodes */
function Episodes({
  seasons, season, setSeason, watched, onToggle, onMarkSeason,
}: {
  seasons: { season_number: number; episode_count: number }[];
  season: number;
  setSeason: (n: number) => void;
  watched: Set<string>;
  onToggle: (s: number, e: number, next: boolean) => void;
  onMarkSeason: (s: number, watched: boolean) => void;
}) {
  const { cascadeEpisodes, setCascadeEpisodes } = useAppData();
  const current = seasons.find((s) => s.season_number === season) ?? seasons[0];

  useEffect(() => {
    staggerIn(document.querySelectorAll('.episode-row'), { y: 8, each: 12 });
  }, [season]);

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
        <Button size="sm" onClick={() => current && onMarkSeason(current.season_number, !seasonDone)}>
          {seasonDone ? 'Unmark season' : 'Mark season watched'}
        </Button>
      </div>

      <div className="row gap-3 between panel panel--inset" style={{ padding: 'var(--sp-3)' }}>
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
                <span className="mono faint" style={{ fontSize: 'var(--fs-12)', width: 54 }}>
                  S{String(current.season_number).padStart(2, '0')}E{String(num).padStart(2, '0')}
                </span>
                <span className="episode-row__title grow truncate">Episode {num}</span>
                <span className="faint" style={{ fontSize: 'var(--fs-12)' }}>
                  45m
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
            <span className="faint">{rating ? `${rating}/10` : 'No rating yet'}</span>
            <div className="grow" />
            <button className="chip" onClick={() => setShowHelp((s) => !s)}>
              <HelpCircle size={13} /> Formatting
            </button>
          </div>

          {showHelp && (
            <div className="panel panel--inset" style={{ padding: 'var(--sp-3)' }}>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 'var(--sp-2)' }}>
                {MARKDOWN_HELP.map(([syntax, meaning]) => (
                  <div key={syntax} className="row gap-2" style={{ fontSize: 'var(--fs-12)' }}>
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
            <div className="panel panel--inset" style={{ padding: 'var(--sp-3)' }}>
              <div className="eyebrow" style={{ marginBottom: 'var(--sp-2)' }}>
                Preview
              </div>
              <Markdown text={body} />
            </div>
          )}

          <div className="row gap-3 between wrap">
            <label className="row gap-2" style={{ fontSize: 'var(--fs-12)' }}>
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
      <div className="row gap-3" style={{ marginBottom: 'var(--sp-3)' }}>
        <Avatar src={review.user?.profile_picture} name={review.user?.nickname ?? review.user?.username} size={34} />
        <div className="grow">
          <div className="row gap-2">
            <strong style={{ fontSize: 'var(--fs-13)' }}>
              {review.user?.nickname ?? review.user?.username ?? 'Someone'}
            </strong>
            <Stars value={review.rating} size={13} />
            <span className="faint" style={{ fontSize: 'var(--fs-11)' }}>
              {review.rating}/10
            </span>
          </div>
          <div className="faint" style={{ fontSize: 'var(--fs-11)' }}>
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

      <div className="row gap-2" style={{ marginTop: 'var(--sp-3)' }}>
        <button
          className="chip"
          aria-pressed={review.my_reaction === 'like'}
          onClick={async (e) => {
            pop(e.currentTarget);
            await reviewsApi.react(review.id, 'like');
            onChanged();
          }}
        >
          <ThumbsUp size={13} /> {review.likes}
        </button>
        <button
          className="chip"
          aria-pressed={review.my_reaction === 'dislike'}
          onClick={async (e) => {
            pop(e.currentTarget);
            await reviewsApi.react(review.id, 'dislike');
            onChanged();
          }}
        >
          <ThumbsDown size={13} /> {review.dislikes}
        </button>
      </div>
    </article>
  );
}
