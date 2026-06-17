import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Trash2, Search, LayoutGrid, List as ListIcon, Star, Clock, Tv } from 'lucide-react';
import { useConfirm } from '@/components/ConfirmDialog';
import { get_list, remove_movie_from_list } from '@/api/lists';
import { get_movie_details } from '@/api/search';
import MediaDetailModal from '@/components/MediaDetailModal';
import ShowDetailModal from '@/components/ShowDetailModal';
import Poster from '@/components/Poster';
import type { List as ListType, TMDBResult, Movie, Show } from '@/types/api';
import { useIsMobile } from '@/hooks/use-mobile';

function get_movie_progress(movie_id: number) {
  const raw = localStorage.getItem(`palace_movie_progress_${movie_id}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && 'watched' in parsed) {
      const watched = Number(parsed.watched) || 0;
      const runtime = Number(parsed.runtime) || 1;
      return { watched, runtime, pct: runtime > 0 ? Math.round((watched / runtime) * 100) : 0 };
    }
  } catch {
    const num = Number(raw);
    if (!isNaN(num) && num > 0) return { watched: num, runtime: 0, pct: 0 };
  }
  return null;
}

function movieToResult(movie: Movie): TMDBResult {
  return {
    id: movie.tmdb_id || movie.id,
    media_type: 'movie',
    title: movie.title,
    poster_url: movie.poster_url,
    overview: '',
    release_date: '',
    backdrop_url: null,
    rating: 0,
    popularity: 0,
    genre_ids: [],
  };
}

function showToResult(show: Show): TMDBResult {
  return {
    id: show.tmdb_id || show.id,
    media_type: 'tv',
    title: show.title,
    poster_url: show.poster_url,
    overview: '',
    release_date: '',
    backdrop_url: null,
    rating: 0,
    popularity: 0,
    genre_ids: [],
    number_of_seasons: show.total_seasons,
    number_of_episodes: show.seasons?.reduce((a, se) => a + (se.episode_count || 0), 0) || 0,
    seasons: show.seasons,
  };
}

function ProgressBar({ movie_id, tick: _tick }: { movie_id: number; tick?: number }) {
  const progress = get_movie_progress(movie_id);
  if (!progress) return null;
  const progressLabel = `${Math.floor(progress.watched / 60) > 0 ? `${Math.floor(progress.watched / 60)}h ` : ''}${Math.floor(progress.watched % 60)}m`;
  return (
    <div style={{ marginTop: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: '3px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Clock style={{ width: '10px' }} /> {progressLabel}</span>
        <span style={{ color: 'var(--t-primary)' }}>{progress.pct}%</span>
      </div>
      <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden', boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.4)' }}>
        <div style={{ width: `${Math.max(3, progress.pct)}%`, height: '100%', background: 'var(--t-primary)', borderRadius: '3px', boxShadow: '0 0 10px var(--t-primary-55)' }} />
      </div>
    </div>
  );
}

function CompactProgress({ movie_id, tick: _tick }: { movie_id: number; tick?: number }) {
  const progress = get_movie_progress(movie_id);
  if (!progress) return <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>Movie</span>;
  const progressLabel = `${Math.floor(progress.watched / 60) > 0 ? `${Math.floor(progress.watched / 60)}h ` : ''}${Math.floor(progress.watched % 60)}m`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>{progressLabel}</span>
      <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.max(3, progress.pct)}%`, height: '100%', background: 'var(--t-primary)', borderRadius: '2px' }} />
      </div>
      <span style={{ fontSize: '11px', color: 'var(--t-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>{progress.pct}%</span>
    </div>
  );
}

