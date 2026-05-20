import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getListsWithMovies, createList, deleteList, renameList } from '@/api/lists';

import { Trash2, Search, Pencil, LayoutGrid, List as ListIcon, Plus, Star, Tv } from 'lucide-react';
import { useConfirm } from '@/components/ConfirmDialog';
import GlassBox from '@/components/GlassBox';
import Poster from '@/components/Poster';
import type { List as ListType } from '@/types/api';

export default function MyLists() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [globalViewMode, setGlobalViewMode] = useState<'grid' | 'list'>('grid');
  const [listViewModes, setListViewModes] = useState<Record<number, 'grid' | 'list'>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newListName, setNewListName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [lists, setLists] = useState<ListType[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getListsWithMovies();
        if (!cancelled) setLists(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleCreateList = async () => {
    const name = newListName.trim();
    if (!name) return;
    try {
      const newList = await createList(name);
      setLists(prev => [...prev, newList]);
      setNewListName('');
      setShowCreate(false);
    } catch {
      // error handled by interceptor
    }
  };

  const handleDeleteList = async (listId: number, listName: string) => {
    const ok = await confirm({
      title: 'Delete List',
      message: `Are you sure you want to delete "${listName}"?`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      danger: true,
    });
    if (ok) {
      try {
        await deleteList(listId);
        setLists(prev => prev.filter(l => l.id !== listId));
      } catch {
        // error handled by interceptor
      }
    }
  };

  const startRename = (list: ListType, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(list.id);
    setEditValue(list.name);
  };

  const saveRename = async (list: ListType) => {
    const name = editValue.trim();
    if (!name || name === list.name) {
      setEditingId(null);
      setEditValue('');
      return;
    }
    try {
      await renameList(list.id, name);
      setLists(prev => prev.map(l => l.id === list.id ? { ...l, name } : l));
    } catch {
      // error handled by interceptor
    }
    setEditingId(null);
    setEditValue('');
  };

  const filtered = query.length > 0
    ? lists.filter(l => l.name.toLowerCase().includes(query.toLowerCase()))
    : lists;

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
        Loading lists...
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingRight: '8px' }}>
      {/* Header: title left, search + create + collapse all right */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, color: '#fff', letterSpacing: '3px', textTransform: 'uppercase', textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>My Lists</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: '10px 16px', borderRadius: '10px',
              background: 'var(--t-primary-25)', border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff', fontSize: '13px', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', display: 'flex',
              alignItems: 'center', gap: '6px', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--t-primary-50)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--t-primary-25)'; }}
          >
            <Plus style={{ width: '14px', color: 'var(--t-primary)' }} /> Create List
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '260px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '10px', padding: '10px 16px', backdropFilter: 'blur(8px)', boxShadow: '0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
            <Search style={{ width: '16px', color: 'rgba(255,255,255,0.7)', flexShrink: 0 }} />
            <input style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '14px', fontFamily: 'inherit', width: '100%', caretColor: 'var(--t-primary)', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }} placeholder="Search lists..." value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', overflow: 'hidden' }}>
            <button onClick={() => { setGlobalViewMode('grid'); setListViewModes({}); }} style={{ padding: '10px 12px', background: globalViewMode === 'grid' ? 'var(--t-primary-25)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}>
              <LayoutGrid style={{ width: '16px', color: globalViewMode === 'grid' ? 'var(--t-primary)' : 'rgba(255,255,255,0.4)' }} />
            </button>
            <button onClick={() => { setGlobalViewMode('list'); setListViewModes({}); }} style={{ padding: '10px 12px', background: globalViewMode === 'list' ? 'var(--t-primary-25)' : 'transparent', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}>
              <ListIcon style={{ width: '16px', color: globalViewMode === 'list' ? 'var(--t-primary)' : 'rgba(255,255,255,0.4)' }} />
            </button>
          </div>
        </div>
      </div>

      {/* Create list form */}
      {showCreate && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input
            autoFocus
            value={newListName}
            onChange={e => setNewListName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateList(); }}
            placeholder="List name..."
            style={{
              flex: 1, padding: '8px 14px', borderRadius: '8px',
              background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.25)',
              color: '#fff', fontSize: '14px', fontFamily: 'inherit', outline: 'none',
            }}
          />
          <button onClick={handleCreateList} style={{ padding: '8px 18px', borderRadius: '8px', background: `linear-gradient(180deg, var(--t-primary)99, var(--t-primary)55)`, border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Create</button>
          <button onClick={() => { setShowCreate(false); setNewListName(''); }} style={{ padding: '8px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
        </div>
      )}

      {lists.length === 0 && !showCreate && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', gap: '12px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>No lists yet</div>
          <div style={{ fontSize: '12px' }}>Create your first list to start organizing movies and shows</div>
          <button onClick={() => setShowCreate(true)} style={{ marginTop: '8px', padding: '8px 18px', borderRadius: '6px', background: `linear-gradient(180deg, var(--t-primary)99, var(--t-primary)55)`, border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            <Plus style={{ width: '12px', display: 'inline', marginRight: '4px' }} />Create a List
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filtered.map((list) => {
          const viewMode = listViewModes[list.id] ?? globalViewMode;
          const allItems = [
            ...(list.movies || []).map(m => ({ id: m.id, title: m.title, poster_url: m.poster_url, type: 'movie' as const })),
            ...(list.shows || []).map(s => ({ id: s.id, title: s.title, poster_url: s.poster_url, type: 'tv' as const })),
          ];

          return (
          <GlassBox
            key={list.id}
            collapsible
            defaultCollapsed={false}
            title={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                {editingId === list.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }} onClick={e => e.stopPropagation()}>
                    <input
                      autoFocus
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveRename(list); if (e.key === 'Escape') { setEditingId(null); setEditValue(''); } }}
                      style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--t-primary-50)', borderRadius: '6px', color: '#fff', fontSize: '12px', fontFamily: 'inherit', padding: '4px 8px', flex: 1 }}
                    />
                    <button onClick={() => saveRename(list)} style={{ background: 'var(--t-primary-33)', border: '1px solid var(--t-primary-50)', borderRadius: '6px', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                  </div>
                ) : (
                  <span>{list.name}</span>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.15)', padding: '3px 10px', borderRadius: '10px', letterSpacing: '0', textTransform: 'none' }}>{allItems.length} titles</span>
                  {editingId !== list.id && (
                    <>
                      {/* Per-list view mode toggle */}
                      <div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                        <button
                          onClick={e => { e.stopPropagation(); setListViewModes(prev => ({ ...prev, [list.id]: 'grid' })); }}
                          title="Grid view"
                          style={{ padding: '4px 7px', background: viewMode === 'grid' ? 'var(--t-primary-25)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}
                        >
                          <LayoutGrid style={{ width: '12px', color: viewMode === 'grid' ? 'var(--t-primary)' : 'rgba(255,255,255,0.35)' }} />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); setListViewModes(prev => ({ ...prev, [list.id]: 'list' })); }}
                          title="List view"
                          style={{ padding: '4px 7px', background: viewMode === 'list' ? 'var(--t-primary-25)' : 'transparent', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}
                        >
                          <ListIcon style={{ width: '12px', color: viewMode === 'list' ? 'var(--t-primary)' : 'rgba(255,255,255,0.35)' }} />
                        </button>
                      </div>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '3px', display: 'flex', alignItems: 'center', position: 'relative', zIndex: 10 }} onClick={(e) => startRename(list, e)} title="Rename">
                        <Pencil style={{ width: '13px' }} />
                      </button>
                      <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '3px', display: 'flex', alignItems: 'center', position: 'relative', zIndex: 10 }} onClick={(e) => { e.stopPropagation(); handleDeleteList(list.id, list.name); }} title="Delete">
                        <Trash2 style={{ width: '13px' }} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            }
          >
            {viewMode === 'grid' ? (
              <div onClick={() => navigate(`/lists/${list.id}`)} style={{ cursor: 'pointer' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '8px', alignItems: 'start' }}>
                  {allItems.map(item => (
                    <div key={`${item.type}-${item.id}`} style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0, minWidth: 0 }}>
                      <div className="poster-wrap" style={{ position: 'relative', width: '100%' }}>
                        <Poster posterUrl={item.poster_url} style={{ borderRadius: '8px' }} />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{item.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {allItems.map((item, i) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    onClick={() => navigate(`/lists/${list.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.1s, border-color 0.1s', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
                  >
                    <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, minWidth: '20px', textAlign: 'right' }}>{i + 1}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {item.type === 'tv'
                          ? <><Tv style={{ width: '10px', height: '10px', flexShrink: 0 , color: 'var(--t-primary)' }} /><span>TV Show</span></>
                          : <><Star style={{ width: '10px', height: '10px', flexShrink: 0, color: 'rgba(255,255,255,0.3)' }} /><span>Movie</span></>
                        }
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassBox>
          );
        })}
      </div>

      {filtered.length === 0 && query.length > 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>No lists found for &ldquo;{query}&rdquo;</div>
      )}
    </div>
  );
}
