import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/data/ThemeContext';
import { get_lists_with_movies } from '@/api/lists';
import { get_clubs } from '@/api/clubs';
import type { List as ListType, Club } from '@/types/api';
import {useIsMobile} from '@/hooks/use-mobile';
import OceanBackground from './OceanBackground';

const VERSION = '0.9.0';

const TZ_ABBR = new Date()
  .toLocaleTimeString('en-US', { timeZoneName: 'short' })
  .split(' ')
  .pop() ?? 'UTC';

function SidebarBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      borderRadius: '10px',
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.25)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
      background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 100%)',
      position: 'relative',
    }}>
      {/* Gloss */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '40px', background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 100%)', borderRadius: '10px 10px 0 0', pointerEvents: 'none' }} />
      {/* Title bar */}
      <div style={{
        padding: '7px 12px', fontSize: '11px', fontWeight: 700, color: '#fff',
        letterSpacing: '2px', textTransform: 'uppercase',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.1) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
        textShadow: '0 1px 3px rgba(0,0,0,0.3)',
        position: 'relative', zIndex: 1,
      }}>
        {title}
      </div>
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  );
}

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  

  const navItems = [
  { path: '/', label: 'Dashboard' },
  { path: user?.id ? `/profile/${user.username}` : '/login', label: 'My Profile' },
  { path: '/lists', label: 'My Lists' },
  { path: '/clubs', label: 'Clubs' },
  { path: '/discover', label: 'Discover' },
  { path: '/users', label: 'Users' },
  { path: '/notifications', label: 'Notifications' },
  { path: '/settings', label: 'Settings' },
];




  const topBarItems = isMobile ? [] : navItems

  const { theme } = useTheme();
  const [clock, setClock] = useState('');
  const [timeFormat, setTimeFormat] = useState<'12' | '24'>(
    () => (localStorage.getItem('palace_time_format') as '12' | '24') ?? '24'
  );

  useEffect(() => {
    const handleFormatChange = () => {
      setTimeFormat((localStorage.getItem('palace_time_format') as '12' | '24') ?? '24');
    };
    window.addEventListener('palace-timeformat-changed', handleFormatChange);
    return () => window.removeEventListener('palace-timeformat-changed', handleFormatChange);
  }, []);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      if (timeFormat === '12') {
        const h = now.getHours();
        const m = now.getMinutes().toString().padStart(2, '0');
        const period = h >= 12 ? 'PM' : 'AM';
        const h12 = (h % 12 || 12).toString();
        setClock(`${h12}:${m} ${period}`);
      } else {
        const h = now.getHours().toString().padStart(2, '0');
        const m = now.getMinutes().toString().padStart(2, '0');
        setClock(`${h}:${m}`);
      }
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [timeFormat]);

  const [myLists, setMyLists] = useState<ListType[]>([]);
  const [myClubs, setMyClubs] = useState<Club[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [listsData, clubsData] = await Promise.all([
          get_lists_with_movies().catch(() => []),
          get_clubs().catch(() => ({ my_clubs: [] })),
        ]);
        if (!cancelled) {
          setMyLists(listsData);
          setMyClubs(clubsData.my_clubs || []);
        }
      } catch { /* ignore */ }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  // Separate effect so the listener survives StrictMode double-mount
  useEffect(() => {
    const refresh = () => {
      get_lists_with_movies().then(data => setMyLists(data)).catch(() => {});
    };
    window.addEventListener('palace-lists-changed', refresh);
    // Poll every 60s as a fallback in case events are missed
    const interval = setInterval(refresh, 60000);
    return () => {
      window.removeEventListener('palace-lists-changed', refresh);
      clearInterval(interval);
    };
  }, []);

  // Count unique titles across all lists by tmdb_id (avoids double-counting)
  const trackedCount = (() => {
    const seen = new Set<number>();
    myLists.forEach(l => {
      l.movies?.forEach(m => { if (m.tmdb_id) seen.add(m.tmdb_id); });
      l.shows?.forEach(s => { if (s.tmdb_id) seen.add(s.tmdb_id); });
    });
    return seen.size;
  })();
  const totalClubs = myClubs.length;

  const primary = 'var(--t-primary)';
  const glow25 = 'var(--t-primary-25)';
  const glow33 = 'var(--t-primary-33)';

  return (
    <>
      <OceanBackground />
     <div style={{ height: '100%', display: 'flex', fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: 'hidden', position: 'fixed', zIndex: 1 , boxSizing: 'border-box', width: '100%'}}>
        {/* LEFT SIDEBAR */}
          {isMobile && isSidebarOpen &&(
            <div
              onClick={() => setIsSidebarOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, backdropFilter: 'blur(4px)' }} 
            />
          )}
          <aside 
          style={{
            position: isMobile ? 'fixed' : 'relative',
            top: 0,
            left: isMobile ? (isSidebarOpen ? '0' : '-260px') : '0',
            width: '260px',
            height: '100%',
            zIndex: 101,
            backdropFilter: 'blur(12px)',
            transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            display: 'flex', flexDirection: 'column', gap: '10px',
            padding: '12px',
            overflowY: 'auto',
            boxShadow: isMobile ? '2px 0 15px themeColor' : 'none'
          }}>
          {/* MY PROFILE */}
          <SidebarBox title="My Profile">
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              {user?.profile_picture ? (
                <div className="avatar-circle" style={{ width: '72px', height: '72px', border: '3px solid rgba(255,255,255,0.35)', boxShadow: `0 2px 16px ${glow25}` }}>
                  <img src={user.profile_picture} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              ) : (
                <div style={{
                  width: '72px', height: '72px', borderRadius: '50%',
                  background: `linear-gradient(135deg, ${theme.primary}88, ${theme.primary}44)`,
                  border: '3px solid rgba(255,255,255,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px', fontWeight: 700, color: '#fff',
                  boxShadow: `0 2px 16px ${glow25}`,
                }}>
                  {(user?.nickname ?? '').slice(0, 2).toUpperCase()}
                </div>
              )}
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.3)' }}>{user?.nickname || 'Guest'}</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px' }}>MEMBER SINCE {user?.created_at ? new Date(user.created_at).getFullYear() : '2024'}</div>
              <div style={{ display: 'flex', width: '100%', marginTop: '6px', padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                {[
                  { label: 'TRACKED', value: trackedCount },
                  { label: 'LISTS', value: myLists.length },
                  { label: 'CLUBS', value: totalClubs },
                ].map(stat => (
                  <div key={stat.label} style={{ flex: 1, textAlign: 'center', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>{stat.value}</div>
                    <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.5)', letterSpacing: '1px' }}>{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </SidebarBox>

          {/* NAVIGATE */}
          <SidebarBox title="Navigate">
            <nav style={{ display: 'flex', flexDirection: 'column', padding: '6px', gap: '2px' }}>
              {navItems.map(item => {
                const myProfilePath = user?.id ? `/profile/${user.username}` : '';
                const isActive = location.pathname === item.path
                  || (item.path === '/clubs' && location.pathname.startsWith('/clubs'))
                  || (item.path === '/lists' && location.pathname.startsWith('/lists'))
                  || (item.path === '/users' && location.pathname.startsWith('/users') && location.pathname !== myProfilePath);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '6px 10px', fontSize: '12px', fontWeight: isActive ? 700 : 500,
                      borderRadius: '6px', border: 'none', cursor: 'pointer',
                      background: isActive
                        ? `linear-gradient(135deg, ${theme.primary}88, ${theme.primary}55)`
                        : 'transparent',
                      color: '#fff', fontFamily: 'inherit', textAlign: 'left',
                      letterSpacing: '0.5px',
                      boxShadow: isActive ? `0 2px 8px ${glow33}` : 'none',
                      transition: 'all 0.12s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: isActive ? theme.primary : 'rgba(255,255,255,0.35)',
                      boxShadow: isActive ? `0 0 6px ${theme.primary}` : 'none',
                      flexShrink: 0,
                      transition: 'all 0.2s',
                    }} />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </SidebarBox>

          {/* SITE INFO */}
          <SidebarBox title="Site Info">
            <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {[
                { k: 'UPDATED', v: '2026.05.19' },
                { k: 'STATUS', v: 'ONLINE', vColor: '#66cc88' },
                { k: 'VERSION', v: VERSION },
              ].map(row => (
                <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', letterSpacing: '1px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>{row.k}</span>
                  <span style={{ color: (row as { vColor?: string }).vColor || '#fff', fontWeight: 700, textTransform: 'uppercase' }}>{row.v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', letterSpacing: '1px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '5px', marginTop: '2px' }}>
                <span style={{ color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>TIME</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>{TZ_ABBR} {clock}</span>
              </div>
            </div>
          </SidebarBox>
        </aside>
      {/* MENU BUTTON - Pinned at top-left */}
        {isMobile && !isSidebarOpen && (
          <button 
            onClick={() => setIsSidebarOpen(true)}
            style={{
              position: 'fixed',
              top: '10px',
              left: '10px',
              zIndex: 90,
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              padding: '6px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
              fontSize: '12px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}
          >
            {/* Simple Icon */}
            <span style={{ fontSize: '16px' }}>☰</span>
            Menu
          </button>
        )}
        {/* MAIN CONTENT */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden', padding: isMobile ? '50px 8px 8px 8px ' : '12px 12px 12px 4px' , boxSizing: 'border-box', minWidth: 0 }}>
          <div style={{
            
            height:'100%', 
            flex: isMobile ? 'none' : '1',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.25)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.06) 100%)',
            position: 'relative',
            backdropFilter: 'blur(8px)',
            boxSizing: 'border-box',
          }}>
            {/* Gloss */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '80px', background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 100%)', borderRadius: '10px 10px 0 0', pointerEvents: 'none', zIndex: 0 }} />

            {/* TAB BAR */}
            <div style={{ display: 'flex', gap: '4px', flexShrink: 0, padding: '12px 16px 0', position: 'relative', zIndex: 1, borderBottom: '1px solid rgba(255,255,255,0.1)', overflowX: isMobile ? 'auto' : 'visible', WebkitOverflowScrolling: 'touch' , scrollbarWidth: 'none'}}>
              {topBarItems.map(item => {
                const myProfilePath = user?.username ? `/profile/${user.username}` : '';
                const isActive = location.pathname === item.path
                  || (item.path === '/clubs' && location.pathname.startsWith('/clubs'))
                  || (item.path === '/lists' && location.pathname.startsWith('/lists'))
                  || (item.path === '/users' && location.pathname.startsWith('/users') && location.pathname !== myProfilePath);
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    style={{
                      padding: '8px 18px', fontSize: '13px', fontWeight: isActive ? 700 : 500,
                      borderRadius: '6px 6px 0 0', border: 'none', cursor: 'pointer',
                      background: isActive
                        ? 'linear-gradient(180deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.18) 100%)'
                        : 'transparent',
                      color: isActive ? '#fff' : 'rgba(255,255,255,0.55)', fontFamily: 'inherit',
                      boxShadow: isActive ? `0 -2px 8px ${glow25}, inset 0 1px 0 rgba(255,255,255,0.25)` : 'none',
                      borderBottom: isActive ? `2px solid ${primary}` : '2px solid transparent',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; } }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; } }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div style={{ 
              flex: 1, 
              display: 'flex',          // Forces children to interact with the full height
              flexDirection: 'column',   // Keeps page elements stacking downward naturally
              overflowY: 'auto', 
              padding: isMobile ? '12px' : '20px', 
              position: 'relative', 
              zIndex: 1 
            }}>
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
