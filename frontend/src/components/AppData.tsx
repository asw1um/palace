import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Check, FolderPlus, Plus } from '@/lib/icons';
import {
  customMedia, lists as listsApi, progress as progressApi, type CustomMeta, type ProgressEntry,
  type WatchPosition,
} from '@/data/api';
import { countEpisodes, episodeKey, nextEpisode, type SeasonInfo } from '@/lib/episodes';
import type { List, MediaType } from '@/data/types';
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
      const mine = custom[`tv:${ref.tmdb_id}`]?.seasons;
      const total = mine
        ? countEpisodes(mine)
        : lists
            .flatMap((l) => l.items ?? [])
            .find((i) => i.tmdb_id === ref.tmdb_id)?.total_episodes ?? 0;
      const pct = total ? Math.min(100, Math.round((entry.episodes.length / total) * 100)) : 0;
      return { watched: entry.watched || pct >= 100, pct };
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

  const markWatched = useCallback(async (ref: TitleRef, watched: boolean, opts?: { silent?: boolean }) => {
    if (ref.media_type === 'movie') {
      await progressApi.setMovieWatched(ref.tmdb_id, watched, custom[`movie:${ref.tmdb_id}`]?.runtime);
    } else {
      // Marking a whole series watched fills in every episode.
      const seasons = seasonsFor(ref);
      if (seasons.length) await progressApi.setSeasons(ref.tmdb_id, seasons, watched);
    }
    if (!opts?.silent) {
      toast.success(watched ? `Marked ${ref.title} watched` : `Marked ${ref.title} unwatched`);
    }
    emit('progress');
    emit('lists');
  }, [custom, seasonsFor]);

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
      openMedia: setMedia,
      openAddTo: (ref: TitleRef | TitleRef[]) =>
        setAddTargets(Array.isArray(ref) ? (ref.length ? ref : null) : [ref]),
      openCreateList: (ref?: TitleRef) => setCreateFor(ref ?? null),
      quickAdd,
      markWatched,
      cascadeEpisodes,
      setCascadeEpisodes,
    }),
    [lists, loadingLists, refreshLists, progress, progressFor, custom, seasonsFor, nextFor, quickAdd, markWatched, cascadeEpisodes, setCascadeEpisodes],
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
  const { lists, openCreateList } = useAppData();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

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
              <span className="grow truncate">{titleCase(l.name)}</span>
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
