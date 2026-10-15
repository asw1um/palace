import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Crown, ListPlus, LogIn, LogOut, Pencil, Settings, Shield, Trash2, UserX, Users } from '@/lib/icons';
import { toast } from 'sonner';
import { useBus } from '@/lib/bus';
import { activity as activityApi, clubs as clubsApi } from '@/data/api';
import type { Activity, Club } from '@/data/types';
import { useAuth } from '@/data/AuthContext';
import { useAppData } from '@/components/AppData';
import { Poster } from '@/components/Poster';
import { ActivityRow } from './Dashboard';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Avatar, Chip, Empty, Panel, Skeleton, Tabs } from '@/components/ui/Bits';
import { Modal, useConfirm } from '@/components/ui/Modal';
import { EditClubDialog } from '@/components/ClubManage';
import { titleCase, timeAgo, plural } from '@/lib/format';

type Tab = 'lists' | 'members' | 'activity';

export default function ClubDetail() {
  const { id } = useParams();
  const clubId = Number(id);
  const router = useRouter();
  const { user } = useAuth();
  const { progressFor } = useAppData();

  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('lists');
  const [feed, setFeed] = useState<Activity[]>([]);
  const [creating, setCreating] = useState(false);
  const [listName, setListName] = useState('');
  const [editing, setEditing] = useState(false);
  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const confirm = useConfirm();

  const load = () => {
    setLoading(true);
    clubsApi
      .one(clubId)
      .then(setClub)
      .catch(() => setClub(null))
      .finally(() => setLoading(false));
    activityApi.forClub(clubId, 30).then(setFeed).catch(() => {});
  };

  useEffect(load, [clubId]);
  useBus(['clubs', 'lists'], load);

  const joined = useMemo(
    () => club?.members?.some((m) => m.id === user?.id) ?? false,
    [club, user],
  );

  // The admin and mods run the club; helpers can also create lists and add titles.
  const isAdmin = !!club && !!user && club.admin_id === user.id;
  const isMod = !!club && !!user && !!club.mod_ids?.includes(user.id);
  const canManage = isAdmin || isMod;
  const canManageLists = canManage || (!!club && !!user && !!club.helper_ids?.includes(user.id));

  if (loading && !club) {
    return (
      <div className="stack gap-4">
        <Skeleton h={120} r="var(--r-lg)" />
        <Skeleton h={280} r="var(--r-lg)" />
      </div>
    );
  }

  if (!club) {
    return <Empty title="Club not found" action={<Button onClick={() => router.push('/clubs')}>Back to clubs</Button>} />;
  }

  const createList = async () => {
    if (!listName.trim()) return;
    await clubsApi.createList(club.id, listName.trim());
    toast.success('Club list created');
    setListName('');
    setCreating(false);
    load();
  };

  const roleFor = (memberId: number) => {
    if (club.admin_id === memberId) return { label: 'Admin', icon: <Crown size={12} /> };
    if (club.mod_ids?.includes(memberId)) return { label: 'Mod', icon: <Shield size={12} /> };
    if (club.helper_ids?.includes(memberId)) return { label: 'Helper', icon: null };
    return null;
  };

  /** Runs a member or list action, then reloads; failures are already shown as a toast. */
  const act = async (fn: () => Promise<void>, done: string) => {
    try {
      await fn();
      toast.success(done);
      load();
    } catch {
      /* shown by the request layer */
    }
  };

  const leave = async () => {
    const alone = (club.members?.length ?? 0) <= 1;
    if (isAdmin && alone) {
      toast.error('You are the only member. Delete the club from Edit club instead.');
      return;
    }
    if (isAdmin) {
      const ok = await confirm({
        title: `Leave ${club.name}?`,
        message: 'You run this club. If you leave, it passes to a mod, or to another member if there are no mods.',
        confirmLabel: 'Leave club',
        danger: true,
      });
      if (!ok) return;
    }
    await act(() => clubsApi.leave(club.id), `Left ${club.name}`);
  };

  const removeList = async (list: { id: number; name: string }) => {
    const ok = await confirm({
      title: `Delete "${titleCase(list.name)}"?`,
      message: 'The list is removed for every member. The titles themselves are not affected.',
      confirmLabel: 'Delete list',
      danger: true,
    });
    if (ok) await act(() => clubsApi.removeList(club.id, list.id), 'List deleted');
  };

  const kick = async (member: { id: number; username: string; nickname?: string | null }) => {
    const who = member.nickname ?? member.username;
    const ok = await confirm({
      title: `Remove ${who} from the club?`,
      message: 'They can join again later.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (ok) await act(() => clubsApi.kick(club.id, member.id), `Removed ${who}`);
  };

  return (
    <>
      <button className="row gap-2 faint" style={{ fontSize: 'var(--text-xs)' }} onClick={() => router.push('/clubs')}>
        <ArrowLeft size={14} /> All clubs
      </button>

      <section
        className="panel"
        style={{
          padding: 'var(--space-6)',
          background: 'var(--accent-soft)',
          borderColor: 'var(--border)',
        }}
      >
        <div className="row gap-4 wrap">
          <Avatar src={club.image_url} name={club.name} size={64} />
          <div className="grow" style={{ minWidth: 220 }}>
            <h1>{club.name}</h1>
            <p className="muted" style={{ maxWidth: '62ch' }}>
              {club.description || 'No description yet.'}
            </p>
            <div className="row gap-2 wrap" style={{ marginTop: 'var(--space-3)' }}>
              <Chip>
                <Users size={12} /> {plural(club.member_count ?? 0, 'member')}
              </Chip>
              <Chip>{plural(club.lists?.length ?? 0, 'list')}</Chip>
              <Chip>created {timeAgo(club.created_at)}</Chip>
            </div>
          </div>
          <div className="row gap-2">
            <Button
              variant={joined ? 'ghost' : 'primary'}
              icon={joined ? <LogOut size={15} /> : <LogIn size={15} />}
              onClick={() => (joined ? leave() : act(() => clubsApi.join(club.id), `Joined ${club.name}`))}
            >
              {joined ? 'Leave club' : 'Join club'}
            </Button>
            {canManage && (
              <Button icon={<Settings size={15} />} onClick={() => setEditing(true)}>
                Edit club
              </Button>
            )}
            {canManageLists && (
              <Button icon={<ListPlus size={15} />} onClick={() => setCreating(true)}>
                New list
              </Button>
            )}
          </div>
        </div>
      </section>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'lists', label: 'Lists', count: club.lists?.length ?? 0 },
          { value: 'members', label: 'Members', count: club.member_count },
          { value: 'activity', label: 'Activity' },
        ]}
      />

      {tab === 'lists' && (
        <div className="stack gap-6">
          {(club.lists ?? []).length === 0 && (
            <Empty icon={<ListPlus size={22} />} title="No club lists yet">
              Club lists are shared with every member.
            </Empty>
          )}
          {(club.lists ?? []).map((l) => (
            <section key={l.id}>
              <div className="section-head">
                <h2>{titleCase(l.name)}</h2>
                <div className="row gap-2">
                  <Chip>{plural((l.movie_count ?? 0) + (l.show_count ?? 0), 'title')}</Chip>
                  {joined && (
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/lists/${l.id}`)}>
                      Open
                    </Button>
                  )}
                  {canManage && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Rename ${l.name}`}
                        onClick={() => setRenaming({ id: l.id, name: titleCase(l.name) })}
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button variant="ghost" size="sm" aria-label={`Delete ${l.name}`} onClick={() => removeList(l)}>
                        <Trash2 size={14} />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {(l.items ?? []).length === 0 ? (
                <Panel>
                  <p className="faint">Nothing added yet.</p>
                </Panel>
              ) : (
                <div className="grid grid--posters">
                  {(l.items ?? []).map((item) => {
                    const p = progressFor(item);
                    return <Poster key={item.id} item={item} watched={p.watched} progress={p.pct} />;
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {tab === 'members' && (
        <div className="grid grid--cards">
          {(club.members ?? []).map((m) => {
            const role = roleFor(m.id);
            return (
              <article key={m.id} className="card" onClick={() => router.push(`/profile/${m.username}`)}>
                <div className="row gap-3">
                  <Avatar src={m.profile_picture} name={m.nickname ?? m.username} size={42} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row gap-2">
                      <strong className="truncate">{m.nickname ?? m.username}</strong>
                      {role && (
                        <Chip tone="accent">
                          {role.icon} {role.label}
                        </Chip>
                      )}
                    </div>
                    <div className="faint truncate" style={{ fontSize: 'var(--text-xs)' }}>
                      @{m.username}
                    </div>
                  </div>
                </div>
                {m.id !== user?.id && m.id !== club.admin_id && canManage && (
                  <div
                    className="row gap-2 wrap"
                    style={{ marginTop: 'var(--space-3)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="soft"
                        onClick={() => {
                          const on = !club.mod_ids?.includes(m.id);
                          act(() => clubsApi.setMod(club.id, m.id, on), on ? 'Made a mod' : 'No longer a mod');
                        }}
                      >
                        {club.mod_ids?.includes(m.id) ? 'Remove mod' : 'Make mod'}
                      </Button>
                    )}
                    {isAdmin && !club.mod_ids?.includes(m.id) && (
                      <Button
                        size="sm"
                        variant="soft"
                        onClick={() => {
                          const on = !club.helper_ids?.includes(m.id);
                          act(() => clubsApi.setHelper(club.id, m.id, on), on ? 'Made a helper' : 'No longer a helper');
                        }}
                      >
                        {club.helper_ids?.includes(m.id) ? 'Remove helper' : 'Make helper'}
                      </Button>
                    )}
                    {(isAdmin || !club.mod_ids?.includes(m.id)) && (
                      <Button size="sm" variant="ghost" icon={<UserX size={14} />} onClick={() => kick(m)}>
                        Remove
                      </Button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {tab === 'activity' && (
        <Panel flush>
          <div className="stack" style={{ padding: 'var(--space-2)' }}>
            {feed.length === 0 && <Empty title="No activity yet" />}
            {feed.map((a) => (
              <ActivityRow key={a.id} activity={a} />
            ))}
          </div>
        </Panel>
      )}

      <EditClubDialog
        open={editing}
        club={club}
        isAdmin={isAdmin}
        onClose={() => setEditing(false)}
        onChanged={load}
        onDeleted={() => router.push('/clubs')}
      />

      <Modal
        open={!!renaming}
        onClose={() => setRenaming(null)}
        title="Rename list"
        width={420}
        footer={
          <>
            <Button onClick={() => setRenaming(null)}>Cancel</Button>
            <Button
              variant="primary"
              disabled={!renaming?.name.trim()}
              onClick={async () => {
                if (!renaming) return;
                await act(() => clubsApi.renameList(club.id, renaming.id, renaming.name.trim()), 'List renamed');
                setRenaming(null);
              }}
            >
              Rename
            </Button>
          </>
        }
      >
        <Field label="List name">
          <Input
            value={renaming?.name ?? ''}
            maxLength={50}
            onChange={(e) => setRenaming((r) => (r ? { ...r, name: e.target.value } : r))}
          />
        </Field>
      </Modal>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New club list"
        width={420}
        footer={
          <>
            <Button onClick={() => setCreating(false)}>Cancel</Button>
            <Button variant="primary" disabled={!listName.trim()} onClick={createList}>
              Create
            </Button>
          </>
        }
      >
        <Field label="List name" hint="Admins, mods and helpers can add titles to it.">
          <Input
            value={listName}
            placeholder="October horror run"
            onChange={(e) => setListName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createList()}
          />
        </Field>
      </Modal>
    </>
  );
}
