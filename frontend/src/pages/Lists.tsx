import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownUp, Check, GripVertical, ListVideo, Pencil, Pin, PinOff, Plus, Trash2, Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { lists as listsApi } from '@/data/api';
import type { List } from '@/data/types';
import { useAppData } from '@/components/AppData';
import { ImportDialog } from '@/components/ImportDialog';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import { Chip, Empty, Panel, Skeleton } from '@/components/ui/Bits';
import { useConfirm } from '@/components/ui/Modal';
import { emit } from '@/lib/bus';
import { titleCase } from '@/lib/format';
import { flip } from '@/lib/motion';
import { useLocalState } from '@/lib/hooks';

type Sort = 'manual' | 'az' | 'za' | 'size' | 'recent';

export default function Lists() {
  const { lists, loadingLists, openCreateList } = useAppData();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [sort, setSort] = useLocalState<Sort>('palace.listSort', 'manual');
  const [editing, setEditing] = useState(false);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [pinned, setPinned] = useLocalState<number[]>('palace.pinnedLists', []);
  const dragId = useRef<number | null>(null);

  const ordered = useMemo(() => {
    const rows = [...lists];
    switch (sort) {
      case 'az': rows.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'za': rows.sort((a, b) => b.name.localeCompare(a.name)); break;
      case 'size':
        rows.sort(
          (a, b) =>
            (b.movie_count ?? 0) + (b.show_count ?? 0) - ((a.movie_count ?? 0) + (a.show_count ?? 0)),
        );
        break;
      case 'recent':
        rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
        break;
      default: break;
    }
    // Pinned lists always float to the top. — issue #24
    return rows.sort((a, b) => Number(pinned.includes(b.id)) - Number(pinned.includes(a.id)));
  }, [lists, sort, pinned]);

  const onDrop = (targetId: number) => {
    const from = dragId.current;
    dragId.current = null;
    if (!from || from === targetId) return;
    const ids = ordered.map((l) => l.id);
    const next = ids.filter((id) => id !== from);
    next.splice(ids.indexOf(targetId), 0, from);
    flip('.list-card', () => {
      listsApi.reorder(next);
      setSort('manual');
      emit('lists');
    });
  };

  const rename = async (list: List) => {
    const clean = draft.trim();
    setRenaming(null);
    if (!clean || clean === list.name) return;
    await listsApi.rename(list.id, clean);
    toast.success('List renamed');
    emit('lists');
  };

  const remove = async (list: List) => {
    const ok = await confirm({
      title: `Delete “${titleCase(list.name)}”?`,
      message: 'The titles inside stay in your other lists. This cannot be undone.',
      confirmLabel: 'Delete list',
      danger: true,
    });
    if (!ok) return;
    await listsApi.remove(list.id);
    toast.success('List deleted');
    emit('lists');
  };

  const togglePin = (id: number) => {
    setPinned((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    listsApi.pin(id, !pinned.includes(id)).catch(() => {});
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1>My lists</h1>
          <p className="page-head__sub">
            {lists.length} list{lists.length === 1 ? '' : 's'} ·{' '}
            {lists.reduce((a, l) => a + (l.movie_count ?? 0) + (l.show_count ?? 0), 0)} titles
          </p>
        </div>
        <div className="page-head__actions">
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{ width: 165 }}>
            <option value="manual">Manual order</option>
            <option value="az">Name A – Z</option>
            <option value="za">Name Z – A</option>
            <option value="size">Most titles</option>
            <option value="recent">Recently created</option>
          </Select>
          <Button
            variant={editing ? 'soft' : 'default'}
            icon={editing ? <Check size={15} /> : <ArrowDownUp size={15} />}
            onClick={() => setEditing((e) => !e)}
          >
            {editing ? 'Done' : 'Edit'}
          </Button>
          <Button icon={<Upload size={15} />} onClick={() => setImportOpen(true)}>
            Import
          </Button>
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => openCreateList()}>
            New list
          </Button>
        </div>
      </header>

      {editing && (
        <div className="panel panel--inset" style={{ padding: 'var(--sp-3)' }}>
          <span className="muted" style={{ fontSize: 'var(--fs-12)' }}>
            Drag a card by its handle to reorder, rename in place, or pin the lists you use most.
            {/* issues #7 and #24 */}
          </span>
        </div>
      )}

      {loadingLists ? (
        <div className="grid grid--cards">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} h={150} r="var(--r-md)" />
          ))}
        </div>
      ) : ordered.length === 0 ? (
        <Empty
          icon={<ListVideo size={22} />}
          title="No lists yet"
          action={
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => openCreateList()}>
              Create your first list
            </Button>
          }
        >
          Lists are how Palace keeps track of what you want to watch, what you are watching, and what
          you loved.
        </Empty>
      ) : (
        <div className="grid grid--cards">
          {ordered.map((l) => {
            const total = (l.movie_count ?? 0) + (l.show_count ?? 0);
            const posters = (l.items ?? []).slice(0, 4);
            const isPinned = pinned.includes(l.id);
            return (
              <article
                key={l.id}
                className="card list-card"
                draggable={editing}
                onDragStart={() => { dragId.current = l.id; }}
                onDragOver={(e) => editing && e.preventDefault()}
                onDrop={() => onDrop(l.id)}
                onClick={() => !editing && renaming !== l.id && navigate(`/lists/${l.id}`)}
                style={{ cursor: editing ? 'default' : 'pointer' }}
              >
                <div className="row gap-2" style={{ marginBottom: 'var(--sp-3)' }}>
                  {editing && <GripVertical size={16} className="drag-handle" />}
                  {renaming === l.id ? (
                    <Input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => rename(l)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') rename(l);
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <h3 className="grow truncate" style={{ fontSize: 'var(--fs-16)' }}>
                      {/* Default lists come back lower-case from the API. — issue #6 */}
                      {titleCase(l.name)}
                    </h3>
                  )}
                  {isPinned && !editing && <Pin size={14} style={{ color: 'var(--accent)' }} />}
                </div>

                <div className="row gap-1" style={{ marginBottom: 'var(--sp-3)' }}>
                  {posters.length === 0 && (
                    <div
                      className="panel panel--inset row center"
                      style={{ height: 72, width: '100%', fontSize: 'var(--fs-12)', color: 'var(--text-faint)' }}
                    >
                      Empty list
                    </div>
                  )}
                  {posters.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        width: 48, height: 72, borderRadius: 'var(--r-xs)', overflow: 'hidden',
                        background: 'var(--surface-3)', flexShrink: 0,
                      }}
                    >
                      {p.poster_url && <img src={p.poster_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                  ))}
                  {total > 4 && <Chip>+{total - 4}</Chip>}
                </div>

                <div className="row gap-2 between">
                  <div className="row gap-2">
                    {/* Films and series both counted. — issue #46 */}
                    <Chip>{l.movie_count ?? 0} films</Chip>
                    <Chip>{l.show_count ?? 0} series</Chip>
                  </div>
                  {editing && (
                    <div className="row gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Rename"
                        onClick={() => { setRenaming(l.id); setDraft(l.name); }}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={isPinned ? 'Unpin' : 'Pin'}
                        onClick={() => togglePin(l.id)}
                      >
                        {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
                      </Button>
                      <Button variant="ghost" size="sm" aria-label="Delete" onClick={() => remove(l)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Panel title="Tip" icon={<ListVideo size={16} />}>
        <p className="muted" style={{ fontSize: 'var(--fs-13)' }}>
          Right-click any poster anywhere in Palace to add it to a list — or spin up a brand new list
          with that title already inside.
        </p>
      </Panel>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </>
  );
}