export default function ListDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const fromClub = (location.state as { fromClub?: number } | null)?.fromClub;
  const fromUser = (location.state as { fromUser?: number } | null)?.fromUser;
  const list_id = parseInt(id || '0');
  const [list, setList] = useState<ListType | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [query, setQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<TMDBResult | null>(null);
  const [progressTick, setProgressTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await get_list(list_id);
        if (!cancelled) setList(data);
      } catch {
        if (!cancelled) setList(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (list_id) load();
    return () => { cancelled = true; };
  }, [list_id]);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Loading...</div>;
  if (!list) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>List not found</div>;

  const backPath = fromClub ? `/clubs/${fromClub}` : fromUser ? `/profile/${fromUser}` : '/lists';
  const backLabel = fromClub ? 'Club' : fromUser ? 'User Profile' : 'My Lists';

  const movies = list.movies || [];
  const shows = list.shows || [];
  const allItems = [...movies, ...shows];
  const filtered = query.length > 0
    ? allItems.filter(m => m.title.toLowerCase().includes(query.toLowerCase()))
    : allItems;

  const handleItemClick = async (item: TMDBResult) => {
    if (item.media_type === 'tv') {
      setSelectedItem(item);
      return;
    }
    const details = await get_movie_details(item.id);
    if (details) {
      setSelectedItem({ ...item, ...details });
    } else {
      setSelectedItem(item);
    }
  };

  const handleDelete = async (movie_id: number) => {
    const movie = movies.find(m => m.id === movie_id);
    if (!movie) return;
    const ok = await confirm({
      title: 'Remove Movie',
      message: `Are you sure you want to remove "${movie.title}" from this list?`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      danger: true,
    });
    if (ok) {
      try {
        await remove_movie_from_list(list_id, movie_id);
        setList(prev => prev ? { ...prev, movies: prev.movies?.filter(m => m.id !== movie_id) || [] } : null);
      } catch {
        // error handled by interceptor
      }
    }
  };

  const handleDeleteShow = async (show_id: number) => {
    const show = shows.find(s => s.id === show_id);
    if (!show) return;
    const ok = await confirm({
      title: 'Remove Show',
      message: `Are you sure you want to remove "${show.title}" from this list?`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      danger: true,
    });
    if (ok) {
      try {
        await remove_movie_from_list(list_id, show_id);
        setList(prev => prev ? { ...prev, shows: prev.shows?.filter(s => s.id !== show_id) || [] } : null);
      } catch {
        // error handled by interceptor
      }
    }
  };

  return (
    <div style={{ height: isMobile ? 'auto' : '100%', overflowY: isMobile ? 'initial' : 'auto', paddingRight: isMobile ? '0px' : '8px', boxSizing: 'border-box', width: '100%' }}>
      <button style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }} onClick={() => navigate(backPath)} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}>
        <ArrowLeft style={{ width: '14px' }} /> {backLabel}
      </button>

      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.08) 100%)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '10px', padding: '20px', marginBottom: '16px', boxShadow: '0 6px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 100%)', borderRadius: '10px 10px 0 0', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>{list.name}</h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '6px' }}>{allItems.length} titles</p>
        </div>
      </div>

      {/* Controls bar: search + view toggle */}
      {isMobile ? (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', width: '100%' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', padding: '0 14px', height: '40px' }}>
            <Search style={{ width: '14px', color: 'rgba(255,255,255,0.7)', flexShrink: 0 }} />
            <input style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '13px', width: '100%' }} placeholder="Search..." value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', overflow: 'hidden', height: '40px', flexShrink: 0 }}>
            <button onClick={() => setViewMode('grid')} style={{ padding: '0 12px', background: viewMode === 'grid' ? 'var(--t-primary-25)' : 'transparent', border: 'none', cursor: 'pointer' }}><LayoutGrid style={{ width: '15px', color: viewMode === 'grid' ? 'var(--t-primary)' : 'rgba(255,255,255,0.4)' }} /></button>
            <button onClick={() => setViewMode('list')} style={{ padding: '0 12px', background: viewMode === 'list' ? 'var(--t-primary-25)' : 'transparent', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}><ListIcon style={{ width: '15px', color: viewMode === 'list' ? 'var(--t-primary)' : 'rgba(255,255,255,0.4)' }} /></button>
          </div>
        </div>
      ) : (
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '10px', padding: '8px 14px', backdropFilter: 'blur(8px)' }}>
          <Search style={{ width: '14px', color: 'rgba(255,255,255,0.7)', flexShrink: 0 }} />
          <input style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '13px', fontFamily: 'inherit', width: '100%' }} placeholder="Search in this list..." value={query} onChange={e => setQuery(e.target.value)} />
        </div>

        <div style={{ display: 'flex', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', overflow: 'hidden' }}>
          <button onClick={() => setViewMode('grid')} style={{ padding: '8px 12px', background: viewMode === 'grid' ? 'var(--t-primary-25)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}>
            <LayoutGrid style={{ width: '15px', color: viewMode === 'grid' ? 'var(--t-primary)' : 'rgba(255,255,255,0.4)' }} />
          </button>
          <button onClick={() => setViewMode('list')} style={{ padding: '8px 12px', background: viewMode === 'list' ? 'var(--t-primary-25)' : 'transparent', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}>
            <ListIcon style={{ width: '15px', color: viewMode === 'list' ? 'var(--t-primary)' : 'rgba(255,255,255,0.4)' }} />
          </button>
        </div>
      </div>
        )}
        {/* Grid View */}
        {viewMode === 'grid' && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(130px, 1fr))' : 'repeat(auto-fill, 145px)', 
            gap: '16px 12px', 
            justifyContent: isMobile ? 'stretch' : 'start',
            alignItems: 'start',
            width: '100%'
          }}>
          {filtered.map((item) => {
            const isShowItem = 'total_seasons' in item;
            const result = isShowItem ? showToResult(item as Show) : movieToResult(item as Movie);
            return (
            <div key={item.id} style={{ cursor: 'pointer', transition: 'transform 0.15s', minHeight: 0, minWidth: 0 }} onClick={() => handleItemClick(result)} onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')} onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
              {/* Poster */}
              <div className="poster-wrap" style={{ position: 'relative', width: '100%' }}>
                <Poster poster_url={item.poster_url} style={{ borderRadius: '10px' }} />
              </div>

              {/* Title */}
              <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {isShowItem ? <Tv style={{ width: '12px', color: 'var(--t-primary)', flexShrink: 0 }} /> : <Star style={{ width: '12px', color: 'rgba(255,255,255,0.45)' }} />}
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{item.title}</span>
              </div>
              {/* Progress */}
              {!isShowItem && <ProgressBar movie_id={(item as Movie).tmdb_id || item.id} tick={progressTick} />}
              {/* Delete */}
              <button
                onClick={(e) => { e.stopPropagation(); isShowItem ? handleDeleteShow(item.id) : handleDelete(item.id); }}
                style={{
                  marginTop: '4px',
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.35)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ff5555'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}
              >
                <Trash2 style={{ width: '10px' }} /> Remove
              </button>
            </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filtered.map((item, i) => {
            const isShowItem = 'total_seasons' in item;
            const result = isShowItem ? showToResult(item as Show) : movieToResult(item as Movie);
            return (
            <div key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.15s',
                cursor: 'pointer',
              }}
              onClick={() => handleItemClick(result)}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, minWidth: '28px', textAlign: 'center' }}>{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isShowItem ? <Tv style={{ width: '12px', color: 'var(--t-primary)', flexShrink: 0 }} /> : <Star style={{ width: '12px', color: 'rgba(255,255,255,0.45)', flexShrink: 0 }} />}
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 500, flexShrink: 0 }}>
                    {isShowItem ? `TV · ${(item as Show).total_seasons ?? '?'} season${(item as Show).total_seasons !== 1 ? 's' : ''}` : 'Movie'}
                  </span>
                  {!isShowItem && <CompactProgress movie_id={(item as Movie).tmdb_id || item.id} tick={progressTick} />}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); isShowItem ? handleDeleteShow(item.id) : handleDelete(item.id); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '6px', borderRadius: '6px', display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#ff5555'; e.currentTarget.style.background = 'rgba(220,50,50,0.15)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; e.currentTarget.style.background = 'none'; }}>
                <Trash2 style={{ width: '14px' }} />
              </button>
            </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && query.length > 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>No results for &ldquo;{query}&rdquo;</div>
      )}

      {allItems.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
          This list is empty. Go to Discover to add movies and shows.
        </div>
      )}

      {selectedItem && selectedItem.media_type === 'tv' ? (
        <ShowDetailModal item={selectedItem} onClose={() => { setSelectedItem(null); setProgressTick(t => t + 1); }} />
      ) : selectedItem ? (
        <MediaDetailModal item={selectedItem} onClose={() => { setSelectedItem(null); setProgressTick(t => t + 1); }} />
      ) : null}
    </div>
  );
}
