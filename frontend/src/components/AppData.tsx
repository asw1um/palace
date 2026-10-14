import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Check, FolderPlus, Plus } from '@/lib/icons';
import {
  clubs as clubsApi, customMedia, discover, lists as listsApi, progress as progressApi,
  type CustomMeta, type ProgressEntry, type WatchPosition,
} from '@/data/api';
import { useAuth } from '@/data/AuthContext';
import { episodeKey, nextEpisode, seriesProgress, type SeasonInfo } from '@/lib/episodes';
import type { Club, List, MediaType } from '@/data/types';
import { emit, useBus } from '@/lib/bus';
import { titleCase } from '@/lib/format';
import { useLocalState } from '@/lib/hooks';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Field, Input } from './ui/Field';
import { CheckBox, Chip, Empty } from './ui/Bits';
import { MediaModal } from './MediaModal';

export interface TitleRef {
  tmdb_id: number;
  media_type: MediaType;
  title: string;
  poster_url: string | null;
  release_date?: string;
  rating?: number;
}

interface AppDataCtx {
  lists: List[];
  loadingLists: boolean;
  refreshLists: () => void;
  progress: Record<string, ProgressEntry>;
  progressFor: (ref: { tmdb_id: number; media_type: MediaType }) => { watched: boolean; pct: number };
  /** Runtimes and season counts the user set themselves, keyed `"movie:123"` / `"tv:456"`. */
  custom: Record<string, CustomMeta>;
  /** Seasons for a series: the user's own counts when set, otherwise what the list item carries. */
  seasonsFor: (ref: { tmdb_id: number; seasons?: SeasonInfo[] }) => SeasonInfo[];
  /** Puts a title the user just finished into their Watched list, if the setting is on. */
  fileWatched: (ref: TitleRef) => Promise<void>;
  /** Puts a title the user just started into Currently Watching, unless a list already has it. */
  fileStarted: (ref: TitleRef) => Promise<void>;
  /** Where to resume a series, with minutes when they stopped partway. Null when caught up or unknown. */
  nextFor: (ref: { tmdb_id: number; seasons?: SeasonInfo[] }) => WatchPosition | null;
  openMedia: (ref: TitleRef) => void;
  /** Accepts one title or a whole selection. */
  openAddTo: (ref: TitleRef | TitleRef[]) => void;
  openCreateList: (ref?: TitleRef) => void;
  quickAdd: (ref: TitleRef) => Promise<void>;
  /** `silent` suppresses the toast so bulk callers can summarise instead. */
  markWatched: (ref: TitleRef, watched: boolean, opts?: { silent?: boolean }) => Promise<void>;
  /** Auto-complete earlier episodes when jumping ahead. — issue #42 */
  cascadeEpisodes: boolean;
  setCascadeEpisodes: (v: boolean) => void;
}

