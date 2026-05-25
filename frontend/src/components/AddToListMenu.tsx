import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { get_lists_with_movies, add_movie_to_list, remove_movie_from_list } from '@/api/lists';
import { getMyClubsWithLists } from '@/api/clubs';
import { toast } from 'sonner';
import type { List as ListType, Club, Movie } from '@/types/api';
import { ChevronUp, ChevronRight, List as ListIcon, Users, Check } from 'lucide-react';

interface Props {
  onClose: () => void;
  triggerRef?: React.RefObject<HTMLElement | null>;
  movieTitle?: string;
  movieData?: { tmdb_id: number; title: string; poster_url?: string | null; media_type?: string } | null;
  placement?: 'above' | 'below';
}

function find_item_in_list(list: ListType, tmdb_id?: number, title?: string): { id: number } | undefined {
  if (tmdb_id !== undefined) {
    return list.movies?.find((m: Movie) => m.tmdb_id === tmdb_id || m.id === tmdb_id)
      ?? (list.shows as Array<{ id: number; tmdb_id?: number; title: string }> | undefined)?.find(s => s.tmdb_id === tmdb_id || s.id === tmdb_id);
  }
  if (!title) return undefined;
  const inMovies = list.movies?.find((m: Movie) => m.title === title);
  if (inMovies) return inMovies;
  return (list.shows as Array<{ id: number; title: string }> | undefined)?.find(s => s.title === title);
}

