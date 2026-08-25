import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  Activity as ActivityIcon, Bell, Compass, Home, ListVideo, LogOut,
  Palette, Search, Settings as Cog, User, Users,
} from '@/lib/icons';
import { notifications as notificationsApi, discover } from '@/data/api';
import type { Notification } from '@/data/types';
import { useAuth } from '@/data/AuthContext';
import { isDemo } from '@/data/client';
import { useBus } from '@/lib/bus';
import { useMediaQuery } from '@/lib/hooks';
import { Avatar, Chip } from './ui/Bits';
import { Menu, MenuItem, MenuLabel, MenuSep, useContextMenu } from './ui/Menu';
import { CommandPalette } from './CommandPalette';
import { NotificationsMenu } from './NotificationsMenu';
import { ThemeQuickPanel } from './ThemeStudio';
import { SearchBar, type SearchResult } from './SearchBar';
import { useAppData } from './AppData';

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { openMedia } = useAppData();
  const router = useRouter();
  const pathname = usePathname();

  const [palette, setPalette] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [themePanel, setThemePanel] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const isMobile = useMediaQuery('(max-width: 860px)');

  const userMenu = useContextMenu();
  const notifMenu = useContextMenu();

  /** Active-tab detection: exact for `end` routes, prefix match for the rest. */
  const isActive = (to: string, end?: boolean): boolean =>
    end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`);

  /* --- notifications -------------------------------------------------- */
  const loadNotifications = useCallback(() => {
    notificationsApi
      .all()
      .then((rows) => {
        setNotifications(rows);
        setUnread(rows.filter((n) => !n.is_read).length);
      })
      .catch(() => {});
  }, []);
  useEffect(loadNotifications, [loadNotifications]);
  useBus(['notifications'], loadNotifications);

  /* --- ⌘K ------------------------------------------------------------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
      if (e.key === '/' && !/input|textarea/i.test((e.target as HTMLElement)?.tagName ?? '')) {
        e.preventDefault();
        setPalette(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  /* --- search --------------------------------------------------------- */
  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    const res = await discover.search(q).catch(() => []);
    setSearchResults(
      res.slice(0, 10).map((r) => ({
        id: r.id,
        title: r.title,
        type: (r.media_type === 'tv' ? 'Series' : 'Film') as 'Film' | 'Series',
        thumb: r.poster_url ?? null,
      })),
    );
  }, []);

  const handleSearchOpen = useCallback((r: SearchResult) => {
    openMedia({
      tmdb_id: r.id,
      media_type: r.type === 'Series' ? 'tv' : 'movie',
      title: r.title,
      poster_url: r.thumb ?? null,
    });
  }, [openMedia]);

  const nav = [
    { to: '/', label: 'Home', icon: <Home size={16} />, end: true },
    { to: '/discover', label: 'Discover', icon: <Compass size={16} />, end: false },
    { to: '/lists', label: 'My Lists', icon: <ListVideo size={16} />, end: false },
    { to: '/clubs', label: 'Clubs', icon: <Users size={16} />, end: false },
    { to: '/people', label: 'People', icon: <User size={16} />, end: false },
    { to: '/activity', label: 'Activity', icon: <ActivityIcon size={16} />, end: false },
    { to: '/notifications', label: 'Notifications', icon: <Bell size={16} />, end: false, badge: unread },
    { to: '/settings', label: 'Settings', icon: <Cog size={16} />, end: false },
  ];

  return (
    <>
      <div className="shell">
        <header className="topbar">
          <div className="topbar__inner">
            {/* Logo */}
            <button
              className="brand"
              onClick={() => router.push('/')}
              aria-label="Go to home"
            >
              <div className="brand__mark">
                <svg width="16" height="16" viewBox="0 0 64 64" fill="none">
                  <path d="M14 44V26l9 7 9-13 9 13 9-7v18a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3Z" fill="currentColor" />
                </svg>
              </div>
              <span className="brand__word">Palace</span>
              {isDemo() && <Chip tone="warning" style={{ fontSize: 'var(--text-xs)' }}>Demo</Chip>}
            </button>

            {/* Desktop top tabs */}
            {!isMobile && (
              <nav className="topbar__nav" aria-label="Main navigation">
                {nav.map((n) => (
                  <Link
                    key={n.to}
                    href={n.to}
                    className={`topbar__tab ${isActive(n.to, n.end) ? 'is-active' : ''}`}
                  >
                    {n.label}
                    {!!n.badge && <span className="nav-item__badge">{n.badge}</span>}
                  </Link>
                ))}
              </nav>
            )}

            {/* Right side */}
            <div className="topbar__right">
              {!isMobile && (
                <SearchBar
                  results={searchResults}
                  onSearch={handleSearch}
                  onOpen={handleSearchOpen}
                />
              )}

              <button
                className="topbar__icon-btn"
                aria-label="Theme options"
                onClick={() => setThemePanel(true)}
              >
                <Palette size={16} />
              </button>

              <button
                className="topbar__icon-btn"
                aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
                aria-haspopup="menu"
                aria-expanded={notifMenu.open}
                style={{ position: 'relative' }}
                onClick={(e) => notifMenu.openFrom(e.currentTarget, 'end')}
              >
                <Bell size={16} />
                {unread > 0 && <span className="dot" aria-hidden="true" />}
              </button>

              <button
                className="topbar__avatar-btn"
                onClick={(e) => userMenu.openFrom(e.currentTarget, 'end')}
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={userMenu.open}
              >
                <Avatar src={user?.profile_picture} name={user?.nickname ?? user?.username} size={28} />
              </button>
            </div>
          </div>
        </header>

        <main className="main">
          <div className="page-wrap">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile: fixed bottom tab bar */}
      {isMobile && (
        <nav className="mobile-bar" aria-label="Mobile navigation">
          <div className="mobile-bar__inner">
            {[nav[0], nav[1], nav[2], nav[3]].map((n) => (
              <Link
                key={n.to}
                href={n.to}
                className={`mobile-tab ${isActive(n.to, n.end) ? 'is-active' : ''}`}
              >
                {n.icon}
                <span>{n.label.split(' ')[0]}</span>
              </Link>
            ))}
            <button
              className="mobile-tab"
              aria-label="Search"
              onClick={() => setPalette(true)}
            >
              <Search size={18} />
              <span>Search</span>
            </button>
          </div>
        </nav>
      )}

      {/* User menu */}
      <Menu open={userMenu.open} at={userMenu.at} onClose={userMenu.close} width={210}>
        <MenuLabel>{user?.nickname ?? 'Account'}</MenuLabel>
        <MenuItem
          icon={<User size={15} />}
          onClick={() => { userMenu.close(); router.push(`/profile/${user?.username}`); }}
        >
          My profile
        </MenuItem>
        <MenuItem icon={<Cog size={15} />} onClick={() => { userMenu.close(); router.push('/settings'); }}>
          Settings
        </MenuItem>
        <MenuItem icon={<Palette size={15} />} onClick={() => { userMenu.close(); setThemePanel(true); }}>
          Appearance
        </MenuItem>
        <MenuSep />
        <MenuItem icon={<LogOut size={15} />} danger onClick={() => { userMenu.close(); logout(); }}>
          Sign out
        </MenuItem>
      </Menu>

      <NotificationsMenu
        open={notifMenu.open}
        at={notifMenu.at}
        onClose={notifMenu.close}
        rows={notifications}
        onChanged={loadNotifications}
      />

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <ThemeQuickPanel open={themePanel} onClose={() => setThemePanel(false)} />
    </>
  );
}
