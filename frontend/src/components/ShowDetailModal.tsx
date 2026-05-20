import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, Tv, Check, ChevronRight, ChevronLeft, Play, Calendar, Plus, MessageSquare, Clock } from 'lucide-react';

import AddToListMenu from './AddToListMenu';
import { getShowDetails, getMovieDetails, getSeasonDetails } from '@/api/search';
import { getShowProgress, updateShowProgress } from '@/api/progress';
import { upsertReview, deleteReview, getMyReview, getTitleReviews } from '@/api/reviews';
import type { Review } from '@/api/reviews';
import { exampleStore } from '@/data/exampleStore';
import { toast } from 'sonner';
import type { TMDBResult } from '@/types/api';

interface Episode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  air_date: string;
  runtime: number | null;
  watched: boolean;
}

interface Season {
  season_number: number;
  name?: string;
  episodes: Episode[];
}

interface Props {
  item: TMDBResult;
  onClose: () => void;
}

function saveShowMeta(showId: number, seasons: { season_number: number; episode_count: number }[]) {
  try {
    const raw = localStorage.getItem('palace_show_meta');
    const all = raw ? JSON.parse(raw) : {};
    all[showId] = {
      totalEpisodes: seasons.reduce((a, s) => a + (s.episode_count || 0), 0),
      seasons: seasons.map(s => ({ season_number: s.season_number, episode_count: s.episode_count })),
    };
    localStorage.setItem('palace_show_meta', JSON.stringify(all));
  } catch { /* noop */ }
}

function emitProgressUpdate(showId: number) {
  window.dispatchEvent(new CustomEvent('palace-show-progress', { detail: { showId } }));
}

function placeholderEpisodes(seasonNum: number, episodeCount: number): Episode[] {
  return Array.from({ length: episodeCount }, (_, i) => ({
    id: seasonNum * 1000 + i + 1,
    episode_number: i + 1,
    name: `Episode ${i + 1}`,
    overview: '',
    air_date: '',
    runtime: null,
    watched: false,
  }));
}

function formatSeconds(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}


function parseTimeInput(val: string): number | null {
  const parts = val.trim().split(':');
  if (parts.length === 2) {
    const m = parseInt(parts[0]);
    const s = parseInt(parts[1]);
    if (!isNaN(m) && !isNaN(s)) return m * 60 + s;
  }
  const n = parseInt(val);
  if (!isNaN(n)) return n * 60;
  return null;
}

