import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Check, Eye, GripVertical, LayoutGrid, ListPlus, Pencil, Plus, Rows3, Search,
  Trash2,
} from '@/lib/icons';
import { toast } from 'sonner';
import { lists as listsApi } from '@/data/api';
import type { List, ListItem } from '@/data/types';
import { useAppData } from '@/components/AppData';
import { Poster } from '@/components/Poster';
import { Button } from '@/components/ui/Button';
import { Input, SearchInput, Segmented, Select } from '@/components/ui/Field';
import { CheckBox, Chip, Empty, ProgressBar, Skeleton } from '@/components/ui/Bits';
import { useConfirm } from '@/components/ui/Modal';
import { emit } from '@/lib/bus';
import { plural, timeAgo, titleCase, year } from '@/lib/format';
import { rank } from '@/lib/fuzzy';
import { useLocalState } from '@/lib/hooks';

type Sort = 'manual' | 'az' | 'za' | 'added' | 'year' | 'progress';
type View = 'grid' | 'rows';

export default function ListDetail() {
  const { id } = useParams();
  const listId = Number(id);
  const router = useRouter();
  const confirm = useConfirm();
  const { progressFor, openAddTo, openMedia, markWatched } = useAppData();

  const [list, setList] = useState<List | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useLocalState<Sort>('palace.itemSort', 'manual');
  const [view, setView] = useLocalState<View>('palace.itemView', 'grid');
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');
  const dragId = useRef<number | null>(null);

  const load = () => {
    setLoading(true);
    listsApi
      .one(listId)
      .then(setList)
      .catch(() => setList(null))
      .finally(() => setLoading(false));
  };

  useEffect(load, [listId]);

  const items = useMemo(() => {
    let rows = [...(list?.items ?? [])];
    if (query.trim()) rows = rank(rows, query, (i) => i.title);
    switch (sort) {
      case 'az': rows.sort((a, b) => a.title.localeCompare(b.title)); break;
      case 'za': rows.sort((a, b) => b.title.localeCompare(a.title)); break;
      case 'added': rows.sort((a, b) => (b.added_at ?? '').localeCompare(a.added_at ?? '')); break;
      case 'year': rows.sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? '')); break;
      case 'progress':
        rows.sort((a, b) => progressFor(b).pct - progressFor(a).pct);
        break;
      default: break;
    }
    return rows;
  }, [list, query, sort, progressFor]);

  const onDrop = (targetId: number) => {
    const from = dragId.current;
    dragId.current = null;
    if (!from || from === targetId || !list) return;
    const ids = items.map((i) => i.id);
    const next = ids.filter((x) => x !== from);
    next.splice(ids.indexOf(targetId), 0, from);
    listsApi.reorderItems(list.id, next);
    setSort('manual');
    load();
  };

  /* --- edit mode -------------------------------------------------------- */
  const toggleSelected = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const chosen = items.filter((i) => selected.has(i.id));
  const allSelected = items.length > 0 && selected.size === items.length;

  const bulkMarkWatched = async () => {
    const count = chosen.length;
    for (const item of chosen) await markWatched(item, true, { silent: true });
    toast.success(`Marked ${plural(count, 'title')} watched`);
    setSelected(new Set());
    load();
  };

  const bulkRemove = async () => {
    if (!list) return;
    const ok = await confirm({
      title: `Remove ${plural(chosen.length, 'title')}?`,
      message: `They will be taken out of ${titleCase(list.name)}. Your other lists keep them.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    for (const item of chosen) await listsApi.removeItem(list.id, item.id);
    toast.success(`Removed ${plural(chosen.length, 'title')}`);
    setSelected(new Set());
    load();
    emit('lists');
  };

  const removeItem = async (item: ListItem) => {
    if (!list) return;
    const ok = await confirm({
      title: `Remove "${item.title}"?`,
      message: `It will be taken out of ${titleCase(list.name)}.`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!ok) return;
    await listsApi.removeItem(list.id, item.id);
    toast.success('Removed');
    load();
    emit('lists');
  };

  const rename = async () => {
    const clean = draft.trim();
    setRenaming(false);
    if (!list || !clean || clean === list.name) return;
    await listsApi.rename(list.id, clean);
    toast.success('List renamed');
    load();
    emit('lists');
  };

  if (loading && !list) {
    return (
      <div className="stack gap-4">
        <Skeleton h={38} w={260} />
        <div className="grid grid--posters">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton" style={{ aspectRatio: '2/3' }} />
          ))}
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <Empty title="List not found" action={<Button onClick={() => router.push('/lists')}>Back to lists</Button>} />
    );
  }

  const total = items.length;
  const watched = items.filter((i) => progressFor(i).watched).length;

  return (
    <>
      <header className="page-head">
        <div className="stack gap-2">
          <button className="row gap-2 faint" style={{ fontSize: 'var(--text-xs)' }} onClick={() => router.push('/lists')}>
            <ArrowLeft size={14} /> All lists
          </button>
          {renaming ? (
            <Input
              autoFocus
              value={draft}
              style={{ fontSize: 'var(--text-xl)', height: 44 }}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={rename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') rename();
                if (e.key === 'Escape') setRenaming(false);
              }}
            />
          ) : (
            <h1 className="row gap-3">
              {titleCase(list.name)}
              <Button
                variant="ghost"
                size="sm"
                aria-label="Rename list"
                onClick={() => { setDraft(list.name); setRenaming(true); }}
              >
                <Pencil size={15} />
              </Button>
            </h1>
          )}
          <div className="row gap-2 wrap">
            <Chip>{list.movie_count ?? 0} films</Chip>
            <Chip>{list.show_count ?? 0} series</Chip>
            {watched > 0 && (
              <Chip tone="success">
                <Check size={12} /> {watched} watched
              </Chip>
            )}
          </div>
        </div>

        <div className="page-head__actions">
          <Segmented<View>
            ariaLabel="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'grid', label: 'Grid', icon: <LayoutGrid /> },
              { value: 'rows', label: 'Rows', icon: <Rows3 /> },
            ]}
          />
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ width: 165 }}>
            <option value="manual">Manual order</option>
            <option value="added">Recently added</option>
            <option value="az">Title A – Z</option>
            <option value="za">Title Z – A</option>
            <option value="year">Release year</option>
            <option value="progress">Progress</option>
          </Select>
          <Button
            variant={editing ? 'soft' : 'default'}
            icon={editing ? <Check size={15} /> : <Pencil size={15} />}
            onClick={() => {
              setEditing((e) => !e);
              setSelected(new Set());
            }}
          >
            {editing ? 'Done' : 'Edit'}
          </Button>
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => router.push('/discover')}>
            Add titles
          </Button>
        </div>
      </header>

      {total > 0 && (
        <div className="stack gap-2">
          <div className="row between faint" style={{ fontSize: 'var(--text-xs)' }}>
            <span>
              {watched} of {total} watched
            </span>
            <span>{Math.round((watched / total) * 100)}%</span>
          </div>
          <ProgressBar value={(watched / total) * 100} label="List progress" />
        </div>
      )}

      {editing ? (
        <div className="bulk-bar">
          <CheckBox
            checked={allSelected}
            label={allSelected ? 'Clear selection' : 'Select all'}
            onChange={() => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)))}
          />
          <span className="grow truncate" style={{ fontSize: 'var(--text-sm)' }}>
            {selected.size ? (
              <strong>{plural(selected.size, 'title')} selected</strong>
            ) : (
              <span className="muted">Tap titles to select them, or drag a poster to reorder.</span>
            )}
          </span>
          <div className="row gap-2 wrap">
            <Button
              size="sm"
              icon={<ListPlus size={14} />}
              disabled={!selected.size}
              onClick={() => openAddTo(chosen)}
            >
              Add to list
            </Button>
            <Button
              size="sm"
              icon={<Eye size={14} />}
              disabled={!selected.size}
              onClick={bulkMarkWatched}
            >
              Mark watched
            </Button>
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 size={14} />}
              disabled={!selected.size}
              onClick={bulkRemove}
            >
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="row gap-3 wrap">
          <div style={{ flex: '1 1 280px' }}>
            <SearchInput
              icon={<Search />}
              value={query}
              placeholder={`Search inside ${titleCase(list.name)}…`}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <Empty
          title={query ? 'Nothing matches that' : 'This list is empty'}
          action={
            !query ? (
              <Button variant="primary" icon={<Plus size={15} />} onClick={() => router.push('/discover')}>
                Find something to add
              </Button>
            ) : undefined
          }
        />
      ) : view === 'grid' ? (
        <div className="grid grid--posters">
          {items.map((item) => {
            const p = progressFor(item);
            return (
              <Poster
                key={item.id}
                item={item}
                progress={p.pct}
                watched={p.watched}
                onRemove={() => removeItem(item)}
                selectable={editing}
                selected={selected.has(item.id)}
                onSelect={() => toggleSelected(item.id)}
                draggable={editing}
                onDragStart={() => { dragId.current = item.id; }}
                onDragOver={(e) => editing && e.preventDefault()}
                onDrop={() => onDrop(item.id)}
                footer={
                  <div className="stack gap-1">
                    <div className="truncate" style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                      {item.title}
                    </div>
                    <div className="faint" style={{ fontSize: 'var(--text-xs)' }}>
                      {item.media_type === 'tv' ? 'Series' : 'Film'}
                      {item.added_at ? ` · added ${timeAgo(item.added_at)}` : ''}
                    </div>
                  </div>
                }
              />
            );
          })}
        </div>
      ) : (
        <div className="panel">
          <div className="stack" style={{ padding: 'var(--space-2)' }}>
            {items.map((item) => {
              const p = progressFor(item);
              return (
                <div
                  key={item.id}
                  className="list-row sortable-item"
                  draggable={editing}
                  onDragStart={() => { dragId.current = item.id; }}
                  onDragOver={(e) => editing && e.preventDefault()}
                  onDrop={() => onDrop(item.id)}
                >
                  {editing && <GripVertical size={15} className="drag-handle" />}
                  <div
                    style={{
                      width: 34, height: 50, borderRadius: 'var(--r-sm)', overflow: 'hidden',
                      background: 'var(--bg-subtle)', flexShrink: 0,
                    }}
                  >
                    {item.poster_url && (
                      <Image src={item.poster_url} alt="" width={34} height={50} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="truncate" style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                      {item.title}
                    </div>
                    <div className="faint" style={{ fontSize: 'var(--text-xs)' }}>
                      {item.media_type === 'tv' ? 'Series' : 'Film'}
                      {year(item.release_date) ? ` · ${year(item.release_date)}` : ''}
                    </div>
                  </div>
                  {p.pct > 0 && (
                    <div style={{ width: 90 }}>
                      <ProgressBar value={p.pct} label={`${item.title} progress`} />
                    </div>
                  )}
                  <div className="list-row__actions">
                    <Button variant="ghost" size="sm" aria-label="Add to another list" onClick={() => openAddTo(item)}>
                      <Plus size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label="Details" onClick={() => openMedia(item)}>
                      <Eye size={14} />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label="Remove" onClick={() => removeItem(item)}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