const Ctx = createContext<AppDataCtx | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [lists, setLists] = useState<List[]>([]);
  const [loadingLists, setLoading] = useState(true);
  const [progress, setProgress] = useState<Record<string, ProgressEntry>>({});
  const [custom, setCustom] = useState<Record<string, CustomMeta>>({});
  const [media, setMedia] = useState<TitleRef | null>(null);
  const [addTargets, setAddTargets] = useState<TitleRef[] | null>(null);
  const [createFor, setCreateFor] = useState<TitleRef | null | undefined>(undefined);
  const [cascadeEpisodes, setCascadeEpisodes] = useLocalState('palace.cascadeEpisodes', true);
  const inflight = useRef(false);

  const refreshLists = useCallback(() => {
    if (inflight.current) return;
    inflight.current = true;
    listsApi
      .all()
      .then(setLists)
      .catch(() => setLists([]))
      .finally(() => {
        inflight.current = false;
        setLoading(false);
      });
  }, []);

  const refreshProgress = useCallback(() => {
    progressApi.summary().then(setProgress).catch(() => {});
  }, []);

  const refreshCustom = useCallback(() => {
    customMedia.all().then(setCustom).catch(() => {});
  }, []);

  useEffect(() => {
    refreshLists();
    refreshProgress();
    refreshCustom();
  }, [refreshLists, refreshProgress, refreshCustom]);

  useBus(['lists'], refreshLists);
  useBus(['progress'], refreshProgress);
  useBus(['custom'], refreshCustom);

  const seasonsFor = useCallback(
    (ref: { tmdb_id: number; seasons?: SeasonInfo[] }) =>
      custom[`tv:${ref.tmdb_id}`]?.seasons ??
      ref.seasons ??
      lists.flatMap((l) => l.items ?? []).find((i) => i.tmdb_id === ref.tmdb_id && i.media_type === 'tv')?.seasons ??
      [],
    [custom, lists],
  );

  const nextFor = useCallback(
    (ref: { tmdb_id: number; seasons?: SeasonInfo[] }): WatchPosition | null => {
      const entry = progress[`tv:${ref.tmdb_id}`];
      const watched = new Set(entry?.episodes ?? []);
      const saved = entry?.position;
      if (saved && !watched.has(episodeKey(saved.season, saved.episode))) return saved;
      const next = nextEpisode(seasonsFor(ref), watched);
      return next ? { ...next, minutes: 0 } : null;
    },
    [progress, seasonsFor],
  );

  const progressFor = useCallback(
    (ref: { tmdb_id: number; media_type: MediaType }) => {
      const entry = progress[`${ref.media_type}:${ref.tmdb_id}`];
      if (!entry) return { watched: false, pct: 0 };
      if (ref.media_type === 'movie') {
        // Partway through a film shows as a partial bar, not as watched.
        const pct = entry.total
          ? Math.min(100, Math.round((entry.minutes / entry.total) * 100))
          : entry.watched ? 100 : 0;
        return { watched: entry.watched, pct };
      }
      const seasons =
        custom[`tv:${ref.tmdb_id}`]?.seasons ??
        lists.flatMap((l) => l.items ?? []).find((i) => i.tmdb_id === ref.tmdb_id && i.media_type === 'tv')?.seasons ??
        [];
      const { done, total } = seriesProgress(seasons, entry.episodes);
      const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
      return { watched: entry.watched || (total > 0 && done >= total), pct };
    },
    [progress, lists, custom],
  );

  const quickAdd = useCallback(
    async (ref: TitleRef) => {
      const target =
        lists.find((l) => /^want to watch$/i.test(l.name)) ?? lists[0];
      if (!target) {
        toast.error('Create a list first');
        return;
      }
      await listsApi.add(target.id, ref);
      toast.success(`Added to ${titleCase(target.name)}`);
      emit('lists');
    },
    [lists],
  );

  const fileWatched = useCallback(
    async (ref: TitleRef) => {
      if (!autoMoveEnabled()) return;
      const watchedList = lists.find((l) => /^watched$/i.test(l.name));
      if (!watchedList) return;
      if (watchedList.items?.some((i) => i.tmdb_id === ref.tmdb_id && i.media_type === ref.media_type)) return;
      await listsApi.add(watchedList.id, ref);
      toast.success(`Added ${ref.title} to Watched`);
      emit('lists');
    },
    [lists],
  );

  const fileStarted = useCallback(
    async (ref: TitleRef) => {
      if (!autoMoveEnabled()) return;
      const held = lists.some((l) => l.items?.some((i) => i.tmdb_id === ref.tmdb_id && i.media_type === ref.media_type));
      const watching = lists.find((l) => /^currently watching$/i.test(l.name));
      if (held || !watching) return;
      await listsApi.add(watching.id, ref);
      toast.success(`Added ${ref.title} to Currently Watching`);
      emit('lists');
    },
    [lists],
  );

  const markWatched = useCallback(async (ref: TitleRef, watched: boolean, opts?: { silent?: boolean }) => {
    if (ref.media_type === 'movie') {
      await progressApi.setMovieWatched(ref.tmdb_id, watched, custom[`movie:${ref.tmdb_id}`]?.runtime);
    } else {
      // Marking a whole series watched fills in every episode. A series that isn't in
      // any list yet has no season counts locally, so ask TMDB for them.
      let seasons = seasonsFor(ref);
      if (!seasons.length) {
        seasons = (await discover.details(ref.tmdb_id, 'tv').catch(() => null))?.seasons ?? [];
      }
      seasons = seasons.filter((s) => s.season_number > 0);
      if (!seasons.length) {
        toast.error(`No episode data for ${ref.title} yet, so it can't be marked`);
        return;
      }
      await progressApi.setSeasons(ref.tmdb_id, seasons, watched);
    }
    if (!opts?.silent) {
      toast.success(watched ? `Marked ${ref.title} watched` : `Marked ${ref.title} unwatched`);
    }
    emit('progress');
    emit('lists');
    if (watched) await fileWatched(ref);
  }, [custom, seasonsFor, fileWatched]);

  /* Finished titles leave "Want to watch" / "Currently watching" for "Watched".
     Controlled by the switch in Settings → Library. */
  const moving = useRef(new Set<string>());
  useEffect(() => {
    if (loadingLists || !autoMoveEnabled()) return;
    const watchedList = lists.find((l) => /^watched$/i.test(l.name));
    if (!watchedList) return;
    const finished = lists
      .filter((l) => /^(want to watch|currently watching)$/i.test(l.name))
      .flatMap((l) => (l.items ?? []).filter((i) => progressFor(i).watched).map((item) => ({ from: l, item })))
      .filter(({ from, item }) => !moving.current.has(`${from.id}:${item.id}`));
    if (!finished.length) return;
    finished.forEach(({ from, item }) => moving.current.add(`${from.id}:${item.id}`));

    (async () => {
      const moved: string[] = [];
      for (const { from, item } of finished) {
        try {
          const already = watchedList.items?.some(
            (i) => i.tmdb_id === item.tmdb_id && i.media_type === item.media_type,
          );
          if (!already) await listsApi.add(watchedList.id, item);
          await listsApi.removeItem(from.id, item.id);
          if (!moved.includes(item.title)) moved.push(item.title);
          // Done with this one; if it's added back and finished again it should move again.
          moving.current.delete(`${from.id}:${item.id}`);
        } catch {
          /* leave it where it is; it stays in `moving` so this doesn't loop */
        }
      }
      if (moved.length) {
        toast.success(
          moved.length === 1 ? `Moved ${moved[0]} to Watched` : `Moved ${moved.length} finished titles to Watched`,
        );
        emit('lists');
      }
    })();
  }, [lists, loadingLists, progressFor]);

  const value = useMemo<AppDataCtx>(
    () => ({
      lists,
      loadingLists,
      refreshLists,
      progress,
      progressFor,
      custom,
      seasonsFor,
      nextFor,
      fileWatched,
      fileStarted,
      openMedia: setMedia,
      openAddTo: (ref: TitleRef | TitleRef[]) =>
        setAddTargets(Array.isArray(ref) ? (ref.length ? ref : null) : [ref]),
      openCreateList: (ref?: TitleRef) => setCreateFor(ref ?? null),
      quickAdd,
      markWatched,
      cascadeEpisodes,
      setCascadeEpisodes,
    }),
    [lists, loadingLists, refreshLists, progress, progressFor, custom, seasonsFor, nextFor, fileWatched, fileStarted, quickAdd, markWatched, cascadeEpisodes, setCascadeEpisodes],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <MediaModal open={!!media} target={media} onClose={() => setMedia(null)} />
      <AddToListDialog targets={addTargets} onClose={() => setAddTargets(null)} />
      <CreateListDialog
        open={createFor !== undefined}
        seed={createFor ?? null}
        onClose={() => setCreateFor(undefined)}
      />
    </Ctx.Provider>
  );
}