export default function ShowDetailModal({ item, onClose }: Props) {
  const [detail, setDetail] = useState<TMDBResult | null>(null);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [watchedMap, setWatchedMap] = useState<Record<string, boolean>>({});
  const [showOverview, setShowOverview] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [seasonCache, setSeasonCache] = useState<Record<number, Season>>({});
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [epPositions, setEpPositions] = useState<Record<string, number>>({});
  const [editingEpPos, setEditingEpPos] = useState<string | null>(null);
  const [posInputVal, setPosInputVal] = useState('');
  const [draggingEpKey, setDraggingEpKey] = useState<string | null>(null);
  const [draggingEpSecs, setDraggingEpSecs] = useState(0);
  const epDragRef = useRef<{ key: string; runtime: number; barEl: HTMLDivElement; secs: number } | null>(null);
  const itemIdRef = useRef(item.id);
  const reviewsSectionRef = useRef<HTMLDivElement>(null);
  const toggleWatchedRef = useRef<(s: number, e: number) => void>(() => {});
  const watchedMapRef = useRef<Record<string, boolean>>({});
  // Review state
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [reviewRating, setReviewRating] = useState<number | null>(null);
  const [reviewContent, setReviewContent] = useState('');
  const [reviewStarHover, setReviewStarHover] = useState<number | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollArrows = useCallback(() => {
    const el = tabsRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  const scrollTabs = (dir: 'left' | 'right') => {
    const el = tabsRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === 'left' ? -150 : 150, behavior: 'smooth' });
  };

  // blur background
  useEffect(() => {
    const root = document.getElementById('root');
    if (root) root.style.filter = 'blur(16px) brightness(0.65)';
    return () => { if (root) root.style.filter = ''; };
  }, []);

  // keep item id ref fresh
  useEffect(() => { itemIdRef.current = item.id; }, [item.id]);

  // global drag listeners for episode progress bar
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const drag = epDragRef.current;
      if (!drag) return;
      const rect = drag.barEl.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const secs = Math.round(pct * drag.runtime * 60);
      drag.secs = secs;
      setDraggingEpSecs(secs);
    };
    const onUp = () => {
      const drag = epDragRef.current;
      if (!drag) return;
      const { key, secs, runtime } = drag;
      setEpPositions(prev => {
        const next = { ...prev, [key]: secs };
        localStorage.setItem(`palace_ep_pos_${itemIdRef.current}`, JSON.stringify(next));
        return next;
      });
      // Auto-mark watched when reaching the end
      if (runtime > 0 && secs >= runtime * 60 * 0.97 && !watchedMapRef.current[key]) {
        const [sn, en] = key.split('-').map(Number);
        toggleWatchedRef.current(sn, en);
      }
      epDragRef.current = null;
      setDraggingEpKey(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // load episode positions from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`palace_ep_pos_${item.id}`);
      if (raw) setEpPositions(JSON.parse(raw));
    } catch { /* noop */ }
  }, [item.id]);

  // load show details + progress
  useEffect(() => {
    const id = item.id;
    let cancelled = false;
    async function load() {
      try {
        const itemTitle = item.title;
        let data = await getShowDetails(id);
        if (!data || (itemTitle && data.title !== itemTitle)) {
          const movieData = await getMovieDetails(id);
          if (movieData && (!itemTitle || movieData.title === itemTitle)) data = movieData;
        }
        if (!cancelled && data) {
          setDetail(data);
          const validSeasons = (data.seasons || []).filter((s: { season_number: number }) => s.season_number > 0);
          if (validSeasons.length > 0) {
            setSelectedSeason(validSeasons[0].season_number);
            saveShowMeta(item.id, validSeasons);
          }
        }
      } catch { /* ignore */ }
      try {
        const progress = await getShowProgress(id);
        if (!cancelled) setWatchedMap(progress);
      } catch { /* ignore */ }
    }
    load();
    return () => { cancelled = true; };
  }, [item.id]);

  // fetch real episode data for selected season
  useEffect(() => {
    if (!selectedSeason || seasonCache[selectedSeason]) return;
    let cancelled = false;
    getSeasonDetails(item.id, selectedSeason).then(data => {
      if (cancelled || !data) return;
      setSeasonCache(prev => ({
        ...prev,
        [selectedSeason]: {
          season_number: data.season_number,
          name: data.name,
          episodes: data.episodes.map(ep => ({
            id: selectedSeason * 1000 + ep.episode_number,
            episode_number: ep.episode_number,
            name: ep.name,
            overview: ep.overview,
            air_date: ep.air_date,
            runtime: ep.runtime ?? null,
            watched: false,
          })),
        },
      }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [item.id, selectedSeason]);

  const displayItem = detail || item;

  // filter out season 0
  const seasons: Season[] = (displayItem.seasons || [])
    .filter((s: { season_number: number }) => s.season_number > 0)
    .map((s: { season_number: number; episode_count: number }) => {
      const cached = seasonCache[s.season_number];
      return {
        season_number: s.season_number,
        name: cached?.name,
        episodes: cached?.episodes ?? placeholderEpisodes(s.season_number, s.episode_count),
      };
    });

  useEffect(() => { updateScrollArrows(); }, [seasons.length, updateScrollArrows]);

  const currentSeason = seasons.find(s => s.season_number === selectedSeason) || seasons[0];
  const episodes = currentSeason?.episodes.map(ep => ({
    ...ep,
    watched: watchedMap[`${selectedSeason}-${ep.episode_number}`] || false,
  })) || [];

  const toggleWatched = useCallback((seasonNum: number, epNum: number) => {
    const key = `${seasonNum}-${epNum}`;
    const nextValue = !watchedMap[key];
    setWatchedMap(prev => ({ ...prev, [key]: nextValue }));
    updateShowProgress(item.id, seasonNum, epNum, nextValue)
      .then(() => emitProgressUpdate(item.id))
      .catch(() => {});
    exampleStore.dismiss();
  }, [item.id, watchedMap]);

  // keep refs fresh every render so drag handler always has latest values
  toggleWatchedRef.current = toggleWatched;
  watchedMapRef.current = watchedMap;

  const markSeason = useCallback((seasonNum: number, watched: boolean) => {
    const season = seasons.find(s => s.season_number === seasonNum);
    if (!season) return;
    setWatchedMap(prev => {
      const next = { ...prev };
      season.episodes.forEach(ep => { next[`${seasonNum}-${ep.episode_number}`] = watched; });
      return next;
    });
    Promise.all(season.episodes.map(ep => updateShowProgress(item.id, seasonNum, ep.episode_number, watched)))
      .then(() => emitProgressUpdate(item.id)).catch(() => {});
    exampleStore.dismiss();
  }, [item.id, seasons]);

  function saveEpPosition(seasonNum: number, epNum: number, secs: number) {
    const key = `${seasonNum}-${epNum}`;
    const next = { ...epPositions, [key]: secs };
    setEpPositions(next);
    localStorage.setItem(`palace_ep_pos_${item.id}`, JSON.stringify(next));
  }

  // scroll to reviews when opened so it's always reachable regardless of episode count
  useEffect(() => {
    if (reviewsOpen) {
      setTimeout(() => reviewsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }, [reviewsOpen]);

  // load reviews when panel opens
  useEffect(() => {
    if (!reviewsOpen || reviewsLoaded) return;
    let cancelled = false;
    Promise.all([getMyReview(displayItem.id, 'tv'), getTitleReviews(displayItem.id, 'tv')])
      .then(([my, all]) => {
        if (cancelled) return;
        setMyReview(my);
        if (my) { setReviewRating(my.rating); setReviewContent(my.content); }
        setAllReviews(all);
        setReviewsLoaded(true);
      }).catch(() => {});
    return () => { cancelled = true; };
  }, [reviewsOpen, reviewsLoaded, displayItem.id]);

  async function handleSaveReview() {
    if (!reviewRating && !reviewContent.trim()) return;
    setReviewSaving(true);
    try {
      const saved = await upsertReview({ tmdb_id: displayItem.id, media_type: 'tv', title: displayItem.title, poster_url: displayItem.poster_url ?? undefined, rating: reviewRating, content: reviewContent });
      setMyReview(saved);
      toast.success('Review saved');
      // refresh all reviews
      getTitleReviews(displayItem.id, 'tv').then(setAllReviews).catch(() => {});
    } catch { /* handled by interceptor */ }
    finally { setReviewSaving(false); }
  }

  async function handleDeleteReview() {
    if (!myReview) return;
    try {
      await deleteReview(myReview.id);
      setMyReview(null); setReviewRating(null); setReviewContent('');
      toast.success('Review deleted');
      getTitleReviews(displayItem.id, 'tv').then(setAllReviews).catch(() => {});
    } catch { /* handled */ }
  }

  const totalEpisodes = seasons.reduce((a, s) => a + s.episodes.length, 0);
  const watchedCount = Object.values(watchedMap).filter(Boolean).length;
  const pct = totalEpisodes > 0 ? Math.round((watchedCount / totalEpisodes) * 100) : 0;

  const nextEpisode = (() => {
    for (const season of seasons) {
      for (const ep of season.episodes) {
        if (!watchedMap[`${season.season_number}-${ep.episode_number}`]) {
          return { season: season.season_number, episode: ep.episode_number, name: ep.name };
        }
      }
    }
    return null;
  })();

  const year = displayItem.release_date ? displayItem.release_date.slice(0, 4) : '';

  return createPortal(
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="modal-in"
        style={{
          width: 'min(920px, 96vw)', maxHeight: '90vh',
          borderRadius: '16px', overflow: 'hidden',
          background: 'linear-gradient(180deg, var(--t-primary-18) 0%, var(--t-primary-10) 100%)',
          border: '1px solid rgba(255,255,255,0.2)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          position: 'relative',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={onClose} style={{ position: 'absolute', top: '14px', right: '14px', zIndex: 20, width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', transition: 'background 0.15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,50,50,0.8)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.55)'; }}>
          <X style={{ width: '14px' }} />
        </button>

        {/* ── HEADER: poster + info ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: '20px', padding: '20px', flexShrink: 0, background: 'linear-gradient(180deg, var(--t-primary-25) 0%, var(--t-primary-12) 100%)' }}>
          {/* Poster */}
          <div style={{ aspectRatio: '2/3', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', background: '#0a0814', flexShrink: 0 }}>
            {displayItem.poster_url
              ? <img src={displayItem.poster_url} alt={displayItem.title} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block' }} />
              : <div style={{ width: '100%', height: '100%', background: 'var(--t-primary-20)' }} />}
          </div>

          {/* Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0, paddingTop: '4px' }}>
            {/* Meta row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--t-primary-18)', color: 'var(--t-primary)', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '99px', letterSpacing: '0.5px' }}>
                <Tv style={{ width: '10px' }} /> TV SHOW
              </span>
              {displayItem.rating > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#fbbf24', fontSize: '12px', fontWeight: 700 }}>
                  <Star style={{ width: '12px' }} /> {displayItem.rating.toFixed(1)}
                </span>
              )}
              {year && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{year}</span>}
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>· {totalEpisodes} episodes</span>
            </div>

            {/* Title + tagline */}
            <div>
              <h2 style={{ margin: 0, color: '#fff', fontSize: '26px', fontWeight: 700, lineHeight: 1.15, overflowWrap: 'break-word' }}>{displayItem.title}</h2>
              {displayItem.tagline && <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontStyle: 'italic' }}>{displayItem.tagline}</p>}
            </div>

            {/* Overview */}
            {displayItem.overview && (
              <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '12px', lineHeight: 1.55, maxWidth: '520px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' as any }}>
                {displayItem.overview}
              </p>
            )}

            {/* Genres */}
            {displayItem.genres && displayItem.genres.length > 0 && (
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {displayItem.genres.slice(0, 4).map(g => (
                  <span key={g} style={{ background: 'var(--t-primary-18)', color: 'var(--t-primary)', fontSize: '11px', padding: '3px 9px', borderRadius: '99px', border: '1px solid var(--t-primary-25)' }}>{g}</span>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginTop: '4px' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button ref={addButtonRef} onClick={() => setMenuOpen(!menuOpen)}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 13px', borderRadius: '8px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; }}
                  onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}>
                  <Plus style={{ width: '12px' }} /> Add to List
                </button>
                {menuOpen && <AddToListMenu onClose={() => setMenuOpen(false)} triggerRef={addButtonRef} movieTitle={displayItem.title} movieData={{ tmdb_id: displayItem.id, title: displayItem.title, poster_url: displayItem.poster_url, media_type: 'tv' }} placement="above" />}
              </div>
              {displayItem.trailer_key && (
                <a href={`https://youtube.com/watch?v=${displayItem.trailer_key}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 13px', borderRadius: '8px', background: 'rgba(200,60,60,0.7)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '12px', fontWeight: 600, textDecoration: 'none', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,60,60,0.9)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(200,60,60,0.7)'; }}>
                  <Play style={{ width: '12px' }} /> Trailer
                </a>
              )}
              {displayItem.tmdb_url && (
                <a href={displayItem.tmdb_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 13px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: '12px', fontWeight: 500, textDecoration: 'none', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}>
                  <ChevronRight style={{ width: '12px' }} /> TMDB
                </a>
              )}
              <button onClick={() => setReviewsOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 13px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}>
                <MessageSquare style={{ width: '12px' }} /> Reviews
              </button>
            </div>
          </div>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

          {/* Progress + resume */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 600 }}>Overall progress</span>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)' }}><span style={{ color: '#fff', fontWeight: 700 }}>{watchedCount}</span> / {totalEpisodes} <span style={{ color: 'var(--t-primary)' }}>({pct}%)</span></span>
              </div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  style={{ height: '100%', background: 'linear-gradient(90deg, var(--t-primary), var(--t-glow))', borderRadius: '99px' }} />
              </div>
            </div>
            {!nextEpisode && totalEpisodes > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#50c878', fontWeight: 600, flexShrink: 0 }}>
                <Check style={{ width: '12px' }} /> All watched!
              </span>
            )}
          </div>

          {/* Cast */}
          {displayItem.cast && displayItem.cast.length > 0 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', marginBottom: '10px' }}>CAST</div>
              <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.15) transparent' }}>
                {displayItem.cast.slice(0, 10).map(c => (
                  <div key={c.id} style={{ flexShrink: 0, textAlign: 'center', width: '60px' }}>
                    {c.profile_url
                      ? <img src={c.profile_url} alt={c.name} style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.12)', margin: '0 auto 4px', display: 'block' }} />
                      : <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--t-primary-25)', margin: '0 auto 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                          {c.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>}
                    <div style={{ color: '#fff', fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.character}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Episodes */}
          {seasons.length > 0 && (
            <div style={{ padding: '12px 20px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>

              {/* Season tabs row */}
              <div style={{ position: 'relative', marginBottom: '12px' }}>
                {canScrollLeft && (
                  <button onClick={() => scrollTabs('left')} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, zIndex: 2, width: '24px', border: 'none', background: 'linear-gradient(90deg, rgba(20,15,35,0.9) 0%, transparent 100%)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    <ChevronLeft style={{ width: '13px', color: '#fff' }} />
                  </button>
                )}
                {canScrollRight && (
                  <button onClick={() => scrollTabs('right')} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, zIndex: 2, width: '24px', border: 'none', background: 'linear-gradient(270deg, rgba(20,15,35,0.9) 0%, transparent 100%)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                    <ChevronRight style={{ width: '13px', color: '#fff' }} />
                  </button>
                )}
                <div ref={tabsRef} onScroll={updateScrollArrows}
                  onWheel={e => { const el = e.currentTarget; if (el.scrollWidth > el.clientWidth) { el.scrollLeft += e.deltaY; e.preventDefault(); } }}
                  style={{ display: 'flex', gap: '5px', overflowX: 'auto', scrollbarWidth: 'none', alignItems: 'center' }}
                  className="hide-scrollbar">
                  {seasons.map(s => {
                    const sw = s.episodes.filter(ep => watchedMap[`${s.season_number}-${ep.episode_number}`]).length;
                    const st = s.episodes.length;
                    const isActive = selectedSeason === s.season_number;
                    return (
                      <button key={s.season_number} onClick={() => setSelectedSeason(s.season_number)}
                        style={{ padding: '5px 11px', borderRadius: '7px', border: isActive ? '1px solid var(--t-primary-40)' : '1px solid rgba(255,255,255,0.08)', background: isActive ? 'var(--t-primary-20)' : 'rgba(255,255,255,0.04)', color: isActive ? '#fff' : 'rgba(255,255,255,0.6)', fontSize: '12px', fontWeight: isActive ? 600 : 400, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px', transition: 'all 0.15s' }}>
                        {s.name && s.name !== `Season ${s.season_number}` ? s.name : `S${s.season_number}`}
                        <span style={{ color: isActive ? 'var(--t-primary)' : 'rgba(255,255,255,0.35)', fontSize: '11px' }}>{sw}/{st}</span>
                        {sw === st && st > 0 && <Check style={{ width: '10px', color: '#50c878' }} />}
                      </button>
                    );
                  })}
                  <button onClick={() => markSeason(selectedSeason, !episodes.every(ep => ep.watched))}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--t-primary)', fontSize: '11px', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', whiteSpace: 'nowrap', padding: '5px 2px', flexShrink: 0 }}>
                    {episodes.every(ep => ep.watched) ? 'Mark all unwatched' : 'Mark all watched'}
                  </button>
                </div>
              </div>

              {/* Episode list — max 5 rows visible */}
              <div style={{ maxHeight: '255px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <AnimatePresence mode="wait">
                  <motion.div key={selectedSeason} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
                    style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {episodes.map(ep => {
                      const isOpen = showOverview === ep.episode_number;
                      const posKey = `${selectedSeason}-${ep.episode_number}`;
                      const posSecs = epPositions[posKey];
                      const isEditingPos = editingEpPos === posKey;
                      return (
                        <div key={ep.episode_number} style={{ borderRadius: '8px', border: ep.watched ? '0.5px solid rgba(80,200,120,0.2)' : '0.5px solid rgba(255,255,255,0.07)', background: ep.watched ? 'rgba(80,200,120,0.04)' : 'rgba(255,255,255,0.03)', overflow: 'hidden' }}>
                          {/* Episode row */}
                          <div onClick={() => setShowOverview(isOpen ? null : ep.episode_number)}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', cursor: 'pointer' }}>
                            <button onClick={e => { e.stopPropagation(); toggleWatched(selectedSeason, ep.episode_number); }}
                              style={{ width: '18px', height: '18px', borderRadius: '4px', border: ep.watched ? '2px solid #50c878' : '2px solid rgba(255,255,255,0.2)', background: ep.watched ? 'rgba(80,200,120,0.15)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}>
                              {ep.watched && <Check style={{ width: '11px', color: '#50c878' }} />}
                            </button>
                            <span style={{ color: 'var(--t-primary)', fontSize: '12px', fontWeight: 600, minWidth: '20px', textAlign: 'center', flexShrink: 0 }}>{ep.episode_number}</span>
                            <span style={{ flex: 1, fontSize: '13px', color: ep.watched ? 'rgba(255,255,255,0.4)' : '#fff', textDecoration: ep.watched ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.name}</span>
                            {ep.runtime && (
                              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{ep.runtime}m</span>
                            )}
                            <div style={{ flexShrink: 0, transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>
                              <ChevronRight style={{ width: '12px', color: 'rgba(255,255,255,0.25)' }} />
                            </div>
                          </div>

                          {/* Expanded detail */}
                          <AnimatePresence>
                            {isOpen && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                                <div style={{ padding: '2px 12px 12px 42px' }}>
                                  {ep.overview && (
                                    <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>{ep.overview}</p>
                                  )}
                                  {ep.air_date && (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '10px' }}>
                                      <Calendar style={{ width: '9px' }} /> {ep.air_date}
                                    </span>
                                  )}

                                  {/* Episode progress bar */}
                                  <div style={{ marginTop: '2px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                                        <Clock style={{ width: '10px' }} /> Your Progress
                                      </span>
                                      {isEditingPos ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }} onClick={e => e.stopPropagation()}>
                                          <input
                                            autoFocus
                                            value={posInputVal}
                                            onChange={e => setPosInputVal(e.target.value)}
                                            placeholder="M:SS"
                                            style={{ width: '54px', padding: '2px 6px', borderRadius: '5px', border: '1px solid var(--t-primary-40)', background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: '11px', fontFamily: 'inherit', outline: 'none', textAlign: 'center' }}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') { const s = parseTimeInput(posInputVal); if (s !== null) saveEpPosition(selectedSeason, ep.episode_number, s); setEditingEpPos(null); }
                                              if (e.key === 'Escape') setEditingEpPos(null);
                                            }}
                                          />
                                          {ep.runtime && <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>/ {ep.runtime}m</span>}
                                          <button onClick={e => { e.stopPropagation(); const s = parseTimeInput(posInputVal); if (s !== null) saveEpPosition(selectedSeason, ep.episode_number, s); setEditingEpPos(null); }}
                                            style={{ fontSize: '10px', color: 'var(--t-primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700 }}>✓</button>
                                        </div>
                                      ) : (
                                        <button onClick={e => { e.stopPropagation(); setEditingEpPos(posKey); setPosInputVal(posSecs != null ? formatSeconds(posSecs) : ''); }}
                                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                                          <span style={{ fontSize: '11px', color: '#fff', fontWeight: 600 }}>
                                            {draggingEpKey === posKey ? formatSeconds(draggingEpSecs) : (posSecs != null ? formatSeconds(posSecs) : '0:00')}
                                            {ep.runtime ? <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}> / {ep.runtime}m</span> : ''}
                                          </span>
                                        </button>
                                      )}
                                    </div>
                                    {/* Draggable progress bar with thumb */}
                                    {(() => {
                                      const isDraggingThis = draggingEpKey === posKey;
                                      const displaySecs = isDraggingThis ? draggingEpSecs : (posSecs ?? 0);
                                      const pct = ep.runtime ? Math.min(100, (displaySecs / (ep.runtime * 60)) * 100) : 0;
                                      return (
                                        <div
                                          onMouseDown={e => {
                                            e.stopPropagation();
                                            if (!ep.runtime) return;
                                            const track = e.currentTarget.querySelector('.ep-track') as HTMLDivElement;
                                            if (!track) return;
                                            const rect = track.getBoundingClientRect();
                                            const initPct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                                            const initSecs = Math.round(initPct * ep.runtime * 60);
                                            epDragRef.current = { key: posKey, runtime: ep.runtime, barEl: track, secs: initSecs };
                                            setDraggingEpKey(posKey);
                                            setDraggingEpSecs(initSecs);
                                          }}
                                          style={{ position: 'relative', padding: '6px 0', userSelect: 'none', cursor: ep.runtime ? (isDraggingThis ? 'ew-resize' : 'pointer') : 'default' }}>
                                          {/* Track */}
                                          <div className="ep-track" style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
                                            <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--t-primary), var(--t-glow))', borderRadius: '99px', boxShadow: '0 0 8px var(--t-primary-55)' }} />
                                          </div>
                                          {/* Thumb */}
                                          <div style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%, -50%)', width: '14px', height: '14px', borderRadius: '50%', background: 'var(--t-primary)', border: '2px solid #fff', boxShadow: '0 0 8px var(--t-primary-55)', pointerEvents: 'none', zIndex: 1 }} />
                                        </div>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* ── REVIEWS section (bottom of scrollable body) ── */}
          {reviewsOpen && (
          <div ref={reviewsSectionRef} style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '20px', background: 'var(--t-primary-08)' }}>
            {/* Write your review */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>Your Rating</div>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                {[1,2,3,4,5].map(star => (
                  <button key={star}
                    onClick={() => setReviewRating(star === reviewRating ? null : star)}
                    onMouseEnter={() => setReviewStarHover(star)}
                    onMouseLeave={() => setReviewStarHover(null)}
                    style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', lineHeight: 0 }}>
                    <Star style={{ width: '22px', height: '22px', color: (reviewStarHover ?? reviewRating ?? 0) >= star ? '#ffd700' : 'rgba(255,255,255,0.2)', fill: (reviewStarHover ?? reviewRating ?? 0) >= star ? '#ffd700' : 'none', transition: 'color 0.1s, fill 0.1s' }} />
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Your Thoughts</div>
              <textarea value={reviewContent} onChange={e => setReviewContent(e.target.value)} placeholder="What did you think? (optional)" rows={3}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--t-primary)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }} />
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button onClick={handleSaveReview} disabled={reviewSaving || (!reviewRating && !reviewContent.trim())}
                  style={{ padding: '8px 18px', borderRadius: '8px', background: 'var(--t-primary)', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', opacity: (!reviewRating && !reviewContent.trim()) ? 0.4 : 1 }}>
                  {reviewSaving ? 'Saving…' : myReview ? 'Update Review' : 'Save Review'}
                </button>
                {myReview && (
                  <button onClick={handleDeleteReview} style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(220,60,60,0.12)', border: '1px solid rgba(220,60,60,0.25)', color: '#f56565', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>
                )}
              </div>
            </div>

            {/* Palace reviews */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '12px' }}>
                Palace Reviews {allReviews.length > 0 && <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>· {allReviews.length}</span>}
              </div>
              {allReviews.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '20px 0' }}>No reviews yet — be the first!</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {allReviews.map(r => {
                    const name = r.author?.nickname || r.author?.username || 'User';
                    return (
                      <div key={r.id} style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                          {r.author?.profile_picture
                            ? <img src={r.author.profile_picture} alt="" style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }} />
                            : <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--t-primary-25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff' }}>{name.slice(0,2).toUpperCase()}</div>}
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff', flex: 1 }}>{name}</span>
                          {r.rating !== null && (
                            <div style={{ display: 'flex', gap: '2px' }}>
                              {[1,2,3,4,5].map(s => <Star key={s} style={{ width: '12px', height: '12px', color: (r.rating ?? 0) >= s ? '#ffd700' : 'rgba(255,255,255,0.15)', fill: (r.rating ?? 0) >= s ? '#ffd700' : 'none' }} />)}
                            </div>
                          )}
                        </div>
                        {r.content && <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>{r.content}</p>}
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        </div>{/* closes scrollable body */}

      </div>{/* closes modal-in */}
    </div>,
    document.body
  );
}
