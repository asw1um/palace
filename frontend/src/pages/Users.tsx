import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LayoutGrid, List } from 'lucide-react';
import { getUsers } from '@/api/users';
import { GlassCard } from '@/components/GlassBox';
import type { User } from '@/types/api';
import { useIsMobile } from '@/hooks/use-mobile';

function userBannerGradient(nickname: string) {
  const hash = nickname.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hues = [210, 230, 200, 250, 190, 240, 220, 180];
  const hue1 = hues[hash % hues.length];
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 50%, 35%), hsl(${hue2}, 45%, 25%))`;
}

function userGradient(nickname: string) {
  const hash = nickname.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hues = [200, 220, 240, 180, 260, 210, 230, 190];
  const hue1 = hues[hash % hues.length];
  const hue2 = (hue1 + 40) % 360;
  return `radial-gradient(circle at 30% 30%, hsl(${hue1}, 65%, 58%), hsl(${hue2}, 50%, 28%))`;
}


export default function Users() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [query, setQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getUsers();
        if (!cancelled) setUsers(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    // Re-fetch when profile is saved so bio/avatar reflect immediately
    const refresh = () => { getUsers().then(data => { if (!cancelled) setUsers(data); }).catch(() => {}); };
    window.addEventListener('settingschange', refresh);
    return () => { cancelled = true; window.removeEventListener('settingschange', refresh); };
  }, []);

  const filtered = query.length > 0
    ? users.filter(u => (u.nickname ?? u.username ?? '').toLowerCase().includes(query.toLowerCase()))
    : users;

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingRight: '8px' }}>
      {/* Header: title left, search + toggle right */}
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '16px' }}>
        <h1 style={{ fontSize: '36px', fontWeight: 700, color: '#fff', letterSpacing: '3px', textTransform: 'uppercase', textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>Users</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: isMobile ? '100%' : '320px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '10px', padding: '10px 16px', backdropFilter: 'blur(8px)', boxShadow: '0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
            <Search style={{ width: '16px', color: 'rgba(255,255,255,0.7)', flexShrink: 0 }} />
            <input style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '14px', fontFamily: 'inherit', width: '100%', caretColor: 'var(--t-primary)', textShadow: '0 1px 3px rgba(0,0,0,0.4)' }} placeholder="Search users..." value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <div style={{ display: 'flex', flexShrink: 0, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', overflow: 'hidden' }}>
            <button onClick={() => setViewMode('grid')} style={{ padding: '10px 12px', background: viewMode === 'grid' ? 'var(--t-primary-25)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}>
              <LayoutGrid style={{ width: '16px', color: viewMode === 'grid' ? 'var(--t-primary)' : 'rgba(255,255,255,0.4)' }} />
            </button>
            <button onClick={() => setViewMode('list')} style={{ padding: '10px 12px', background: viewMode === 'list' ? 'var(--t-primary-25)' : 'transparent', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'background 0.15s' }}>
              <List style={{ width: '16px', color: viewMode === 'list' ? 'var(--t-primary)' : 'rgba(255,255,255,0.4)' }} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
          {query.length > 0 ? `No users found for "${query}"` : 'No users yet'}
        </div>
      ) : viewMode === 'grid' ? (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(auto-fill, minmax(120px, 1fr))' : 'repeat(4, 1fr)', gap: '14px' }}>
          {filtered.map(u => {
            const display_name = u.nickname || u.username || 'User';
            return (
              <div
                key={u.id}
                onClick={() => navigate(`/profile/${u.username}`)}
                style={{ cursor: 'pointer', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--t-primary-25)', background: 'linear-gradient(180deg, var(--t-primary-18) 0%, var(--t-primary-10) 100%)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)', transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 10px 28px rgba(0,0,0,0.45)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)'; }}
              >
                {/* Banner */}
                <div style={{ aspectRatio: '3/1', background: u.banner ? `url(${u.banner}) center/cover` : userBannerGradient(display_name), position: 'relative', flexShrink: 0 }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.3) 100%)', pointerEvents: 'none' }} />
                </div>

                {/* Avatar — no border, box-shadow only so no semi-transparent ring straddles the banner boundary */}
                <div style={{ padding: '0 14px', marginTop: '-42px', marginBottom: '8px', position: 'relative', zIndex: 1 }}>
                  {u.profile_picture ? (
                    <img src={u.profile_picture} alt="avatar" style={{ width: '84px', height: '84px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 0 0 4px rgba(255,255,255,0.12), 0 4px 14px rgba(0,0,0,0.6)', display: 'block' }} />
                  ) : (
                    <div style={{ width: '84px', height: '84px', borderRadius: '50%', background: userGradient(display_name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 700, color: '#fff', boxShadow: '0 0 0 4px rgba(255,255,255,0.12), 0 4px 14px rgba(0,0,0,0.6)' }}>
                      {display_name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding: '0 14px 14px' }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{display_name}</div>
                  <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{u.username || u.nickname || 'user'}</div>
                  {u.bio ? (
                    <div style={{ marginTop: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>
                      {u.bio}
                    </div>
                  ) : (
                    <div style={{ marginTop: '10px', fontSize: '12px', color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>No bio yet</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {filtered.map(u => {
            const display_name = u.nickname || u.username || 'User';
            return (
              <GlassCard key={u.id} onClick={() => navigate(`/profile/${u.username}`)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {u.profile_picture ? (
                    <img src={u.profile_picture} alt="avatar" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.15)' }} />
                  ) : (
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: userGradient(display_name), border: '2px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {display_name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{display_name}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>@{u.username || u.nickname || 'user'}</div>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
