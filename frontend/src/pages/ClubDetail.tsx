import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, Check, Settings, X, Image, Plus, Pencil, Trash2, LayoutGrid, List as ListIcon, Tv, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirm } from '@/components/ConfirmDialog';
import { get_club, joinClub, leaveClub, updateClub, uploadClubImage, create_club_list, delete_club_list, rename_club_list, grant_mod, revoke_mod, grant_helper, revoke_helper, kick_member } from '@/api/clubs';
import ImageCropModal from '@/components/ImageCropModal';
import MediaDetailModal from '@/components/MediaDetailModal';
import ShowDetailModal from '@/components/ShowDetailModal';
import Poster from '@/components/Poster';
import GlassBox from '@/components/GlassBox';
import type { Club, User, TMDBResult } from '@/types/api';

function userGradient(nickname: string) {
  const hash = nickname.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hues = [200, 220, 240, 180, 260, 210, 230, 190];
  const h1 = hues[hash % hues.length];
  return `linear-gradient(135deg, hsl(${h1}, 60%, 45%), hsl(${(h1 + 30) % 360}, 50%, 30%))`;
}

function userBannerGradient(nickname: string) {
  const hash = nickname.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hues = [210, 230, 200, 250, 190, 240, 220, 180];
  const h1 = hues[hash % hues.length];
  return `linear-gradient(135deg, hsl(${h1}, 50%, 35%), hsl(${(h1 + 40) % 360}, 45%, 25%))`;
}

function clubGradient(name: string) {
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hues = [200, 240, 260, 180, 210, 220, 190, 230];
  const h1 = hues[hash % hues.length];
  return `linear-gradient(135deg, hsl(${h1}, 55%, 30%), hsl(${(h1 + 40) % 360}, 50%, 22%))`;
}

