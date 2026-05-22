import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/data/ThemeContext';
import { useConfirm } from '@/components/ConfirmDialog';
import { THEMES } from '@/data/themeStore';
import GlassBox from '@/components/GlassBox';
import ImageCropModal from '@/components/ImageCropModal';
import { Check, Image, List as ListIcon, Users, Pin, PinOff, Upload, Save, LogOut } from 'lucide-react';
import { uploadPicture, uploadBanner } from '@/api/auth';
import { getLists, getPinnedLists, pinList, unpinList } from '@/api/lists';
import { getMyClubsWithLists, getPinnedClubs } from '@/api/clubs';
import { getSettings, updateSettings } from '@/api/settings';
import { toast } from 'sonner';
import type { List as ListType, Club } from '@/types/api';

const LS_KEYS = {
  profilePicture: 'palace_profile_picture',
  profileBanner: 'palace_profile_banner',
};

export default function Settings() {
  const { themeId, setTheme } = useTheme();
  const { user, updateProfile, refreshUser, logout } = useAuth();
  const confirm = useConfirm();
  const [saved, setSaved] = useState(false);

  /* ─── Real data from API ─── */
  const [myLists, setMyLists] = useState<ListType[]>([]);
  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [settingsLoading, setSettingsLoading] = useState(true);

  /* ─── Displayed List ─── */
  const [displayedListId, setDisplayedListId] = useState<number | null>(null);

  /* ─── Pin Lists ─── */
  const [pinnedLists, setPinnedLists] = useState<Record<number, boolean>>({});

  /* ─── Pin Club Lists ─── */
  const [, setPinnedClubs] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [settingsData, listsData, clubsData, pinnedListsData, pinnedClubsData] = await Promise.all([
          getSettings().catch(() => null),
          getLists().catch(() => []),
          getMyClubsWithLists().catch(() => []),
          getPinnedLists().catch(() => []),
          getPinnedClubs().catch(() => []),
        ]);
        if (!cancelled) {
          setMyLists(listsData);
          setAllClubs(clubsData || []);
          if (settingsData) {
            setDisplayedListId(settingsData.displayed_list);
          }
          const listRecord: Record<number, boolean> = {};
          pinnedListsData.forEach((l: ListType) => { listRecord[l.id] = true; });
          setPinnedLists(listRecord);
          const clubRecord: Record<number, boolean> = {};
          pinnedClubsData.forEach((c: Club) => { clubRecord[c.id] = true; });
          setPinnedClubs(clubRecord);
        }
      } catch { /* ignore */ }
      finally {
        if (!cancelled) setSettingsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  /* ─── Profile images ─── */
  const [profilePicture, setProfilePicture] = useState<string | null>(
    user?.profile_picture ?? null
  );
  const [profileBanner, setProfileBanner] = useState<string | null>(
    user?.banner ?? null
  );
  const [pendingPicture, setPendingPicture] = useState<File | null>(null);
  const [pendingBanner, setPendingBanner] = useState<File | null>(null);

  /* ─── Nickname & Bio ─── */
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    if (user?.nickname) setNickname(user.nickname);
    if (user?.bio !== undefined) setBio(user.bio);
    setProfilePicture(user?.profile_picture ?? null);
    setProfileBanner(user?.banner ?? null);
  }, [user?.nickname, user?.bio, user?.profile_picture, user?.banner]);

  const picInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  /* ─── Crop modal ─── */
  const [cropModal, setCropModal] = useState<{ src: string; type: 'picture' | 'banner' } | null>(null);

  /* ─── Handlers ─── */

  const togglePinnedList = useCallback(async (id: number) => {
    const currentlyPinned = !!pinnedLists[id];
    try {
      if (currentlyPinned) {
        await unpinList(id);
        setPinnedLists(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        toast.success('List unpinned');
      } else {
        await pinList(id);
        setPinnedLists(prev => ({ ...prev, [id]: true }));
        toast.success('List pinned');
      }
      window.dispatchEvent(new CustomEvent('settingschange'));
    } catch {
      // error handled by client interceptor
    }
  }, [pinnedLists]);


  const handleFile = async (
    file: File,
    setter: (v: string | null) => void,
    lsKey: string,
    uploadFn: (f: File) => Promise<{ url: string }>
  ) => {
    try {
      const { url } = await uploadFn(file);
      setter(url);
      localStorage.setItem(lsKey, url);
      await refreshUser();
    } catch {
      // error toast handled by client interceptor
    }
  };

  // Open crop modal when user picks a file
  const openCrop = (file: File | undefined, type: 'picture' | 'banner') => {
    if (!file) return;
    const src = URL.createObjectURL(file);
    setCropModal({ src, type });
  };

  // Called when user hits Apply in the crop modal — stores locally, does NOT upload yet
  const handleCropApply = async (dataUrl: string) => {
    if (!cropModal) return;
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], 'image.jpg', { type: 'image/jpeg' });
    if (cropModal.type === 'picture') {
      setPendingPicture(file);
      setProfilePicture(dataUrl);
    } else {
      setPendingBanner(file);
      setProfileBanner(dataUrl);
    }
    if (cropModal.src.startsWith('blob:')) URL.revokeObjectURL(cropModal.src);
    setCropModal(null);
  };

  const handleDisplayedListClick = async (listId: number) => {
    setDisplayedListId(listId);
    try {
      await updateSettings({ displayed_list: listId });
      window.dispatchEvent(new CustomEvent('settingschange'));
    } catch {
      // error handled by client interceptor
    }
  };

  const handleSave = async () => {
    try {
      await updateSettings({ displayed_list: displayedListId });
      window.dispatchEvent(new CustomEvent('settingschange'));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // error handled by client interceptor
    }
  };

  /* ─── Clock format ─── */
  const [timeFormat, setTimeFormat] = useState<'12' | '24'>(
    () => (localStorage.getItem('palace_time_format') as '12' | '24') ?? '24'
  );

  const handleTimeFormat = (fmt: '12' | '24') => {
    localStorage.setItem('palace_time_format', fmt);
    setTimeFormat(fmt);
    window.dispatchEvent(new CustomEvent('palace-timeformat-changed'));
  };

  /* ─── Active theme colour for UI feedback ─── */
  const activeTheme = THEMES.find(t => t.id === themeId) ?? THEMES[0];

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingRight: '8px' }}>
      <h1 style={{
        fontSize: '36px', fontWeight: 700, color: '#fff',
        letterSpacing: '3px', textTransform: 'uppercase',
        marginBottom: '16px', textShadow: '0 2px 12px rgba(0,0,0,0.3)',
      }}>
        Settings
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── Theme (full width) ── */}
        <GlassBox>
          <div style={{
            fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '12px',
          }}>
            Theme
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
            {THEMES.map(t => {
              const isActive = themeId === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  style={{
                    padding: '6px 4px',
                    borderRadius: '8px',
                    border: isActive
                      ? `2px solid ${t.primary}`
                      : '2px solid rgba(255,255,255,0.1)',
                    background: isActive
                      ? `${t.primary}22`
                      : 'rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                    fontFamily: 'inherit',
                    color: '#fff',
                    boxShadow: isActive ? `0 0 12px ${t.primary}44` : 'none',
                  }}
                >
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: `linear-gradient(135deg, ${t.primary}, ${t.primary}88)`,
                    border: isActive ? `2px solid #fff` : '1px solid rgba(255,255,255,0.2)',
                    boxShadow: isActive ? `0 0 8px ${t.primary}` : 'none',
                    transition: 'all 0.2s',
                  }} />
                  <span style={{
                    fontSize: '8px', fontWeight: 700,
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                  }}>
                    {t.label}
                  </span>
                </button>
              );
            })}
          </div>
        </GlassBox>

        {/* ── Two-column layout: Profile left, settings right ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '16px', alignItems: 'start' }}>

        {/* ── LEFT: Account / Profile — same card style as UserProfile ── */}
        <div>
          {/* Hidden file inputs */}
          <input ref={picInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { openCrop(e.target.files?.[0], 'picture'); e.target.value = ''; }} />
          <input ref={bannerInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { openCrop(e.target.files?.[0], 'banner'); e.target.value = ''; }} />

          <div style={{
            background: 'linear-gradient(180deg, var(--t-primary-18) 0%, var(--t-primary-10) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid var(--t-primary-30)',
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 12px 48px rgba(0,0,0,0.4), inset 0 1px 0 var(--t-primary-20)',
          }}>
            {/* Banner — 3:1 ratio, matches Users page cards exactly */}
            <div style={{
              width: '100%', aspectRatio: '3/1',
              background: profileBanner
                ? `url(${profileBanner}) center/cover no-repeat`
                : `linear-gradient(135deg, ${activeTheme.primary}88, ${activeTheme.primary}44)`,
              position: 'relative',
            }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.45) 100%)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', gap: '6px' }}>
                <button onClick={() => picInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.75)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.55)'; }}>
                  <Image style={{ width: '12px' }} /> Picture
                </button>
                <button onClick={() => bannerInputRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '6px', background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }} onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.75)'; }} onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.55)'; }}>
                  <Upload style={{ width: '12px' }} /> Banner
                </button>
              </div>
            </div>

            {/* Avatar overlapping banner — same size/offset as Users page cards */}
            <div style={{ position: 'relative', marginTop: '-42px', padding: '0 14px' }}>
              {profilePicture ? (
                <img src={profilePicture} alt="avatar" style={{ width: '84px', height: '84px', borderRadius: '50%', objectFit: 'cover', border: '4px solid rgba(0,0,0,0.5)', boxShadow: '0 4px 14px rgba(0,0,0,0.5)', display: 'block' }} />
              ) : (
                <div style={{ width: '84px', height: '84px', borderRadius: '50%', background: `linear-gradient(135deg, ${activeTheme.primary}99, ${activeTheme.primary}55)`, border: '4px solid rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 700, color: '#fff', boxShadow: '0 4px 14px rgba(0,0,0,0.5)' }}>
                  {nickname.slice(0, 2).toUpperCase() || 'U'}
                </div>
              )}
            </div>

            {/* Live preview: name + username + bio */}
            <div style={{ padding: '8px 14px 0' }}>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>{nickname || user?.username || 'Your Name'}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>@{user?.username || 'username'}</div>
              {bio ? (
                <div style={{ marginTop: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>{bio}</div>
              ) : (
                <div style={{ marginTop: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>No bio yet</div>
              )}
            </div>

            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '12px 14px 0' }} />

            {/* Edit fields */}
            <div style={{ padding: '12px 14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Nickname</label>
                  <span style={{ fontSize: '10px', color: nickname.length >= 16 ? 'rgba(255,80,80,0.8)' : 'rgba(255,255,255,0.25)' }}>{nickname.length}/16</span>
                </div>
                <input type="text" value={nickname} maxLength={16} onChange={e => { setNickname(e.target.value); setProfileSaved(false); }} style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: 'var(--t-primary-10)', color: '#fff', fontSize: '15px', fontWeight: 700, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }} onFocus={e => { e.currentTarget.style.borderColor = 'var(--t-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--t-primary-22)'; }} onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.boxShadow = 'none'; }} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '5px' }}>
                  <label style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Bio</label>
                  <span style={{ fontSize: '10px', color: bio.length >= 500 ? 'rgba(255,80,80,0.8)' : 'rgba(255,255,255,0.25)' }}>{bio.length}/500</span>
                </div>
                <textarea value={bio} maxLength={500} onChange={e => { setBio(e.target.value); setProfileSaved(false); }} placeholder="Tell us about yourself..." rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)', background: 'var(--t-primary-10)', color: '#fff', fontSize: '13px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box', transition: 'border-color 0.2s' }} onFocus={e => { e.currentTarget.style.borderColor = 'var(--t-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--t-primary-22)'; }} onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.boxShadow = 'none'; }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  onClick={async () => {
                    const ok = await confirm({
                      title: 'Save Profile',
                      message: 'Are you sure you want to save these changes?',
                      confirmLabel: 'Save',
                    });
                    if (!ok) return;
                    if (pendingPicture) {
                      await handleFile(pendingPicture, setProfilePicture, LS_KEYS.profilePicture, uploadPicture);
                      setPendingPicture(null);
                    }
                    if (pendingBanner) {
                      await handleFile(pendingBanner, setProfileBanner, LS_KEYS.profileBanner, uploadBanner);
                      setPendingBanner(null);
                    }
                    await updateProfile({ nickname, bio });
                    window.dispatchEvent(new CustomEvent('settingschange'));
                    setProfileSaved(true);
                    setTimeout(() => setProfileSaved(false), 2000);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 16px', borderRadius: '8px', background: profileSaved ? 'rgba(80,200,120,0.8)' : 'linear-gradient(180deg, var(--t-primary)99, var(--t-primary)55)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.2s' }}
                >
                  {profileSaved ? <><Check style={{ width: '13px' }} /> Saved</> : <><Save style={{ width: '13px' }} /> Save Profile</>}
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>Since <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* ── Displayed List ── */}
        <GlassBox title="Displayed List">
          {settingsLoading ? (
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', padding: '12px' }}>Loading...</div>
          ) : myLists.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', padding: '16px', textAlign: 'center' }}>
              No lists yet. <button onClick={() => window.location.hash = '/lists'} style={{ background: 'none', border: 'none', color: 'var(--t-primary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600 }}>Create a list</button>
            </div>
          ) : (
          <div style={{ maxHeight: '188px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* My lists */}
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>My Lists</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {myLists.map(list => {
                  const isActive = displayedListId === list.id;
                  return (
                    <button key={list.id} onClick={() => handleDisplayedListClick(list.id)} style={{ padding: '10px 12px', borderRadius: '8px', border: isActive ? '1px solid var(--t-primary)' : '1px solid rgba(255,255,255,0.1)', background: isActive ? 'var(--t-primary)22' : 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s', boxShadow: isActive ? '0 0 8px var(--t-glow)33' : 'none' }}>
                      {isActive && <Check style={{ width: '14px', color: 'var(--t-primary)', flexShrink: 0 }} />}
                      {list.name}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Club lists */}
            {allClubs.filter(c => (c.lists || []).length > 0).map(club => (
              <div key={club.id}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Users style={{ width: '10px' }} />{club.name}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  {(club.lists || []).map(list => {
                    const isActive = displayedListId === list.id;
                    return (
                      <button key={list.id} onClick={() => handleDisplayedListClick(list.id)} style={{ padding: '10px 12px', borderRadius: '8px', border: isActive ? '1px solid var(--t-primary)' : '1px solid rgba(255,255,255,0.1)', background: isActive ? 'var(--t-primary)22' : 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '13px', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s', boxShadow: isActive ? '0 0 8px var(--t-glow)33' : 'none' }}>
                        {isActive && <Check style={{ width: '14px', color: 'var(--t-primary)', flexShrink: 0 }} />}
                        {list.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          )}
        </GlassBox>

        {/* ── Pin Lists to Dashboard ── */}
        <GlassBox title="Pin Lists to Dashboard">
          {settingsLoading ? (
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', padding: '12px' }}>Loading...</div>
          ) : myLists.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', padding: '16px', textAlign: 'center' }}>
              No lists yet. <button onClick={() => window.location.hash = '/lists'} style={{ background: 'none', border: 'none', color: 'var(--t-primary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600 }}>Create a list</button>
            </div>
          ) : (
          <div style={{ maxHeight: '188px', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {myLists.map(list => {
              const isPinned = !!pinnedLists[list.id];
              return (
                <button
                  key={list.id}
                  onClick={() => togglePinnedList(list.id)}
                  style={{
                    padding: '0',
                    borderRadius: '8px',
                    border: isPinned
                      ? '1px solid var(--t-primary)'
                      : '1px solid rgba(255,255,255,0.1)',
                    background: isPinned
                      ? 'var(--t-primary)15'
                      : 'rgba(255,255,255,0.04)',
                    color: '#fff',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                    boxShadow: isPinned ? '0 0 8px var(--t-glow)22' : 'none',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <ListIcon style={{
                        width: '13px',
                        color: isPinned ? 'var(--t-primary)' : 'rgba(255,255,255,0.5)',
                        flexShrink: 0,
                      }} />
                      <span style={{
                        fontSize: '13px', fontWeight: 600, color: '#fff',
                      }}>
                        {list.name}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>
                        {list.movie_count}
                      </span>
                      {isPinned ? (
                        <Pin style={{ width: '13px', color: 'var(--t-primary)', flexShrink: 0 }} />
                      ) : (
                        <PinOff style={{ width: '13px', color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          )}
        </GlassBox>

        {/* ── Pin Club Lists to Dashboard ── */}
        <GlassBox title="Pin Club Lists to Dashboard">
          {settingsLoading ? (
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', padding: '12px' }}>Loading...</div>
          ) : allClubs.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', padding: '16px', textAlign: 'center' }}>
              No clubs yet. <button onClick={() => window.location.hash = '/clubs'} style={{ background: 'none', border: 'none', color: 'var(--t-primary)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600 }}>Browse clubs</button>
            </div>
          ) : (() => {
            const clubLists: (import('@/types/api').List & { clubName: string })[] = allClubs.flatMap(club => (club.lists || []).map(list => ({ ...list, clubName: club.name })));
            if (clubLists.length === 0) return (
              <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', padding: '16px', textAlign: 'center' }}>No lists in your clubs yet</div>
            );
            return (
              <div style={{ maxHeight: '188px', overflowY: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {clubLists.map(list => {
                  const isPinned = !!pinnedLists[list.id];
                  return (
                    <button
                      key={list.id}
                      onClick={() => togglePinnedList(list.id)}
                      style={{
                        padding: '0',
                        borderRadius: '8px',
                        border: isPinned ? '1px solid var(--t-primary)' : '1px solid rgba(255,255,255,0.1)',
                        background: isPinned ? 'var(--t-primary)15' : 'rgba(255,255,255,0.04)',
                        color: '#fff',
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s',
                        boxShadow: isPinned ? '0 0 8px var(--t-glow)22' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                          <ListIcon style={{ width: '13px', color: isPinned ? 'var(--t-primary)' : 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {list.name}
                            </div>
                            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                              {list.clubName}
                            </div>
                          </div>
                        </div>
                        {isPinned ? (
                          <Pin style={{ width: '13px', color: 'var(--t-primary)', flexShrink: 0 }} />
                        ) : (
                          <PinOff style={{ width: '13px', color: 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </GlassBox>

        {/* ── Display Preferences ── */}
        <GlassBox title="Display">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px' }}>Clock Format</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['24', '12'] as const).map(fmt => {
                  const active = timeFormat === fmt;
                  return (
                    <button
                      key={fmt}
                      onClick={() => handleTimeFormat(fmt)}
                      style={{
                        padding: '8px 20px', borderRadius: '8px', fontFamily: 'inherit',
                        fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                        border: active ? '1px solid var(--t-primary)' : '1px solid rgba(255,255,255,0.12)',
                        background: active ? 'var(--t-primary)22' : 'rgba(255,255,255,0.04)',
                        color: active ? '#fff' : 'rgba(255,255,255,0.5)',
                        boxShadow: active ? '0 0 8px var(--t-glow)33' : 'none',
                        transition: 'all 0.15s',
                      }}
                    >
                      {fmt === '24' ? '24-hour' : '12-hour'}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </GlassBox>

        {/* ── Account Actions ── */}
        <GlassBox>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '4px' }}>Account</div>
            <button
              onClick={logout}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '10px 16px', borderRadius: '8px',
                background: 'rgba(245,101,101,0.1)',
                border: '1px solid rgba(245,101,101,0.25)',
                color: '#f56565', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.2s', alignSelf: 'flex-start',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,101,101,0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(245,101,101,0.1)'; e.currentTarget.style.transform = 'none'; }}
            >
              <LogOut style={{ width: '15px' }} /> Log Out
            </button>
          </div>
        </GlassBox>

        {/* ── Save ── */}
        <button
          onClick={handleSave}
          style={{
            alignSelf: 'flex-start',
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '10px 24px', borderRadius: '8px',
            background: saved
              ? 'rgba(80,200,120,0.8)'
              : 'linear-gradient(180deg, var(--t-primary)99, var(--t-primary)55)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff', fontSize: '14px', fontWeight: 700,
            fontFamily: 'inherit', cursor: 'pointer',
            boxShadow: saved
              ? '0 2px 12px rgba(80,200,120,0.3)'
              : '0 2px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.15)',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={e => {
            if (!saved) {
              e.currentTarget.style.boxShadow =
                '0 4px 20px var(--t-glow)33, inset 0 1px 0 rgba(255,255,255,0.2)';
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = saved
              ? '0 2px 12px rgba(80,200,120,0.3)'
              : '0 2px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.15)';
          }}
        >
          {saved ? (
            <><Check style={{ width: '16px' }} /> Saved</>
          ) : (
            'Save Changes'
          )}
        </button>

        </div>{/* end right column */}
        </div>{/* end two-column grid */}
      </div>

      {/* Image crop modal */}
      {cropModal && (
        <ImageCropModal
          src={cropModal.src}
          shape={cropModal.type === 'picture' ? 'circle' : 'rect'}
          aspectRatio={cropModal.type === 'banner' ? 3 : 1}
          onApply={handleCropApply}
          onCancel={() => {
            if (cropModal.src.startsWith('blob:')) URL.revokeObjectURL(cropModal.src);
            setCropModal(null);
          }}
        />
      )}
    </div>
  );
}
