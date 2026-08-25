import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity as ActivityIcon, Bell, Compass, Home, ListVideo, LogOut, Menu as MenuIcon,
  Moon, PanelLeftClose, PanelLeftOpen, Palette, Search, Settings as Cog, Sun, User,
  Users, X,
} from 'lucide-react';
import { notifications as notificationsApi } from '@/data/api';
import type { Notification } from '@/data/types';
import { useAuth } from '@/data/AuthContext';
import { isDemo } from '@/data/client';
import { useTheme } from '@/theme/ThemeProvider';
import { useBus } from '@/lib/bus';
import { useLocalState, useMediaQuery } from '@/lib/hooks';
import { clockString } from '@/lib/format';
import { moveRail, pageIn, revealOnScroll } from '@/lib/motion';
import { Avatar, Chip } from './ui/Bits';
import { Button } from './ui/Button';
import { Menu, MenuItem, MenuLabel, MenuSep, useContextMenu } from './ui/Menu';
import { CommandPalette } from './CommandPalette';
import { NotificationsMenu } from './NotificationsMenu';
import { ThemeQuickPanel } from './ThemeStudio';

interface NavDef {
  to: string;
  label: string;
  icon: ReactNode;
  group: string;
  badge?: number;
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { theme, set, mode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 860px)');

  const [collapsed, setCollapsed] = useLocalState('palace.sidebarCollapsed', false);
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [clock, setClock] = useState(() => clockString(new Date(), theme.timeFormat));
  const [themePanel, setThemePanel] = useState(false);

  const railRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const firstRail = useRef(true);
  const userMenu = useContextMenu();
  const notifMenu = useContextMenu();

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