export default function ClubDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: current_user } = useAuth();
  const club_id = parseInt(id || '0');
  const [club, setClub] = useState<Club | null>(null);
  const [joined, setJoined] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TMDBResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [popupPos, setPopupPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const popupRef = useRef<HTMLDivElement>(null);
  const confirm = useConfirm();

  useEffect(() => {
    if (!selectedMember) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        setSelectedMember(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedMember]);

  // List view modes
  const [listViewModes, setListViewModes] = useState<Record<number, 'grid' | 'list'>>({});

  // List management state
  const [showCreateList, setShowCreateList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [creatingList, setCreatingList] = useState(false);
  const [renamingListId, setRenamingListId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // Edit modal state
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editImageSrc, setEditImageSrc] = useState<string | null>(null);
  const [editImageBlob, setEditImageBlob] = useState<Blob | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const editImageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await get_club(club_id);
        if (!cancelled) {
          setClub(data);
          const members = data.members || [];
          setJoined(members.some(m => m.id === current_user?.id));
        }
      } catch {
        if (!cancelled) setClub(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (club_id) load();
    return () => { cancelled = true; };
  }, [club_id, current_user?.id]);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Loading...</div>;
  if (!club) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Club not found</div>;

  const members = club.members || [];
  const admin = members.find(m => m.id === club.admin_id);
  const clubLists = club.lists || [];
  const isAdmin = current_user?.id === club.admin_id;
  const isMod = !isAdmin && (club.mod_ids || []).includes(current_user?.id ?? -1);
  const isHelper = !isAdmin && !isMod && (club.helper_ids || []).includes(current_user?.id ?? -1);
  const canManage = isAdmin || isMod;

  const handleJoinLeave = async () => {
    if (joined) {
      const ok = await confirm({ title: 'Leave Club', message: `Leave "${club.name}"?`, confirmLabel: 'Leave', cancelLabel: 'Cancel', danger: true });
      if (ok) {
        try {
          await leaveClub(club.id);
          setJoined(false);
          setClub(c => c ? {
            ...c,
            member_count: (c.member_count || 1) - 1,
            members: (c.members || []).filter(m => m.id !== current_user?.id),
          } : c);
        } catch {}
      }
    } else {
      try {
        await joinClub(club.id);
        setJoined(true);
        setClub(c => c ? {
          ...c,
          member_count: (c.member_count || 0) + 1,
          members: current_user ? [...(c.members || []), current_user as User] : c.members,
        } : c);
      } catch {}
    }
  };

  const openEdit = () => {
    setEditName(club.name);
    setEditDesc(club.description || '');
    setEditImageSrc(club.image_url || null);
    setEditImageBlob(null);
    setShowEdit(true);
  };

  const handleSaveEdit = async () => {
    if (!club) return;
    setSaving(true);
    try {
      let updated = await updateClub(club.id, { name: editName.trim(), description: editDesc.trim() });
      if (editImageBlob) {
        const file = new File([editImageBlob], 'thumbnail.jpg', { type: 'image/jpeg' });
        const { url } = await uploadClubImage(club.id, file);
        updated = { ...updated, image_url: url };
      }
      setClub(prev => prev ? { ...prev, ...updated } : prev);
      setShowEdit(false);
    } catch {} finally { setSaving(false); }
  };

  const handleCropApply = async (dataUrl: string) => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    setEditImageBlob(blob);
    setEditImageSrc(dataUrl);
    if (cropSrc?.startsWith('blob:')) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    setCreatingList(true);
    try {
      const newList = await create_club_list(club_id, newListName.trim());
      setClub(prev => prev ? { ...prev, lists: [...(prev.lists || []), { ...newList, movies: [], movie_count: 0, show_count: 0 }] } : prev);
      setNewListName('');
      setShowCreateList(false);
    } catch {} finally { setCreatingList(false); }
  };

  const handleDeleteList = async (list_id: number, list_name: string) => {
    const ok = await confirm({ title: 'Delete List', message: `Delete "${list_name}"? This cannot be undone.`, confirmLabel: 'Delete', cancelLabel: 'Cancel', danger: true });
    if (!ok) return;
    try {
      await delete_club_list(club_id, list_id);
      setClub(prev => prev ? { ...prev, lists: (prev.lists || []).filter(l => l.id !== list_id) } : prev);
    } catch {}
  };

  const handleRenameList = async (list_id: number) => {
    if (!renameValue.trim()) return;
    try {
      await rename_club_list(club_id, list_id, renameValue.trim());
      setClub(prev => prev ? { ...prev, lists: (prev.lists || []).map(l => l.id === list_id ? { ...l, name: renameValue.trim() } : l) } : prev);
      setRenamingListId(null);
    } catch {
      setRenamingListId(null);
    }
  };

  return (
    <>
    <div style={{ height: '100%', overflowY: 'auto', paddingRight: '8px' }}>
      <button style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }} onClick={() => navigate('/clubs')} onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}>
        <ArrowLeft style={{ width: '14px' }} /> Clubs
      </button>

      {/* ── Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr', gap: '16px', alignItems: 'start' }}>

        {/* ── LEFT: Club card + Members ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Club profile card */}
          <div style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid var(--t-primary-25)', background: 'linear-gradient(180deg, var(--t-primary-18) 0%, var(--t-primary-10) 100%)', backdropFilter: 'blur(20px)' }}>
            {/* Banner/Thumbnail */}
            <div style={{ aspectRatio: '16/9', background: club.image_url ? `url(${club.image_url}) center/cover no-repeat` : clubGradient(club.name), position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {!club.image_url && <Users style={{ width: '32px', color: 'rgba(255,255,255,0.18)' }} />}
              {canManage && (
                <button onClick={openEdit} style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <Settings style={{ width: '11px' }} /> Edit
                </button>
              )}
            </div>
            {/* Info */}
            <div style={{ padding: '16px 18px' }}>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{club.name}</div>
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>
                {members.length} {members.length === 1 ? 'member' : 'members'} · Admin: {admin?.nickname || admin?.username || 'Unknown'}
              </div>
              {club.description && (
                <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, marginTop: '12px', marginBottom: 0 }}>{club.description}</p>
              )}
              {!isAdmin && (
                <button onClick={handleJoinLeave} style={{ marginTop: '14px', width: '100%', padding: '8px', borderRadius: '8px', border: joined ? '1px solid rgba(255,255,255,0.2)' : 'none', background: joined ? 'rgba(255,255,255,0.08)' : 'linear-gradient(180deg, #5cb85c 0%, #449d44 100%)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: joined ? 'none' : '0 2px 8px rgba(68,157,68,0.3)', transition: 'all 0.2s', fontFamily: 'inherit' }}>
                  {joined ? <><Check style={{ width: '13px' }} /> Joined</> : 'Join Club'}
                </button>
              )}
            </div>
          </div>

          {/* Members */}
          <GlassBox title="Members" collapsible defaultCollapsed={false} rightAction={<span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0', textTransform: 'none' }}>{members.length}</span>}>
            {members.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                {members.map(m => {
                  const display_name = (m.nickname ?? m.username) || 'User';
                  const isSelected = selectedMember?.id === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={e => {
                        if (isSelected) { setSelectedMember(null); return; }
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const popupW = 340, popupH = 320;
                        const MARGIN = 16;
                        // Position to the right of the card, top-aligned with the card
                        let x = rect.right + MARGIN;
                        if (x + popupW > window.innerWidth - MARGIN) x = rect.left - popupW - MARGIN;
                        if (x < MARGIN) x = MARGIN;
                        let y = rect.top;
                        if (y < MARGIN) y = MARGIN;
                        if (y + popupH > window.innerHeight - MARGIN) y = window.innerHeight - popupH - MARGIN;
                        setPopupPos({ x, y });
                        setSelectedMember(m);
                      }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', cursor: 'pointer', padding: '6px', borderRadius: '10px', border: `1px solid ${isSelected ? 'var(--t-primary-50)' : 'transparent'}`, background: isSelected ? 'var(--t-primary-12)' : 'transparent', transition: 'all 0.15s' }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {m.profile_picture ? (
                        <div className="avatar-circle" style={{ width: '52px', height: '52px', borderRadius: '50%', overflow: 'hidden', boxShadow: isSelected ? 'inset 0 0 0 2px var(--t-primary), 0 0 0 3px var(--t-primary-30)' : 'inset 0 0 0 2px rgba(255,255,255,0.2)', transition: 'all 0.15s' }}>
                          <img src={m.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        </div>
                      ) : (
                        <div className="avatar-circle" style={{ width: '52px', height: '52px', background: userGradient(display_name), borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#fff', boxShadow: isSelected ? 'inset 0 0 0 2px var(--t-primary), 0 0 0 3px var(--t-primary-30)' : 'inset 0 0 0 2px rgba(255,255,255,0.2)', transition: 'all 0.15s' }}>
                          {display_name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', maxWidth: '64px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{display_name}</div>
                      {m.id === club.admin_id
                        ? <div style={{ fontSize: '8px', color: 'var(--t-primary)', fontWeight: 700, letterSpacing: '0.5px', marginTop: '-2px' }}>ADMIN</div>
                        : (club.mod_ids || []).includes(m.id)
                          ? <div style={{ fontSize: '8px', color: '#f0a500', fontWeight: 700, letterSpacing: '0.5px', marginTop: '-2px' }}>MOD</div>
                          : (club.helper_ids || []).includes(m.id)
                            ? <div style={{ fontSize: '8px', color: '#63b3ed', fontWeight: 700, letterSpacing: '0.5px', marginTop: '-2px' }}>HELPER</div>
                            : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>No members yet</div>
            )}
          </GlassBox>
        </div>

        {/* ── RIGHT: Lists ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Lists header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '2px', textTransform: 'uppercase', margin: 0 }}>Lists · {clubLists.length}</h2>
            {(canManage || isHelper) && (
              <button
                onClick={e => { e.stopPropagation(); setShowCreateList(true); setNewListName(''); }}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '7px', background: 'var(--t-primary-20)', border: '1px solid var(--t-primary-35)', color: 'var(--t-primary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--t-primary-30)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--t-primary-20)'; }}
              >
                <Plus style={{ width: '12px' }} /> New List
              </button>
            )}
          </div>

          {clubLists.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'rgba(255,255,255,0.3)', fontSize: '13px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px' }}>
              {(canManage || isHelper) ? 'No lists yet — create one!' : 'No lists yet'}
            </div>
          ) : (
            clubLists.map(list => {
              const allItems = [...(list.movies || []).map(m => ({ ...m, type: 'movie' as const })), ...(list.shows || []).map(s => ({ ...s, type: 'tv' as const }))];
              const totalCount = (list.movie_count || 0) + (list.show_count || 0);
              const viewMode = listViewModes[list.id] ?? 'grid';
              return (
                <GlassBox
                  key={list.id}
                  collapsible
                  defaultCollapsed={false}
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      {renamingListId === list.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }} onClick={e => e.stopPropagation()}>
                          <input value={renameValue} onChange={e => setRenameValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleRenameList(list.id); if (e.key === 'Escape') setRenamingListId(null); }} autoFocus style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--t-primary-50)', borderRadius: '6px', color: '#fff', fontSize: '12px', fontFamily: 'inherit', padding: '3px 8px', flex: 1, outline: 'none' }} />
                          <button onClick={() => handleRenameList(list.id)} style={{ background: 'var(--t-primary-33)', border: '1px solid var(--t-primary-50)', borderRadius: '6px', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit' }}>Save</button>
                        </div>
                      ) : (
                        <span>{list.name}</span>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.15)', padding: '2px 8px', borderRadius: '8px', letterSpacing: '0', textTransform: 'none', fontWeight: 400 }}>{totalCount} titles</span>
                        {renamingListId !== list.id && (
                          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
                            <button onClick={e => { e.stopPropagation(); setListViewModes(p => ({ ...p, [list.id]: 'grid' })); }} style={{ padding: '4px 7px', background: viewMode === 'grid' ? 'var(--t-primary-25)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                              <LayoutGrid style={{ width: '12px', color: viewMode === 'grid' ? 'var(--t-primary)' : 'rgba(255,255,255,0.35)' }} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); setListViewModes(p => ({ ...p, [list.id]: 'list' })); }} style={{ padding: '4px 7px', background: viewMode === 'list' ? 'var(--t-primary-25)' : 'transparent', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                              <ListIcon style={{ width: '12px', color: viewMode === 'list' ? 'var(--t-primary)' : 'rgba(255,255,255,0.35)' }} />
                            </button>
                          </div>
                        )}
                        {canManage && renamingListId !== list.id && (
                          <>
                            <button onClick={e => { e.stopPropagation(); setRenamingListId(list.id); setRenameValue(list.name); }} title="Rename" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '3px', display: 'flex', alignItems: 'center' }} onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }} onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}>
                              <Pencil style={{ width: '12px' }} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDeleteList(list.id, list.name); }} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: '3px', display: 'flex', alignItems: 'center' }} onMouseEnter={e => { e.currentTarget.style.color = '#f56565'; }} onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.3)'; }}>
                              <Trash2 style={{ width: '12px' }} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  }
                >
                  {allItems.length > 0 ? (
                    viewMode === 'grid' ? (
                      <div onClick={() => navigate(`/lists/${list.id}`, { state: { fromClub: club.id } })} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px' }}>
                          {allItems.map(item => (
                            <div key={item.id} style={{ minWidth: 0 }}>
                              <Poster poster_url={item.poster_url} style={{ borderRadius: '6px' }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {allItems.map((item, i) => (
                          <div key={item.id} onClick={() => navigate(`/lists/${list.id}`, { state: { fromClub: club.id } })} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 12px', borderRadius: '6px', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', transition: 'background 0.1s' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontWeight: 700, minWidth: '20px', textAlign: 'right' }}>{i + 1}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
                              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {(item as { type?: string }).type === 'tv'
                                  ? <><Tv style={{ width: '10px', color: 'var(--t-primary)' }} /> TV Show</>
                                  : <><Star style={{ width: '10px', color: 'rgba(255,255,255,0.3)' }} /> Movie</>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Empty — add some titles</div>
                  )}
                </GlassBox>
              );
            })
          )}
        </div>
      </div>

      {/* Create List Modal */}
      {showCreateList && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }} onClick={() => setShowCreateList(false)}>
          <div className="modal-in" style={{ background: 'linear-gradient(180deg, var(--t-primary-20) 0%, var(--t-primary-10) 100%)', backdropFilter: 'blur(28px)', border: '1px solid var(--t-primary-40)', borderRadius: '14px', padding: '24px', width: '380px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: '#fff' }}>New Club List</span>
              <button onClick={() => setShowCreateList(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: '4px' }}><X style={{ width: '16px' }} /></button>
            </div>
            <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: '6px' }}>List Name</label>
            <input
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateList(); if (e.key === 'Escape') setShowCreateList(false); }}
              placeholder="e.g. Must Watch, Horror Picks..."
              autoFocus
              style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--t-primary-10)', border: '1px solid var(--t-primary-30)', color: '#fff', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: '18px' }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--t-primary)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--t-primary-30)'; }}
            />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreateList(false)} style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--t-primary-15)', border: '1px solid var(--t-primary-35)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleCreateList} disabled={creatingList || !newListName.trim()} style={{ padding: '8px 20px', borderRadius: '8px', background: 'var(--t-primary)', border: 'none', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: creatingList || !newListName.trim() ? 0.6 : 1 }}>
                {creatingList ? 'Creating...' : 'Create List'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Admin Edit Modal ── */}
      {showEdit && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }} onClick={() => setShowEdit(false)}>
          <div className="modal-in" style={{ background: 'linear-gradient(180deg, var(--t-primary-20) 0%, var(--t-primary-10) 100%)', backdropFilter: 'blur(28px)', border: '1px solid var(--t-primary-40)', borderRadius: '16px', padding: '28px', width: '460px', boxShadow: '0 24px 64px rgba(0,0,0,0.6), inset 0 1px 0 var(--t-primary-30)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>Edit Club</span>
              <button onClick={() => setShowEdit(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: '4px' }}><X style={{ width: '18px' }} /></button>
            </div>

            {/* Thumbnail */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: '8px' }}>Thumbnail</label>
              <input ref={editImageRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setCropSrc(URL.createObjectURL(f)); } e.target.value = ''; }} />
              <div onClick={() => editImageRef.current?.click()} style={{ aspectRatio: '4/3', borderRadius: '10px', border: '2px dashed rgba(255,255,255,0.2)', cursor: 'pointer', overflow: 'hidden', background: editImageSrc ? `url(${editImageSrc}) center/cover` : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.15s', position: 'relative' }} onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--t-primary)'; }} onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}>
                {editImageSrc && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }} onMouseEnter={e => { e.currentTarget.style.opacity = '1'; }} onMouseLeave={e => { e.currentTarget.style.opacity = '0'; }}><Image style={{ width: '28px', color: '#fff' }} /></div>}
                {!editImageSrc && <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.35)' }}><Image style={{ width: '28px' }} /><span style={{ fontSize: '12px' }}>Click to change thumbnail</span></div>}
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: '6px' }}>Name</label>
              <input value={editName} onChange={e => setEditName(e.target.value)} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--t-primary-10)', border: '1px solid var(--t-primary-30)', color: '#fff', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} onFocus={e => { e.currentTarget.style.borderColor = 'var(--t-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--t-primary-22)'; }} onBlur={e => { e.currentTarget.style.borderColor = 'var(--t-primary-30)'; e.currentTarget.style.boxShadow = 'none'; }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: '6px' }}>Description</label>
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--t-primary-10)', border: '1px solid var(--t-primary-30)', color: '#fff', fontSize: '14px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} onFocus={e => { e.currentTarget.style.borderColor = 'var(--t-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--t-primary-22)'; }} onBlur={e => { e.currentTarget.style.borderColor = 'var(--t-primary-30)'; e.currentTarget.style.boxShadow = 'none'; }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowEdit(false)} style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--t-primary-15)', border: '1px solid var(--t-primary-35)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleSaveEdit} disabled={saving || !editName.trim()} style={{ padding: '8px 20px', borderRadius: '8px', background: 'linear-gradient(180deg, var(--t-primary)99, var(--t-primary)55)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crop modal */}
      {cropSrc && (
        <ImageCropModal src={cropSrc} shape="rect" aspectRatio={16 / 9} onApply={handleCropApply} onCancel={() => { if (cropSrc.startsWith('blob:')) URL.revokeObjectURL(cropSrc); setCropSrc(null); }} />
      )}

      {selectedItem && selectedItem.media_type === 'tv' ? (
        <ShowDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      ) : selectedItem ? (
        <MediaDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      ) : null}
    </div>

    {/* ── Member popup — positioned near click ── */}
    <style>{`@keyframes popIn{from{opacity:0;transform:scale(0.88) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>
    {selectedMember && createPortal((() => {
      const m = selectedMember;
      const display_name = (m.nickname ?? m.username) || 'User';
      return (
        <div
          ref={popupRef}
          style={{ position: 'fixed', left: popupPos.x, top: popupPos.y, zIndex: 500, width: '340px', borderRadius: '18px', overflow: 'hidden', background: 'linear-gradient(180deg, var(--t-primary-20) 0%, var(--t-primary-14) 100%), rgba(6, 4, 14, 0.96)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: '1px solid var(--t-primary-40)', boxShadow: '0 24px 64px rgba(0,0,0,0.9)', animation: 'popIn 0.18s cubic-bezier(0.34,1.56,0.64,1)', maxHeight: '90vh', overflowY: 'auto' }}
        >
          {/* Banner */}
          <div style={{ height: '110px', background: m.banner ? `url(${m.banner}) center/cover` : userBannerGradient(display_name), position: 'relative', flexShrink: 0 }}>
            <button onClick={() => setSelectedMember(null)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}>
              <X style={{ width: '13px' }} />
            </button>
          </div>

          {/* Avatar overlapping banner — Discord style */}
          <div style={{ position: 'relative', marginTop: '-44px', padding: '0 18px 0' }}>
            {m.profile_picture ? (
              <div className="avatar-circle" style={{ width: '80px', height: '80px', boxShadow: '0 0 0 5px rgba(255,255,255,0.12), 0 4px 16px rgba(0,0,0,0.5)' }}>
                <img src={m.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            ) : (
              <div className="avatar-circle" style={{ width: '80px', height: '80px', background: userGradient(display_name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 700, color: '#fff', boxShadow: '0 0 0 5px rgba(255,255,255,0.12), 0 4px 16px rgba(0,0,0,0.5)' }}>
                {display_name.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          <div style={{ padding: '10px 18px 18px' }}>
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>{display_name}</div>
              {m.username && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '1px' }}>@{m.username}</div>}
              <div style={{ marginTop: '6px' }}>
                {m.id === club!.admin_id
                  ? <div style={{ display: 'inline-block', fontSize: '9px', color: 'var(--t-primary)', fontWeight: 700, letterSpacing: '1px', background: 'var(--t-primary-15)', border: '1px solid var(--t-primary-30)', padding: '2px 8px', borderRadius: '4px' }}>ADMIN</div>
                  : (club!.mod_ids || []).includes(m.id)
                    ? <div style={{ display: 'inline-block', fontSize: '9px', color: '#f0a500', fontWeight: 700, letterSpacing: '1px', background: 'rgba(240,165,0,0.12)', border: '1px solid rgba(240,165,0,0.3)', padding: '2px 8px', borderRadius: '4px' }}>MOD</div>
                    : (club!.helper_ids || []).includes(m.id)
                      ? <div style={{ display: 'inline-block', fontSize: '9px', color: '#63b3ed', fontWeight: 700, letterSpacing: '1px', background: 'rgba(99,179,237,0.12)', border: '1px solid rgba(99,179,237,0.3)', padding: '2px 8px', borderRadius: '4px' }}>HELPER</div>
                      : null}
              </div>
            </div>
            {(m as User & { bio?: string }).bio && (
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', marginBottom: '14px' }}>{(m as User & { bio?: string }).bio}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => { setSelectedMember(null); navigate(`/profile/${m.username}`); }}
                style={{ width: '100%', padding: '11px', borderRadius: '10px', background: 'var(--t-primary-60)', border: '1px solid var(--t-primary-80)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.5px' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--t-primary-75)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--t-primary-60)'; }}
              >
                View Profile
              </button>
              {isAdmin && m.id !== club!.admin_id && (() => {
                const memberIsMod = (club!.mod_ids || []).includes(m.id);
                const memberIsHelper = (club!.helper_ids || []).includes(m.id);
                const hasRole = memberIsMod || memberIsHelper;
                return (
                  <>
                    {!memberIsMod && (
                      <button
                        onClick={async () => {
                          try {
                            await grant_mod(club!.id, m.id);
                            setClub(await get_club(club!.id));
                          } catch { /* ignored */ }
                        }}
                        style={{ width: '100%', padding: '9px', borderRadius: '10px', background: 'rgba(240,165,0,0.12)', border: '1px solid rgba(240,165,0,0.3)', color: '#f0a500', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                      >Grant Mod</button>
                    )}
                    {!memberIsHelper && (
                      <button
                        onClick={async () => {
                          try {
                            await grant_helper(club!.id, m.id);
                            setClub(await get_club(club!.id));
                          } catch { /* ignored */ }
                        }}
                        style={{ width: '100%', padding: '9px', borderRadius: '10px', background: 'rgba(99,179,237,0.12)', border: '1px solid rgba(99,179,237,0.3)', color: '#63b3ed', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                      >Grant Helper</button>
                    )}
                    {hasRole && (
                      <button
                        onClick={async () => {
                          try {
                            if (memberIsMod) await revoke_mod(club!.id, m.id);
                            if (memberIsHelper) await revoke_helper(club!.id, m.id);
                            setClub(await get_club(club!.id));
                          } catch { /* ignored */ }
                        }}
                        style={{ width: '100%', padding: '9px', borderRadius: '10px', background: 'rgba(220,60,60,0.1)', border: '1px solid rgba(220,60,60,0.25)', color: '#f56565', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                      >Revoke Role</button>
                    )}
                    <button
                      onClick={async () => {
                        const ok = await confirm({ title: 'Kick Member', message: `Kick ${(m.nickname || m.username)} from the club?`, confirmLabel: 'Kick', cancelLabel: 'Cancel', danger: true });
                        if (!ok) return;
                        try {
                          await kick_member(club!.id, m.id);
                          setClub(await get_club(club!.id));
                          setSelectedMember(null);
                        } catch { /* ignored */ }
                      }}
                      style={{ width: '100%', padding: '9px', borderRadius: '10px', background: 'rgba(220,60,60,0.15)', border: '1px solid rgba(220,60,60,0.35)', color: '#f56565', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                    >Kick from Club</button>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      );
    })(), document.body)}
    </>
  );
}