/** The "Move finished titles to Watched" switch; on unless the user turned it off. */
function autoMoveEnabled(): boolean {
  try {
    return localStorage.getItem('palace.autoWatchedMove') !== 'false';
  } catch {
    return true;
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppData(): AppDataCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAppData must be used inside <AppDataProvider>');
  return ctx;
}

/* -------------------------------------------------------------------------- */
/* Add to list                                                                 */
/* -------------------------------------------------------------------------- */

function AddToListDialog({ targets, onClose }: { targets: TitleRef[] | null; onClose: () => void }) {
  const { lists: myLists, openCreateList } = useAppData();
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [clubs, setClubs] = useState<Club[]>([]);

  // Club lists the user is allowed to add to (admins, mods and helpers).
  useEffect(() => {
    if (!targets?.length) return;
    clubsApi
      .mineWithLists()
      .then((rows) =>
        setClubs(
          rows.filter(
            (c) =>
              !!user &&
              (c.admin_id === user.id || c.mod_ids?.includes(user.id) || c.helper_ids?.includes(user.id)),
          ),
        ),
      )
      .catch(() => setClubs([]));
  }, [targets?.length, user?.id]);

  const clubLists = useMemo(
    () => clubs.flatMap((c) => (c.lists ?? []).map((l) => ({ ...l, clubName: c.name }))),
    [clubs],
  );
  const lists = useMemo(() => [...myLists, ...clubLists], [myLists, clubLists]);

  const single = targets?.length === 1 ? targets[0] : null;
  const key = targets?.map((t) => t.tmdb_id).join(',') ?? '';

  /** Lists that already hold every one of the chosen titles. */
  const alreadyIn = useMemo(() => {
    if (!targets?.length) return new Set<number>();
    return new Set(
      lists
        .filter((l) => targets.every((t) => l.items?.some((i) => i.tmdb_id === t.tmdb_id)))
        .map((l) => l.id),
    );
  }, [lists, targets]);

  useEffect(() => {
    setSelected(new Set());
  }, [key]);

  const save = async () => {
    if (!targets?.length || !selected.size) return;
    setSaving(true);
    try {
      for (const id of selected) {
        for (const t of targets) await listsApi.add(id, t);
      }
      const what = targets.length > 1 ? `${targets.length} titles` : `“${targets[0].title}”`;
      toast.success(`Added ${what} to ${selected.size} list${selected.size > 1 ? 's' : ''}`);
      emit('lists');
      emit('clubs');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!targets?.length}
      onClose={onClose}
      title={single ? `Add “${single.title}”` : `Add ${targets?.length ?? 0} titles`}
      width={460}
      footer={
        <>
          <Button
            variant="ghost"
            icon={<FolderPlus size={15} />}
            onClick={() => {
              onClose();
              openCreateList(single ?? undefined);
            }}
          >
            New list
          </Button>
          <div className="grow" />
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!selected.size || saving} onClick={save}>
            Add to {selected.size || 0}
          </Button>
        </>
      }
    >
      {alreadyIn.size > 0 && (
        // Tell people when a title is already filed somewhere. — issue #50
        <div className="row gap-2" style={{ marginBottom: 'var(--sp-4)', color: 'var(--warning)' }}>
          <AlertTriangle size={16} />
          <span style={{ fontSize: 'var(--fs-12)' }}>
            {single ? 'Already in' : 'All of these are already in'}{' '}
            {[...alreadyIn].map((id) => titleCase(lists.find((l) => l.id === id)?.name ?? '')).join(', ')}
          </span>
        </div>
      )}

      <div className="stack gap-1">
        {lists.length === 0 && <Empty title="No lists yet" icon={<FolderPlus size={22} />} />}
        {lists.map((l) => {
          const has = alreadyIn.has(l.id);
          const checked = selected.has(l.id);
          return (
            <label key={l.id} className="list-row" style={{ cursor: has ? 'not-allowed' : 'pointer' }}>
              <CheckBox
                checked={checked || has}
                label={l.name}
                onChange={(v) => {
                  if (has) return;
                  setSelected((prev) => {
                    const next = new Set(prev);
                    if (v) next.add(l.id);
                    else next.delete(l.id);
                    return next;
                  });
                }}
              />
              <span className="grow truncate">
                {titleCase(l.name)}
                {'clubName' in l && <span className="faint"> · {(l as { clubName: string }).clubName}</span>}
              </span>
              {has ? (
                <Chip tone="success">
                  <Check size={12} /> In list
                </Chip>
              ) : (
                <span className="faint" style={{ fontSize: 'var(--fs-12)' }}>
                  {(l.movie_count ?? 0) + (l.show_count ?? 0)}
                </span>
              )}
            </label>
          );
        })}
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Create list                                                                 */
/* -------------------------------------------------------------------------- */

function CreateListDialog({
  open, seed, onClose,
}: { open: boolean; seed: TitleRef | null; onClose: () => void }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setName('');
  }, [open]);

  const submit = async () => {
    const clean = name.trim();
    if (!clean) return;
    setBusy(true);
    try {
      const created = await listsApi.create(clean);
      if (seed) await listsApi.add(created.id, seed);
      toast.success(seed ? `Created ${clean} with ${seed.title}` : `Created ${clean}`);
      emit('lists');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New list"
      width={420}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" icon={<Plus size={15} />} disabled={!name.trim() || busy} onClick={submit}>
            Create
          </Button>
        </>
      }
    >
      <Field
        label="List name"
        hint={seed ? `“${seed.title}” will be added straight away.` : 'You can rename it later.'}
      >
        <Input
          value={name}
          placeholder="Rainy Sunday"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </Field>
    </Modal>
  );
}