  /* --- clock ---------------------------------------------------------- */
  useEffect(() => {
    const tick = () => setClock(clockString(new Date(), theme.timeFormat));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [theme.timeFormat]);

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

  const nav: NavDef[] = [
    { to: '/', label: 'Dashboard', icon: <Home size={18} />, group: 'Library' },
    { to: '/lists', label: 'My lists', icon: <ListVideo size={18} />, group: 'Library' },
    { to: '/discover', label: 'Discover', icon: <Compass size={18} />, group: 'Library' },
    { to: '/activity', label: 'Activity', icon: <ActivityIcon size={18} />, group: 'Library' },
    { to: '/clubs', label: 'Clubs', icon: <Users size={18} />, group: 'Social' },
    { to: '/people', label: 'People', icon: <User size={18} />, group: 'Social' },
    { to: '/notifications', label: 'Notifications', icon: <Bell size={18} />, group: 'Social', badge: unread },
  ];

  /* --- animated rail + page transition -------------------------------- */
  useLayoutEffect(() => {
    const active = navRef.current?.querySelector<HTMLElement>('.nav-item.is-active');
    moveRail(railRef.current, active ?? null, firstRail.current);
    firstRail.current = false;
  }, [location.pathname, collapsed, unread]);

  useEffect(() => {
    pageIn(pageRef.current);
    scrollRef.current?.scrollTo({ top: 0 });
    const cleanup = revealOnScroll(scrollRef.current, pageRef.current);
    return cleanup;
  }, [location.pathname]);

  useEffect(() => setDrawer(false), [location.pathname]);

  const sidebarBody = (
    <>
      <div className="sidebar__brand">
        <div className="brand__mark">
          <svg width="18" height="18" viewBox="0 0 64 64" fill="none">
            <path d="M14 44V26l9 7 9-13 9 13 9-7v18a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3Z" fill="currentColor" />
          </svg>
        </div>
        <div className="brand__text">
          <div className="brand__word">Palace</div>
          <div className="brand__sub">{isDemo() ? 'demo mode' : 'connected'}</div>
        </div>
        {!isMobile && (
          <Button
            variant="ghost"
            size="sm"
            className="sidebar__label"
            style={{ marginLeft: 'auto' }}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed(!collapsed)}
          >
            <PanelLeftClose size={16} />
          </Button>
        )}
      </div>

      <nav className="sidebar__nav" ref={navRef} style={{ position: 'relative' }}>
        <div className="nav-rail" ref={railRef} style={{ opacity: 0 }} />
        {['Library', 'Social'].map((group) => (
          <div key={group}>
            <div className="nav-group__label">{group}</div>
            {nav
              .filter((n) => n.group === group)
              .map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === '/'}
                  className={({ isActive }) => `nav-item ${isActive ? 'is-active' : ''}`}
                  title={collapsed ? n.label : undefined}
                >
                  {n.icon}
                  <span className="sidebar__label grow">{n.label}</span>
                  {!!n.badge && <span className="nav-item__badge">{n.badge}</span>}
                </NavLink>
              ))}
          </div>
        ))}
      </nav>

      <div className="sidebar__foot">
        {collapsed && !isMobile && (
          <Button variant="ghost" size="sm" aria-label="Expand sidebar" onClick={() => setCollapsed(false)}>
            <PanelLeftOpen size={16} />
          </Button>
        )}
        <button
          className="user-chip"
          onClick={(e) => userMenu.openFrom(e.currentTarget)}
          aria-label="Account menu"
        >
          <Avatar src={user?.profile_picture} name={user?.nickname ?? user?.username} size={32} />
          <div className="user-chip__text grow" style={{ textAlign: 'left', minWidth: 0 }}>
            <div className="user-chip__name">{user?.nickname ?? user?.username ?? 'Guest'}</div>
            <div className="user-chip__meta">@{user?.username ?? 'guest'}</div>
          </div>
        </button>
      </div>
    </>
  );

  return (
    <>
      <div className="shell" data-collapsed={collapsed && !isMobile}>
        {!isMobile && <aside className="sidebar">{sidebarBody}</aside>}

        <div className="main">
          <header className="topbar">
            {isMobile && (
              <Button variant="ghost" aria-label="Open menu" onClick={() => setDrawer(true)}>
                <MenuIcon size={18} />
              </Button>
            )}

            <button className="searchbar grow" onClick={() => setPalette(true)}>
              <Search size={16} />
              <span className="truncate">Search titles, lists, people…</span>
              <span className="searchbar__kbd sidebar__label">
                <kbd className="key">⌘</kbd>
                <kbd className="key">K</kbd>
              </span>
            </button>

            <div className="row gap-2" style={{ marginLeft: 'auto' }}>
              {isDemo() && (
                <Chip tone="warning" className="sidebar__label">
                  Demo data
                </Chip>
              )}
              <span className="mono faint sidebar__label" style={{ fontSize: 'var(--fs-12)' }}>
                {clock}
              </span>
              <Button
                variant="ghost"
                aria-label="Toggle colour mode"
                onClick={() => set({ mode: mode === 'light' ? 'dark' : 'light' })}
              >
                {mode === 'light' ? <Moon size={17} /> : <Sun size={17} />}
              </Button>
              <Button variant="ghost" aria-label="Theme options" onClick={() => setThemePanel(true)}>
                <Palette size={17} />
              </Button>
              <Button
                variant="ghost"
                aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
                aria-haspopup="menu"
                aria-expanded={notifMenu.open}
                onClick={(e) => notifMenu.openFrom(e.currentTarget, 'end')}
                style={{ position: 'relative' }}
              >
                <Bell size={17} />
                {unread > 0 && (
                  <span
                    className="dot dot--pulse"
                    style={{ position: 'absolute', top: 8, right: 8, color: 'var(--accent)' }}
                  />
                )}
              </Button>
            </div>
          </header>

          <div className="scroller" ref={scrollRef}>
            <div className="page" ref={pageRef}>
              <Outlet />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: bottom tab bar + slide-in drawer (#118) */}
      {isMobile && (
        <nav className="mobile-bar">
          <div className="mobile-bar__inner">
            {[nav[0], nav[1], nav[2], nav[4], nav[6]].map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) => `mobile-tab ${isActive ? 'is-active' : ''}`}
              >
                {n.icon}
                {n.label.split(' ')[0]}
              </NavLink>
            ))}
          </div>
        </nav>
      )}

      {isMobile && drawer && (
        <>
          <div
            className="overlay"
            style={{ background: 'var(--scrim)', display: 'block', padding: 0 }}
            onClick={() => setDrawer(false)}
          />
          <aside className="drawer anim-slide-left" style={{ padding: 'var(--sp-4) var(--sp-3)' }}>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Close menu"
              style={{ position: 'absolute', top: 10, right: 10 }}
              onClick={() => setDrawer(false)}
            >
              <X size={16} />
            </Button>
            {sidebarBody}
          </aside>
        </>
      )}

      <Menu open={userMenu.open} at={userMenu.at} onClose={userMenu.close} width={210}>
        <MenuLabel>{user?.nickname ?? 'Account'}</MenuLabel>
        <MenuItem
          icon={<User size={15} />}
          onClick={() => { userMenu.close(); navigate(`/profile/${user?.username}`); }}
        >
          My profile
        </MenuItem>
        <MenuItem icon={<Cog size={15} />} onClick={() => { userMenu.close(); navigate('/settings'); }}>
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
