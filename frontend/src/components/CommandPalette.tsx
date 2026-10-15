import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import {
  Activity as ActivityIcon, Bell, Compass, CornerDownLeft, Film, Home, ListVideo,
  Palette, Search, Settings as Cog, Users,
} from '@/lib/icons';
import { discover } from '@/data/api';
import type { TMDBResult } from '@/data/types';
import { rank } from '@/lib/fuzzy';
import { titleCase } from '@/lib/format';
import { useDebounced } from '@/lib/hooks';
import { useTheme } from '@/theme/ThemeProvider';
import { PRESETS } from '@/theme/themeConfig';
import { useAppData } from './AppData';

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: ReactNode;
  run: () => void;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { lists, openMedia, openCreateList } = useAppData();
  const { set } = useTheme();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const [results, setResults] = useState<TMDBResult[]>([]);
  const debounced = useDebounced(query, 220);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
  }, [open]);

  useEffect(() => {
    if (!debounced.trim()) {
      setResults([]);
      return;
    }
    let alive = true;
    discover.search(debounced).then((r) => alive && setResults(r.slice(0, 6))).catch(() => {});
    return () => { alive = false; };
  }, [debounced]);

  const commands = useMemo<Cmd[]>(() => {
    const go = (path: string) => () => { router.push(path); onClose(); };
    const base: Cmd[] = [
      { id: 'home', label: 'Dashboard', group: 'Go to', icon: <Home size={15} />, run: go('/') },
      { id: 'lists', label: 'My lists', group: 'Go to', icon: <ListVideo size={15} />, run: go('/lists') },
      { id: 'discover', label: 'Discover', group: 'Go to', icon: <Compass size={15} />, run: go('/discover') },
      { id: 'clubs', label: 'Clubs', group: 'Go to', icon: <Users size={15} />, run: go('/clubs') },
      { id: 'people', label: 'People', group: 'Go to', icon: <Users size={15} />, run: go('/people') },
      { id: 'activity', label: 'Activity', group: 'Go to', icon: <ActivityIcon size={15} />, run: go('/activity') },
      { id: 'notifs', label: 'Notifications', group: 'Go to', icon: <Bell size={15} />, run: go('/notifications') },
      { id: 'settings', label: 'Settings', group: 'Go to', icon: <Cog size={15} />, run: go('/settings') },
      {
        id: 'new-list',
        label: 'Create a new list',
        group: 'Actions',
        icon: <ListVideo size={15} />,
        run: () => { openCreateList(); onClose(); },
      },
      ...PRESETS.map((p) => ({
        id: `theme-${p.id}`,
        label: `Theme: ${p.name}`,
        group: 'Appearance',
        icon: <Palette size={15} style={{ color: p.accent }} />,
        run: () => { set({ accent: p.accent, header: p.header }); onClose(); },
      })),
      ...lists.map((l) => ({
        id: `list-${l.id}`,
        label: titleCase(l.name),
        hint: `${(l.movie_count ?? 0) + (l.show_count ?? 0)} titles`,
        group: 'Your lists',
        icon: <ListVideo size={15} />,
        run: () => { router.push(`/lists/${l.id}`); onClose(); },
      })),
    ];
    return base;
  }, [router, onClose, lists, set, openCreateList]);

  const filtered = useMemo(() => {
    const cmds = rank(commands, query, (c) => `${c.group} ${c.label}`);
    const titles: Cmd[] = results.map((r) => ({
      id: `title-${r.id}`,
      label: r.title,
      hint: r.media_type === 'tv' ? 'Series' : 'Film',
      group: 'Titles',
      icon: <Film size={15} />,
      run: () => {
        openMedia({
          tmdb_id: r.id,
          media_type: r.media_type,
          title: r.title,
          poster_url: r.poster_url,
          release_date: r.release_date,
          rating: r.rating,
        });
        onClose();
      },
    }));
    return [...titles, ...cmds].slice(0, 40);
  }, [commands, query, results, openMedia, onClose]);

  useEffect(() => setCursor(0), [filtered.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(filtered.length - 1, c + 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        filtered[cursor]?.run();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, filtered, cursor, onClose]);

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  let lastGroup = '';

  return createPortal(
    <div className="cmdk" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmdk__panel" ref={panelRef} role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="cmdk__input">
          <Search size={18} />
          <input
            autoFocus
            value={query}
            placeholder="Search titles, jump to a page, change the theme…"
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd className="key">esc</kbd>
        </div>

        <div className="cmdk__list" ref={listRef}>
          {filtered.length === 0 && (
            <div className="empty" style={{ padding: 'var(--space-7)' }}>
              <p>Nothing matches “{query}”.</p>
            </div>
          )}
          {filtered.map((c, i) => {
            const header = c.group !== lastGroup ? c.group : null;
            lastGroup = c.group;
            return (
              <div key={c.id}>
                {header && <div className="menu__label">{header}</div>}
                <button
                  data-index={i}
                  className="menu__item"
                  data-active={i === cursor || undefined}
                  onMouseEnter={() => setCursor(i)}
                  onClick={c.run}
                >
                  {c.icon}
                  <span className="grow truncate">{c.label}</span>
                  {c.hint && <span className="faint" style={{ fontSize: 'var(--text-xs)' }}>{c.hint}</span>}
                  {i === cursor && <CornerDownLeft size={13} />}
                </button>
              </div>
            );
          })}
        </div>

        <div className="cmdk__foot">
          <span className="row gap-1">
            <kbd className="key">↑</kbd>
            <kbd className="key">↓</kbd> navigate
          </span>
          <span className="row gap-1">
            <kbd className="key">↵</kbd> select
          </span>
          <span className="row gap-1">
            <kbd className="key">esc</kbd> close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
