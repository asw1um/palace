import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Search, LayoutGrid, List, Plus, X, Image } from 'lucide-react';
import { get_clubs, create_club, uploadClubImage } from '@/api/clubs';
import { GlassCard } from '@/components/GlassBox';
import ImageCropModal from '@/components/ImageCropModal';
import type { Club } from '@/types/api';
import { useIsMobile } from '@/hooks/use-mobile';

function clubGradient(name: string) {
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hues = [200, 240, 260, 180, 210, 220, 190, 230];
  const h1 = hues[hash % hues.length];
  const h2 = (h1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${h1}, 55%, 30%), hsl(${h2}, 50%, 22%))`;
}

export default function Clubs() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [new_name, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string | null>(null);
  const [pendingImageBlob, setPendingImageBlob] = useState<Blob | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await get_clubs();
        if (!cancelled) setAllClubs(data.all_clubs || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const handleCreate = async () => {
    const name = new_name.trim();
    if (!name) return;
    setCreating(true);
    try {
      let club = await create_club(name, newDesc.trim() || undefined);
      if (pendingImageBlob) {
        const file = new File([pendingImageBlob], 'thumbnail.jpg', { type: 'image/jpeg' });
        const { url } = await uploadClubImage(club.id, file);
        club = { ...club, image_url: url };
      }
      setAllClubs(prev => [club, ...prev]);
      setNewName(''); setNewDesc(''); setPendingImageSrc(null); setPendingImageBlob(null);
      setShowCreate(false);
    } catch { /* handled by interceptor */ }
    finally { setCreating(false); }
  };

  const handleCropApply = async (dataUrl: string) => {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    setPendingImageBlob(blob);
    setPendingImageSrc(dataUrl);
    if (cropSrc?.startsWith('blob:')) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const filtered = query.length > 0
    ? allClubs.filter(c => c.name.toLowerCase().includes(query.toLowerCase()))
    : allClubs;

  return (
    <div style={{ height: isMobile ? 'auto' : '100%', overflowY: isMobile ? 'initial' : 'auto', paddingRight: isMobile ? '0px' : '8px', boxSizing: 'border-box', width: '100%' }}>
      <div style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row', 
        gap: '16px', 
        marginBottom: '20px',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between'
      }}>
        
        <h1 style={{ 
          fontSize: isMobile ? '24px' : '36px', 
          fontWeight: 700, 
          color: '#fff', 
          letterSpacing: '3px', 
          textTransform: 'uppercase', 
          margin: 0 
        }}>Clubs</h1>

        <div style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row', 
          gap: '12px', 
          width: isMobile ? '100%' : 'auto',
          alignItems: isMobile ? 'stretch' : 'center'
        }}>
          
          {/* Search */}
          <div style={{ 
            flexGrow: 1, 
            display: 'flex', 
            alignItems: 'center', 
            gap: '10px', 
            background: 'rgba(0,0,0,0.35)', 
            border: '1px solid rgba(255,255,255,0.3)', 
            borderRadius: '10px', 
            padding: '10px 16px' 
          }}>
            <Search style={{ width: '16px', color: 'rgba(255,255,255,0.7)' }} />
            <input style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '14px', width: '100%' }} placeholder="Search clubs..." value={query} onChange={e => setQuery(e.target.value)} />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
            <button 
              onClick={() => setShowCreate(true)} 
              style={{ 
                padding: isMobile ? '8px 16px' : '10px 20px', // Smaller padding on mobile
                fontSize: '13px',
                borderRadius: '10px', 
                background: 'var(--t-primary-25)', 
                border: '1px solid rgba(255,255,255,0.2)', 
                color: '#fff', 
                fontWeight: 700, 
                cursor: 'pointer',
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px' 
              }}
            >
              <Plus style={{ width: '14px', color: 'var(--t-primary)' }} /> 
              {isMobile ? 'Create' : 'Create Club'} 
            </button>
            
            <div style={{ display: 'flex', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', overflow: 'hidden' }}>
              <button onClick={() => setViewMode('grid')} style={{ padding: '10px 12px', background: viewMode === 'grid' ? 'var(--t-primary-25)' : 'transparent', border: 'none' }}>
                <LayoutGrid style={{ width: '16px', color: viewMode === 'grid' ? 'var(--t-primary)' : 'rgba(255,255,255,0.4)' }} />
              </button>
              <button onClick={() => setViewMode('list')} style={{ padding: '10px 12px', background: viewMode === 'list' ? 'var(--t-primary-25)' : 'transparent', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                <List style={{ width: '16px', color: viewMode === 'list' ? 'var(--t-primary)' : 'rgba(255,255,255,0.4)' }} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Create club modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowCreate(false)}>
          <div className="modal-in" style={{ background: 'linear-gradient(180deg, var(--t-primary-20) 0%, var(--t-primary-10) 100%)', backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)', border: '1px solid var(--t-primary-40)', borderRadius: '16px', padding: isMobile ? '20px' : '28px', width: isMobile ? 'calc(100% - 32px)' : '440px', maxWidth: '440px', boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 var(--t-primary-30)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>Create Club</span>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: '4px' }}><X style={{ width: '18px' }} /></button>
            </div>

            {/* Thumbnail picker */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: '8px' }}>Thumbnail <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
              <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) { setCropSrc(URL.createObjectURL(f)); } e.target.value = ''; }} />
              <div
                onClick={() => imageInputRef.current?.click()}
                style={{ aspectRatio: '4/3', borderRadius: '10px', border: '2px dashed rgba(255,255,255,0.2)', cursor: 'pointer', overflow: 'hidden', background: pendingImageSrc ? `url(${pendingImageSrc}) center/cover` : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'border-color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--t-primary)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
              >
                {!pendingImageSrc && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.35)' }}>
                    <Image style={{ width: '28px' }} />
                    <span style={{ fontSize: '12px' }}>Click to upload thumbnail</span>
                  </div>
                )}
              </div>
              {pendingImageSrc && (
                <button onClick={() => { setPendingImageSrc(null); setPendingImageBlob(null); }} style={{ marginTop: '6px', fontSize: '11px', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>Remove thumbnail</button>
              )}
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: '6px' }}>Name</label>
              <input autoFocus value={new_name} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }} placeholder="Club name..." style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--t-primary-10)', border: '1px solid var(--t-primary-30)', color: '#fff', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} onFocus={e => { e.currentTarget.style.borderColor = 'var(--t-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--t-primary-22)'; }} onBlur={e => { e.currentTarget.style.borderColor = 'var(--t-primary-30)'; e.currentTarget.style.boxShadow = 'none'; }} />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1.5px', display: 'block', marginBottom: '6px' }}>Description <span style={{ fontWeight: 400, textTransform: 'none' }}>(optional)</span></label>
              <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What is this club about?" rows={3} style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', background: 'var(--t-primary-10)', border: '1px solid var(--t-primary-30)', color: '#fff', fontSize: '14px', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} onFocus={e => { e.currentTarget.style.borderColor = 'var(--t-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--t-primary-22)'; }} onBlur={e => { e.currentTarget.style.borderColor = 'var(--t-primary-30)'; e.currentTarget.style.boxShadow = 'none'; }} />
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCreate(false)} style={{ padding: '8px 16px', borderRadius: '8px', background: 'var(--t-primary-15)', border: '1px solid var(--t-primary-35)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
              <button onClick={handleCreate} disabled={creating || !new_name.trim()} style={{ padding: '8px 20px', borderRadius: '8px', background: 'linear-gradient(180deg, var(--t-primary)99, var(--t-primary)55)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: (!new_name.trim() || creating) ? 0.5 : 1 }}>
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crop modal for thumbnail */}
      {cropSrc && (
        <ImageCropModal
          src={cropSrc}
          shape="rect"
          aspectRatio={16 / 9}
          onApply={handleCropApply}
          onCancel={() => { if (cropSrc.startsWith('blob:')) URL.revokeObjectURL(cropSrc); setCropSrc(null); }}
        />
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
          {query.length > 0 ? `No clubs found for "${query}"` : 'No clubs yet. Be the first to create one!'}
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(130px, 1fr))' : 'repeat(auto-fill, 220px)', gap: '14px' }}>
          {filtered.map((club) => (
            <div
              key={club.id}
              onClick={() => navigate(`/clubs/${club.id}`)}
              style={{ cursor: 'pointer', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--t-primary-25)', background: 'linear-gradient(180deg, var(--t-primary-18) 0%, var(--t-primary-10) 100%)', backdropFilter: 'blur(16px)', boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 var(--t-primary-20)', transition: 'transform 0.15s, box-shadow 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(0,0,0,0.45)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)'; }}
            >
              {/* Thumbnail */}
              <div style={{ aspectRatio: '16/9', background: club.image_url ? `url(${club.image_url}) center/cover` : clubGradient(club.name), position: 'relative' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 100%)', pointerEvents: 'none' }} />
                {!club.image_url && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users style={{ width: '28px', color: 'rgba(255,255,255,0.25)' }} />
                  </div>
                )}
              </div>
              {/* Info */}
              <div style={{ padding: '14px 16px 16px' }}>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{club.name}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Users style={{ width: '12px' }} /> {club.member_count} members
                </div>
                {club.description && (
                  <div style={{ marginTop: '10px', fontSize: '16px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{club.description}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filtered.map((club) => (
            <GlassCard key={club.id} onClick={() => navigate(`/clubs/${club.id}`)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: club.image_url ? `url(${club.image_url}) center/cover` : clubGradient(club.name), border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                  {!club.image_url && <Users style={{ width: '20px', color: 'rgba(255,255,255,0.5)' }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{club.name}</div>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{club.member_count} members{club.description ? ` · ${club.description}` : ''}</div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
