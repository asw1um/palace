import React, { useRef, useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { TMDBResult } from '@/types/api';
import { X, Star, Play, Film, Tv, Plus, Clock, MessageSquare, ChevronRight } from 'lucide-react';

import AddToListMenu from './AddToListMenu';
import { get_movie_details, get_tv_details } from '@/api/search';
import { get_movie_progress, update_movie_progress } from '@/api/progress';
import { upsert_review, delete_review, get_my_review, get_title_reviews } from '@/api/reviews';
import type { Review } from '@/api/reviews';
import { toast } from 'sonner';

interface Props {
  item: TMDBResult | null;
  onClose: () => void;
}

export default function MediaDetailModal({ item, onClose }: Props) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [detail, setDetail] = useState<TMDBResult | null>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const reviewsSectionRef = useRef<HTMLDivElement>(null);

  // Reviews state
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [reviewRating, setReviewRating] = useState<number | null>(null);
  const [reviewContent, setReviewContent] = useState('');
  const [reviewStarHover, setReviewStarHover] = useState<number | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);

  useEffect(() => {
    const root = document.getElementById('root');
    if (root) root.style.filter = 'blur(16px) brightness(0.65)';
    return () => { if (root) root.style.filter = ''; };
  }, []);

  useEffect(() => {
    if (!item) return;
    const id = item.id;
    let cancelled = false;
    async function load() {
      try {
        const itemTitle = item?.title;
        let data = await get_movie_details(id);
        if (!data || (itemTitle && data.title !== itemTitle)) {
          const showData = await get_tv_details(id);
          if (showData && (!itemTitle || showData.title === itemTitle)) data = showData;
        }
        if (!cancelled) setDetail(data);
      } catch { /* ignore */ }
    }
    load();
    return () => { cancelled = true; };
  }, [item?.id]);

  if (!item) return null;
  const displayItem = detail || item;

  const year = displayItem.release_date ? displayItem.release_date.slice(0, 4) : '';
  const isMovie = displayItem.media_type !== 'tv';
  const media_type = isMovie ? 'movie' : 'tv';
  const runtimeDisplay = isMovie && displayItem.runtime
    ? `${Math.floor(displayItem.runtime / 60)}h ${displayItem.runtime % 60}m`
    : displayItem.episode_run_time?.[0]
      ? `${displayItem.episode_run_time[0]}m/ep`
      : null;

  // Movie progress
  const [movieProgress, setMovieProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef(movieProgress);
  useEffect(() => { progressRef.current = movieProgress; }, [movieProgress]);

  useEffect(() => {
    if (!item || !isMovie || !displayItem.runtime) return;
    const movie_id = item.id;
    let cancelled = false;
    async function load() {
      try {
        const prog = await get_movie_progress(movie_id);
        if (!cancelled) setMovieProgress(prog.watched_minutes || 0);
      } catch {
        const saved = localStorage.getItem(`palace_movie_progress_${movie_id}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            setMovieProgress(typeof parsed === 'object' && 'watched' in parsed ? Number(parsed.watched) : Number(saved));
          } catch { setMovieProgress(Number(saved)); }
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [item?.id, isMovie, displayItem.runtime]);

  const updateProgressFromMouse = useCallback((clientX: number) => {
    if (!sliderRef.current || !displayItem.runtime) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    setMovieProgress(Math.round(pct * displayItem.runtime));
  }, [displayItem.runtime]);

  const handleSliderMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    updateProgressFromMouse(e.clientX);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => { if (isDragging) updateProgressFromMouse(e.clientX); };
    const onUp = () => {
      if (isDragging) {
        const runtime = displayItem.runtime || 0;
        localStorage.setItem(`palace_movie_progress_${displayItem.id}`, JSON.stringify({ watched: progressRef.current, runtime }));
        update_movie_progress(displayItem.id, progressRef.current, runtime)
          .then(() => window.dispatchEvent(new Event('palace-movie-progress')))
          .catch(() => {});
      }
      setIsDragging(false);
    };
    if (isDragging) { window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); }
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDragging, displayItem.id, displayItem.runtime, updateProgressFromMouse]);

  function formatTime(minutes: number) {
    const h = Math.floor(minutes / 60);
    const m = Math.floor(minutes % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  // Reviews
  useEffect(() => {
    if (reviewsOpen) setTimeout(() => reviewsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }, [reviewsOpen]);

  useEffect(() => {
    if (!reviewsOpen || reviewsLoaded) return;
    let cancelled = false;
    Promise.all([get_my_review(displayItem.id, media_type), get_title_reviews(displayItem.id, media_type)])
      .then(([my, all]) => {
        if (cancelled) return;
        setMyReview(my); if (my) { setReviewRating(my.rating); setReviewContent(my.content); }
        setAllReviews(all); setReviewsLoaded(true);
      }).catch(() => {});
    return () => { cancelled = true; };
  }, [reviewsOpen, reviewsLoaded, displayItem.id, media_type]);

  async function handleSaveReview() {
    if (!reviewRating && !reviewContent.trim()) return;
    setReviewSaving(true);
    try {
      const saved = await upsert_review({ tmdb_id: displayItem.id, media_type: media_type, title: displayItem.title, poster_url: displayItem.poster_url ?? undefined, rating: reviewRating, content: reviewContent });
      setMyReview(saved); toast.success('Review saved');
      get_title_reviews(displayItem.id, media_type).then(setAllReviews).catch(() => {});
    } catch { /* handled */ } finally { setReviewSaving(false); }
  }

  async function handleDeleteReview() {
    if (!myReview) return;
    try {
      await delete_review(myReview.id);
      setMyReview(null); setReviewRating(null); setReviewContent(''); toast.success('Review deleted');
      get_title_reviews(displayItem.id, media_type).then(setAllReviews).catch(() => {});
    } catch { /* handled */ }
  }

  const progressPct = isMovie && displayItem.runtime ? (movieProgress / displayItem.runtime) * 100 : 0;
  const addMenuData = { tmdb_id: displayItem.id, title: displayItem.title, poster_url: displayItem.poster_url, media_type: displayItem.media_type };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}>
      <div className="modal-in"
        style={{ width: 'min(920px, 96vw)', maxHeight: '90vh', borderRadius: '16px', overflow: 'hidden', background: 'linear-gradient(180deg, var(--t-primary-18) 0%, var(--t-primary-10) 100%)', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', position: 'relative' }}
        onClick={e => e.stopPropagation()}>

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--t-primary-18)', color: 'var(--t-primary)', fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '99px', letterSpacing: '0.5px' }}>
                {isMovie ? <Film style={{ width: '10px' }} /> : <Tv style={{ width: '10px' }} />}
                {isMovie ? 'MOVIE' : 'TV SHOW'}
              </span>
              {displayItem.rating > 0 && <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#fbbf24', fontSize: '12px', fontWeight: 700 }}><Star style={{ width: '12px' }} />{displayItem.rating.toFixed(1)}</span>}
              {year && <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{year}</span>}
              {runtimeDisplay && <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '12px' }}>{runtimeDisplay}</span>}
              {displayItem.status && <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{displayItem.status}</span>}
            </div>
            <div>
              <h2 style={{ margin: 0, color: '#fff', fontSize: '26px', fontWeight: 700, lineHeight: 1.15, overflowWrap: 'break-word' }}>{displayItem.title}</h2>
              {displayItem.tagline && <p style={{ margin: '4px 0 0', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontStyle: 'italic' }}>{displayItem.tagline}</p>}
            </div>
            {displayItem.overview && <p style={{ margin: 0, color: 'rgba(255,255,255,0.7)', fontSize: '12px', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' as any }}>{displayItem.overview}</p>}
            {displayItem.genres && displayItem.genres.length > 0 && (
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {displayItem.genres.slice(0, 5).map(g => <span key={g} style={{ background: 'var(--t-primary-18)', color: 'var(--t-primary)', fontSize: '11px', padding: '3px 9px', borderRadius: '99px', border: '1px solid var(--t-primary-25)' }}>{g}</span>)}
              </div>
            )}
            {/* Buttons */}
            <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginTop: '4px' }}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button ref={addButtonRef} onClick={() => setMenuOpen(!menuOpen)}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 13px', borderRadius: '8px', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.22)'; }}
                  onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}>
                  <Plus style={{ width: '12px' }} /> Add to List
                </button>
                {menuOpen && <AddToListMenu onClose={() => setMenuOpen(false)} triggerRef={addButtonRef} movieTitle={displayItem.title} movieData={addMenuData} placement="above" />}
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
              <button onClick={() => setReviewsOpen(r => !r)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 13px', borderRadius: '8px', background: reviewsOpen ? 'var(--t-primary-20)' : 'rgba(255,255,255,0.06)', border: reviewsOpen ? '1px solid var(--t-primary-40)' : '1px solid rgba(255,255,255,0.14)', color: '#fff', fontSize: '12px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', marginLeft: 'auto', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = reviewsOpen ? 'var(--t-primary-25)' : 'rgba(255,255,255,0.14)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = reviewsOpen ? 'var(--t-primary-20)' : 'rgba(255,255,255,0.06)'; }}>
                <MessageSquare style={{ width: '12px' }} /> Reviews
              </button>
            </div>
          </div>
        </div>

        {/* ── BODY: scrollable ── */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>

            {/* Movie progress */}
            {isMovie && displayItem.runtime && displayItem.runtime > 0 && (
              <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                    <Clock style={{ width: '10px' }} /> Your Progress
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#fff' }}>
                    {formatTime(movieProgress)} <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>/ {formatTime(displayItem.runtime)}</span>
                  </span>
                </div>
                <div ref={sliderRef} onMouseDown={handleSliderMouseDown}
                  style={{ position: 'relative', padding: '6px 0', cursor: isDragging ? 'ew-resize' : 'pointer', userSelect: 'none' }}>
                  <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(90deg, var(--t-primary), var(--t-glow))', borderRadius: '99px', boxShadow: '0 0 8px var(--t-primary-55)', transition: isDragging ? 'none' : 'width 0.2s' }} />
                  </div>
                  <div style={{ position: 'absolute', left: `${progressPct}%`, top: '50%', transform: 'translate(-50%, -50%)', width: '14px', height: '14px', borderRadius: '50%', background: 'var(--t-primary)', border: '2px solid #fff', boxShadow: '0 0 8px var(--t-primary-55)', pointerEvents: 'none', zIndex: 1, transition: isDragging ? 'none' : 'left 0.2s' }} />
                </div>
              </div>
            )}

            {/* Cast */}
            {displayItem.cast && displayItem.cast.length > 0 && (
              <div style={{ padding: '12px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
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

            {/* Inline reviews */}
            {reviewsOpen && (
              <div ref={reviewsSectionRef} style={{ borderTop: '1px solid rgba(255,255,255,0.1)', padding: '20px 24px', background: 'var(--t-primary-08)' }}>
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>Your Rating</div>
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
                    {[1,2,3,4,5].map(star => (
                      <button key={star} onClick={() => setReviewRating(star === reviewRating ? null : star)} onMouseEnter={() => setReviewStarHover(star)} onMouseLeave={() => setReviewStarHover(null)}
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
                    {myReview && <button onClick={handleDeleteReview} style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(220,60,60,0.12)', border: '1px solid rgba(220,60,60,0.25)', color: '#f56565', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>Delete</button>}
                  </div>
                </div>
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '12px' }}>
                    Palace Reviews {allReviews.length > 0 && <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>· {allReviews.length}</span>}
                  </div>
                  {allReviews.length === 0
                    ? <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '20px 0' }}>No reviews yet — be the first!</div>
                    : <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {allReviews.map(r => {
                          const name = r.author?.nickname || r.author?.username || 'User';
                          return (
                            <div key={r.id} style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                {r.author?.profile_picture
                                  ? <div className="avatar-circle" style={{ width: '28px', height: '28px' }}><img src={r.author.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /></div>
                                  : <div style={{ width: '28px', height: '28px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--t-primary-25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff' }}>{name.slice(0,2).toUpperCase()}</div>}
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
                      </div>}
                </div>
              </div>
            )}
        </div>
      </div>
    </div>,
    document.body
  );
}
