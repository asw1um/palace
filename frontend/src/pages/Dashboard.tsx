import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/data/ThemeContext';
import { Star, Tv, Plus, List as ListIcon } from 'lucide-react';
import AnimatedSearchBar from '@/components/AnimatedSearchBar';
import MediaDetailModal from '@/components/MediaDetailModal';
import ShowDetailModal from '@/components/ShowDetailModal';
import QuickAddButton from '@/components/QuickAddButton';
import Poster from '@/components/Poster';
import GlassBox from '@/components/GlassBox';
import { getPinnedLists, getListsWithMovies } from '@/api/lists';
import { getPinnedClubs, getMyClubsWithLists } from '@/api/clubs';
import { getActivity } from '@/api/activity';
import { getTrending, getMovieDetails } from '@/api/search';

import { getSettings } from '@/api/settings';
import { getAllProgress } from '@/api/progress';
import type { List, Club, Activity, TMDBResult } from '@/types/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [selectedItem, setSelectedItem] = useState<TMDBResult | null>(null);

  const handleItemClick = async (item: TMDBResult) => {
    if (item.media_type === 'tv') {
      setSelectedItem(item);
      return;
    }
    const details = await getMovieDetails(item.id);
    if (details) {
      setSelectedItem({ ...item, ...details });
    } else {
      setSelectedItem(item);
    }
  };

  const [lists, setLists] = useState<List[]>([]);
  const [, setClubs] = useState<Club[]>([]);
  const [myClubsWithLists, setMyClubsWithLists] = useState<Club[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [trending, setTrending] = useState<TMDBResult[]>([]);
  const [displayedListId, setDisplayedListId] = useState<number | null>(null);
  const [allLists, setAllLists] = useState<List[]>([]);
  const [progressTick, setProgressTick] = useState(0);
  const [allProgress, setAllProgress] = useState<{ shows: Record<number, Record<string, boolean>>; movies: Record<number, { watched_minutes: number; total_minutes: number }> }>({ shows: {}, movies: {} });
  const [, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [settingsRes, listsRes, clubsRes, activityRes, trendingRes, allListsRes, progressRes, myClubsRes] = await Promise.all([
          getSettings().catch(() => null),
          getPinnedLists().catch(() => []),
          getPinnedClubs().catch(() => []),
          getActivity(50).catch(() => []),
          getTrending().catch(() => []),
          getListsWithMovies().catch(() => []),
          getAllProgress().catch(() => ({ shows: {}, movies: {} })),
          getMyClubsWithLists().catch(() => []),
        ]);
        if (!cancelled) {
          setLists(listsRes);
          setClubs(clubsRes);
          setMyClubsWithLists(myClubsRes);
          setActivities(activityRes);
          setTrending(trendingRes);
          setDisplayedListId(settingsRes?.displayed_list ?? null);
          setAllLists(allListsRes);
          setAllProgress(progressRes);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Reload when settings change
  useEffect(() => {
    const handleSettingsChange = () => {
      window.location.reload();
    };
    window.addEventListener('settingschange', handleSettingsChange);
    return () => window.removeEventListener('settingschange', handleSettingsChange);
  }, []);

  // Poll activity feed every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      getActivity(50).then(data => setActivities(data)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Listen for show/movie progress updates from modals and force re-render
  useEffect(() => {
    const handler = () => {
      setProgressTick(t => t + 1);
    };
    window.addEventListener('palace-show-progress', handler);
    window.addEventListener('palace-movie-progress', handler);
    return () => {
      window.removeEventListener('palace-show-progress', handler);
      window.removeEventListener('palace-movie-progress', handler);
    };
  }, []);

  // Re-fetch lists and progress when modal closes or progress changes
  useEffect(() => {
    if (progressTick === 0) return;
    let cancelled = false;
    async function refresh() {
      try {
        const [settingsRes, listsRes, allListsRes, progressRes] = await Promise.all([
          getSettings().catch(() => null),
          getPinnedLists().catch(() => []),
          getListsWithMovies().catch(() => []),
          getAllProgress().catch(() => ({ shows: {}, movies: {} })),
        ]);
        if (!cancelled) {
          setLists(listsRes);
          setDisplayedListId(settingsRes?.displayed_list ?? null);
          setAllLists(allListsRes);
          setAllProgress(progressRes);
        }
      } catch { /* ignore */ }
    }
    refresh();
    return () => { cancelled = true; };
  }, [progressTick]);

  // Re-fetch lists when items are added/removed from lists
  useEffect(() => {
    const handler = () => {
      let cancelled = false;
      async function refresh() {
        try {
          const [settingsRes, listsRes, allListsRes] = await Promise.all([
            getSettings().catch(() => null),
            getPinnedLists().catch(() => []),
            getListsWithMovies().catch(() => []),
          ]);
          if (!cancelled) {
            setLists(listsRes);
            setDisplayedListId(settingsRes?.displayed_list ?? null);
            setAllLists(allListsRes);
          }
        } catch { /* ignore */ }
      }
      refresh();
    };
    window.addEventListener('palace-lists-changed', handler);
    return () => window.removeEventListener('palace-lists-changed', handler);
  }, []);

  const glow = 'var(--t-glow)';
  const primary = 'var(--t-primary)';

  return (
    <div style={{ height: '100%', overflow: 'hidden', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

      <div style={{ flexShrink: 0 }}>
        <AnimatedSearchBar />
      </div>

      {/* ── DISPLAYED LIST / CURRENTLY WATCHING ── */}
      {(() => {
        const allClubLists = myClubsWithLists.flatMap(c => c.lists || []);
        const displayedList = displayedListId
          ? (allLists.find(l => l.id === displayedListId) ?? allClubLists.find(l => l.id === displayedListId))
          : null;
        const displayedItems: TMDBResult[] = displayedList
          ? [
              ...(displayedList.movies || []).map((m) => ({
                id: m.tmdb_id || m.id,
                media_type: 'movie' as const,
                title: m.title,
                overview: '',
                poster_url: m.poster_url,
                backdrop_url: null,
                release_date: '',
                rating: 0,
                popularity: 0,
                genre_ids: [],
              })),
              ...(displayedList.shows || []).map((s) => ({
                id: s.tmdb_id || s.id,
                media_type: 'tv' as const,
                title: s.title,
                overview: '',
                poster_url: s.poster_url,
                backdrop_url: null,
                release_date: '',
                rating: 0,
                popularity: 0,
                genre_ids: [],
                number_of_seasons: s.total_seasons,
                number_of_episodes: s.seasons.reduce((a, se) => a + se.episode_count, 0),
                seasons: s.seasons,
              })),
            ]
          : [];

        if (displayedList) {
          if (displayedItems.length > 0) {
            return (
              <GlassBox title={displayedList.name} style={{ maxHeight: '450px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px', alignItems: 'start' }}>
                  {displayedItems.map((item) => {
                    function getMovieProgress(movieId: number) {
                      const backend = allProgress.movies[movieId];
                      if (backend) {
                        const watched = backend.watched_minutes || 0;
                        const runtime = backend.total_minutes || 1;
                        return { watched, runtime, pct: runtime > 0 ? Math.round((watched / runtime) * 100) : 0 };
                      }
                      const raw = localStorage.getItem(`palace_movie_progress_${movieId}`);
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

                    const isShow = item.media_type === 'tv';
                    const showData = isShow ? displayedList?.shows?.find(s => (s.tmdb_id || s.id) === item.id) : null;
                    const movieData = !isShow ? displayedList?.movies?.find(m => (m.tmdb_id || m.id) === item.id) : null;

                    function getShowProgress(showId: number, seasons: { season_number: number; episode_count: number }[]) {
                      const map = allProgress.shows[showId] || {};
                      const watched = Object.values(map).filter(Boolean).length;
                      const total = seasons.reduce((a, s) => a + (s.episode_count || 0), 0);
                      const pct = total > 0 ? Math.round((watched / total) * 100) : 0;
                      return { watched, total, pct };
                    }

                    let progress: { pct: number; label: string };
                    if (isShow && showData) {
                      const progressId = showData.tmdb_id ?? item.id;
                      const sp = getShowProgress(progressId, showData.seasons || []);
                      progress = { pct: sp.pct, label: `${sp.watched}/${sp.total}` };
                    } else if (!isShow) {
                      const mp = getMovieProgress(item.id) || (movieData ? getMovieProgress(movieData.id) : null);
                      const watched = mp?.watched || 0;
                      const label = watched > 0
                        ? `${Math.floor(watched / 60) > 0 ? `${Math.floor(watched / 60)}h ` : ''}${Math.floor(watched % 60)}m`
                        : '0m';
                      progress = { pct: mp?.pct || 0, label };
                    } else {
                      progress = { pct: 0, label: '' };
                    }

                    return (
                      <div key={`${item.id}-${progressTick}`} style={{ cursor: 'pointer', transition: 'transform 0.15s', minHeight: 0 }} onClick={() => handleItemClick(item)} onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')} onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
                        <div className="poster-wrap" style={{ position: 'relative', width: '100%' }}>
                          <Poster posterUrl={item.poster_url} progress={progress.pct} style={{ borderRadius: '10px' }} />
                          <QuickAddButton item={item} />
                        </div>
                        <div style={{ marginTop: '10px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}>{item.title}</div>
                          <div style={{ marginTop: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: '4px' }}>
                              <span>{progress.label}</span>
                              <span style={{ color: 'var(--t-primary)' }}>{progress.pct}%</span>
                            </div>
                            <div style={{ height: '6px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden', boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.4)' }}>
                              <div style={{ width: `${Math.max(3, progress.pct)}%`, height: '100%', background: 'var(--t-primary)', borderRadius: '3px', boxShadow: '0 0 10px var(--t-primary-55)' }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassBox>
            );
          }

          // Displayed list is set but empty
          return (
            <GlassBox title={displayedList.name} style={{ maxHeight: '450px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', gap: '12px' }}>
                <ListIcon style={{ width: '32px', opacity: 0.3 }} />
                <div style={{ fontSize: '14px', fontWeight: 600 }}>This list is empty</div>
                <div style={{ fontSize: '12px' }}>Add movies and shows to see them here</div>
                <button
                  onClick={() => navigate('/discover')}
                  style={{ marginTop: '8px', padding: '8px 18px', borderRadius: '6px', background: `linear-gradient(180deg, ${primary}99, ${primary}55)`, border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus style={{ width: '12px' }} /> Browse
                </button>
              </div>
            </GlassBox>
          );
        }

        // No displayed list set — prompt user to choose one
        return (
          <GlassBox title="Choose a List" style={{ maxHeight: '450px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', gap: '12px' }}>
              <ListIcon style={{ width: '32px', opacity: 0.3 }} />
              <div style={{ fontSize: '14px', fontWeight: 600 }}>No list selected</div>
              <div style={{ fontSize: '12px' }}>Go to settings to choose a list to display on your dashboard</div>
              <button
                onClick={() => navigate('/settings')}
                style={{ marginTop: '8px', padding: '8px 18px', borderRadius: '6px', background: `linear-gradient(180deg, ${primary}99, ${primary}55)`, border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus style={{ width: '12px' }} /> Open Settings
              </button>
            </div>
          </GlassBox>
        );
      })()}

      {/* ── ROW 2: My Lists + Club Lists ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        {/* My Lists */}
        <GlassBox title="My Lists">
          {lists.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {lists.map((list) => (
                <div key={list.id} onClick={() => navigate('/lists')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.04)', transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: primary, boxShadow: `0 0 5px ${glow}55`, flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{list.name}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, background: 'rgba(0,0,0,0.15)', padding: '2px 8px', borderRadius: '6px' }}>{(list.movie_count || 0) + (list.show_count || 0)} titles</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', color: 'rgba(255,255,255,0.4)', gap: '8px' }}>
              <div style={{ fontSize: '13px' }}>No pinned lists</div>
              <button onClick={() => navigate('/lists')} style={{ padding: '6px 14px', borderRadius: '6px', background: `linear-gradient(180deg, ${primary}99, ${primary}55)`, border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Plus style={{ width: '11px', display: 'inline', marginRight: '4px' }} />Pin a List
              </button>
            </div>
          )}
        </GlassBox>

        {/* Club Lists */}
        <GlassBox title="Club Lists">
          {myClubsWithLists.length > 0 && myClubsWithLists.some(c => (c.lists || []).length > 0) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
              {myClubsWithLists.filter(c => (c.lists || []).length > 0).map(club => (
                <div key={club.id}>
                  <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px', paddingLeft: '2px' }}>{club.name}</div>
                  {(club.lists || []).map(list => (
                    <div key={list.id} onClick={() => navigate(`/lists/${list.id}`)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.04)', marginBottom: '3px', transition: 'all 0.15s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: primary, boxShadow: `0 0 5px ${primary}55`, flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>{list.name}</span>
                      </div>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', background: 'rgba(0,0,0,0.15)', padding: '1px 7px', borderRadius: '6px' }}>{(list.movie_count || 0) + (list.show_count || 0)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', color: 'rgba(255,255,255,0.4)', gap: '8px' }}>
              <div style={{ fontSize: '13px' }}>No club lists yet</div>
              <button onClick={() => navigate('/clubs')} style={{ padding: '6px 14px', borderRadius: '6px', background: `linear-gradient(180deg, ${primary}99, ${primary}55)`, border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Plus style={{ width: '11px', display: 'inline', marginRight: '4px' }} />Browse Clubs
              </button>
            </div>
          )}
        </GlassBox>
      </div>

      {/* ── ROW 3: Activity + Trending ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', flex: 1, minHeight: 0 }}>
        {/* Recent Activity */}
        <GlassBox title="Recent Activity" style={{ flex: 1, minHeight: 0 }}>
          {activities.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {activities.map((act) => (
                <div key={act.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', transition: 'background 0.1s', flexShrink: 0, cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                >
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: `linear-gradient(135deg, ${theme.primary}66, ${theme.primary}22)`, border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
                    {(act.actor?.nickname ?? 'U').slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)' }}>{act.description}</div>
                  </div>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{act.time_ago}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', gap: '8px' }}>
              <div style={{ fontSize: '13px' }}>No recent activity</div>
              <div style={{ fontSize: '12px' }}>Activity will appear here as you interact with movies and shows</div>
            </div>
          )}
        </GlassBox>

        {/* Trending */}
        <GlassBox title="Trending" style={{ flex: 1, minHeight: 0 }}>
          {trending.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', alignItems: 'start' }}>
              {trending.map((item) => (
                <div key={item.id} style={{ cursor: 'pointer', transition: 'transform 0.15s', minWidth: 0 }} onClick={() => handleItemClick(item)} onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')} onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
                  <div className="poster-wrap" style={{ position: 'relative', width: '100%' }}>
                    <Poster posterUrl={item.poster_url} style={{ borderRadius: '10px' }} />
                    <div style={{ position: 'absolute', bottom: '6px', right: '6px', background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, color: '#ffd700', display: 'flex', alignItems: 'center', gap: '3px', border: '1px solid rgba(255,255,255,0.1)', zIndex: 2 }}>
                      <Star style={{ width: '10px' }} /> {item.rating?.toFixed(1) || '—'}
                    </div>
                    <QuickAddButton item={item} />
                  </div>
                  <div style={{ marginTop: '8px', height: '20px', display: 'flex', alignItems: 'center', gap: '5px', overflow: 'hidden' }}>
                    {item.media_type === 'tv' ? <Tv style={{ width: '12px', color: primary, flexShrink: 0 }} /> : <Star style={{ width: '12px', color: 'rgba(255,255,255,0.45)', flexShrink: 0 }} />}
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{item.title}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', gap: '8px' }}>
              <div style={{ fontSize: '13px' }}>No trending data</div>
              <div style={{ fontSize: '12px' }}>Check back later for trending movies and shows</div>
            </div>
          )}
        </GlassBox>
      </div>
      {selectedItem && selectedItem.media_type === 'tv' ? (
        <ShowDetailModal item={selectedItem} onClose={() => { setSelectedItem(null); setProgressTick(t => t + 1); }} />
      ) : selectedItem ? (
        <MediaDetailModal item={selectedItem} onClose={() => { setSelectedItem(null); setProgressTick(t => t + 1); }} />
      ) : null}
    </div>
  );
}