export default function AddToListMenu({ onClose, triggerRef, movieTitle, movieData, placement = 'above' }: Props) {
  const [openCategory, setOpenCategory] = useState<'my' | 'club' | null>(null);
  const [openClub, setOpenClub] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ name: string; action: 'added' | 'removed' } | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top?: number; bottom?: number }>({ left: 0 });
  const [myLists, setMyLists] = useState<ListType[]>([]);
  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const [listsData, clubsData] = await Promise.all([
          get_lists_with_movies().catch(() => []),
          getMyClubsWithLists().catch(() => []),
        ]);
        setMyLists(listsData.filter((l: ListType) => !l.club_id));
        setAllClubs(clubsData);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    // Calculate position after a tick to ensure the trigger is rendered
    const timer = setTimeout(() => {
      if (triggerRef?.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const MENU_W = 218;
        const MARGIN = 8;
        const clampedLeft = Math.min(rect.left, window.innerWidth - MENU_W - MARGIN);
        if (placement === 'below') {
          setMenuPos({ left: clampedLeft, top: rect.bottom + 8 });
        } else {
          setMenuPos({ left: clampedLeft, bottom: window.innerHeight - rect.top + 8 });
        }
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [triggerRef, placement]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [onClose]);

  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 1500);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  const handleToggle = async (list: ListType) => {
    if (!movieData) {
      toast.info('Open the detail page to add this item to a list.');
      return;
    }
    const existing = find_item_in_list(list, movieData.tmdb_id, movieData.title);
    try {
      if (existing) {
        await remove_movie_from_list(list.id, existing.id);
        setFeedback({ name: list.name, action: 'removed' });
        toast.success(`Removed from "${list.name}"`);
      } else {
        await add_movie_to_list(list.id, {
          tmdb_id: movieData.tmdb_id,
          title: movieData.title,
          poster_url: movieData.poster_url || null,
          media_type: movieData.media_type || 'movie',
        });
        setFeedback({ name: list.name, action: 'added' });
        toast.success(`Added to "${list.name}"`);
      }
      // Refresh lists so checkmarks update
      const [refreshed, refreshedClubs] = await Promise.all([
        get_lists_with_movies().catch(() => []),
        getMyClubsWithLists().catch(() => []),
      ]);
      setMyLists(refreshed.filter((l: ListType) => !l.club_id));
      setAllClubs(refreshedClubs);
      window.dispatchEvent(new Event('palace-lists-changed'));
    } catch {
      // error handled by client interceptor
    }
  };

  const FROST = 'blur(20px)';
  const PANEL_BG = 'rgba(255,255,255,0.1)';
  const PANEL_BORDER = '1px solid rgba(255,255,255,0.2)';
  const PANEL_SHADOW = '0 8px 32px rgba(0,0,0,0.3)';
  const BTN_BG = 'rgba(255,255,255,0)';
  const BTN_HOVER = 'rgba(255,255,255,0.15)';
  const BTN_ACTIVE = 'var(--t-primary-35)';
  const BTN_IN_LIST = 'rgba(80,200,120,0.18)';
  const BTN_IN_LIST_HOVER = 'rgba(80,200,120,0.35)';

  const getListStyle = (list: ListType) => {
    const inList = !!find_item_in_list(list, movieData?.tmdb_id, movieTitle);
    if (feedback?.name === list.name && feedback.action === 'added') {
      return { bg: 'rgba(80,200,120,0.4)', hover: 'rgba(80,200,120,0.4)', color: '#fff', inList: true };
    }
    if (feedback?.name === list.name && feedback.action === 'removed') {
      return { bg: 'rgba(220,80,80,0.35)', hover: 'rgba(220,80,80,0.35)', color: '#fff', inList: false };
    }
    if (inList) {
      return { bg: BTN_IN_LIST, hover: BTN_IN_LIST_HOVER, color: 'rgba(130,220,160,0.9)', inList: true };
    }
    return { bg: BTN_BG, hover: BTN_HOVER, color: 'rgba(255,255,255,0.9)', inList: false };
  };

  const panelStyle: React.CSSProperties = {
    width: '210px',
    borderRadius: '12px',
    overflow: 'hidden',
    border: PANEL_BORDER,
    background: PANEL_BG,
    backdropFilter: FROST,
    WebkitBackdropFilter: FROST,
    boxShadow: PANEL_SHADOW,
    position: 'fixed',
    zIndex: 99999,
    ...(menuPos.top !== undefined ? { top: menuPos.top } : {}),
    ...(menuPos.bottom !== undefined ? { bottom: menuPos.bottom } : {}),
    left: menuPos.left,
  };

  const categoryBtnStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '12px 14px',
    background: isActive ? BTN_ACTIVE : BTN_BG,
    backdropFilter: FROST,
    WebkitBackdropFilter: FROST,
    border: 'none',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 700,
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'all 0.1s',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    position: 'relative' as const,
    zIndex: 1,
  });

  const listBtnStyle = (bg: string, color: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    textAlign: 'left',
    padding: '8px 10px',
    borderRadius: '6px',
    background: bg,
    backdropFilter: FROST,
    WebkitBackdropFilter: FROST,
    border: 'none',
    color: color,
    fontSize: '13px',
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'all 0.1s',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: '4px',
  });

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>, isActive: boolean) => {
    if (!isActive) e.currentTarget.style.background = BTN_HOVER;
  }, []);

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLButtonElement>, isActive: boolean) => {
    if (!isActive) e.currentTarget.style.background = BTN_BG;
  }, []);

  const menuContent = (
    <div ref={menuRef} onClick={e => e.stopPropagation()}>
      {/* PANEL 1 — Main */}
      <div
        className="modal-in"
        style={{
          ...panelStyle,
          ...(placement === 'below'
            ? {}
            : { bottom: (panelStyle.bottom as number) || 0 }
          ),
        }}
      >
        {/* Top highlight */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '50%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 100%)',
          borderRadius: '12px 12px 0 0', pointerEvents: 'none', zIndex: 0,
        }} />

        <button
          style={categoryBtnStyle(openCategory === 'my')}
          onClick={() => { setOpenCategory(openCategory === 'my' ? null : 'my'); setOpenClub(null); }}
          onMouseEnter={e => handleMouseEnter(e, openCategory === 'my')}
          onMouseLeave={e => handleMouseLeave(e, openCategory === 'my')}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ListIcon style={{ width: '14px', color: 'var(--t-primary)' }} />My Lists
          </span>
          <ChevronUp style={{ width: '14px', color: 'rgba(255,255,255,0.5)', transform: openCategory === 'my' ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>

        <button
          style={categoryBtnStyle(openCategory === 'club')}
          onClick={() => { setOpenCategory(openCategory === 'club' ? null : 'club'); setOpenClub(null); }}
          onMouseEnter={e => handleMouseEnter(e, openCategory === 'club')}
          onMouseLeave={e => handleMouseLeave(e, openCategory === 'club')}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users style={{ width: '14px', color: 'var(--t-primary)' }} />Club Lists
          </span>
          <ChevronUp style={{ width: '14px', color: 'rgba(255,255,255,0.5)', transform: openCategory === 'club' ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
        </button>
      </div>

      {/* PANEL 2 — My Lists flyout */}
      {openCategory === 'my' && (
        <div style={{
          ...panelStyle,
          ...(placement === 'below'
            ? { top: ((panelStyle.top as number) || 0) + 88 }
            : { bottom: ((panelStyle.bottom as number) || 0) + 88 }
          ),
          maxHeight: '260px',
        }}>
          <div style={{ overflowY: 'auto', padding: '10px' }}>
            {loading && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', padding: '8px' }}>Loading...</div>}
            {!loading && myLists.length === 0 && (
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', padding: '4px 8px' }}>No lists yet</div>
            )}
            {myLists.map(list => {
              const s = getListStyle(list);
              return (
                <button
                  key={list.id}
                  style={listBtnStyle(s.bg, s.color)}
                  onClick={() => handleToggle(list)}
                  onMouseEnter={e => { e.currentTarget.style.background = s.hover; }}
                  onMouseLeave={e => { e.currentTarget.style.background = s.bg; }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    {s.inList && <Check style={{ width: '12px', height: '12px', color: feedback?.name === list.name && feedback.action === 'added' ? '#fff' : '#82dca0', flexShrink: 0 }} />}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{list.name}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* PANEL 2 — Club Lists flyout */}
      {openCategory === 'club' && (
        <div style={{
          ...panelStyle,
          ...(placement === 'below'
            ? { top: ((panelStyle.top as number) || 0) + 88 }
            : { bottom: ((panelStyle.bottom as number) || 0) + 88 }
          ),
          maxHeight: '280px',
        }}>
          <div style={{ overflowY: 'auto', padding: '10px' }}>
            {loading && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', padding: '8px' }}>Loading...</div>}
            {!loading && allClubs.length === 0 && (
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', padding: '4px 8px' }}>No clubs yet</div>
            )}
            {allClubs.map(club => {
              const isClubOpen = openClub === club.id;
              return (
                <div key={club.id} style={{ marginBottom: '4px' }}>
                  <button
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', textAlign: 'left', padding: '8px 10px',
                      borderRadius: '6px', background: isClubOpen ? BTN_ACTIVE : BTN_BG,
                      backdropFilter: FROST, WebkitBackdropFilter: FROST,
                      border: 'none', color: 'rgba(255,255,255,0.9)',
                      fontSize: '13px', fontFamily: 'inherit', cursor: 'pointer',
                      transition: 'all 0.1s',
                    }}
                    onClick={() => setOpenClub(isClubOpen ? null : club.id)}
                    onMouseEnter={e => { if (!isClubOpen) e.currentTarget.style.background = BTN_HOVER; }}
                    onMouseLeave={e => { if (!isClubOpen) e.currentTarget.style.background = BTN_BG; }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{club.name}</span>
                    <ChevronRight style={{ width: '12px', flexShrink: 0, transform: isClubOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', color: 'rgba(255,255,255,0.5)' }} />
                  </button>
                  {isClubOpen && (
                    <div style={{ paddingLeft: '12px', borderLeft: '2px solid var(--t-primary-30)', marginLeft: '10px', marginTop: '4px' }}>
                      {!club.lists || club.lists.length === 0 ? (
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', padding: '4px 8px' }}>No lists in this club</div>
                      ) : (
                        club.lists.map(list => {
                          const s = getListStyle(list);
                          return (
                            <button
                              key={list.id}
                              style={listBtnStyle(s.bg, s.color)}
                              onClick={() => handleToggle(list)}
                              onMouseEnter={e => { e.currentTarget.style.background = s.hover; }}
                              onMouseLeave={e => { e.currentTarget.style.background = s.bg; }}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                                {s.inList && <Check style={{ width: '12px', height: '12px', color: '#82dca0', flexShrink: 0 }} />}
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{list.name}</span>
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(menuContent, document.body);
}
