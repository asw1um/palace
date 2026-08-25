import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Crown, ListPlus, LogIn, LogOut, Shield, Users } from 'lucide-react';
import { toast } from 'sonner';
import { activity as activityApi, clubs as clubsApi } from '@/data/api';
import type { Activity, Club } from '@/data/types';
import { useAuth } from '@/data/AuthContext';
import { useAppData } from '@/components/AppData';
import { Poster } from '@/components/Poster';
import { ActivityRow } from './Dashboard';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Avatar, Chip, Empty, Panel, Skeleton, Tabs } from '@/components/ui/Bits';
import { Modal } from '@/components/ui/Modal';
import { titleCase, timeAgo } from '@/lib/format';

type Tab = 'lists' | 'members' | 'activity';

export default function ClubDetail() {
  const { id } = useParams();
  const clubId = Number(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { progressFor } = useAppData();

  const [club, setClub] = useState<Club | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('lists');
  const [feed, setFeed] = useState<Activity[]>([]);
  const [creating, setCreating] = useState(false);
  const [listName, setListName] = useState('');

  const load = () => {
    setLoading(true);
    clubsApi
      .one(clubId)
      .then(setClub)
      .catch(() => setClub(null))
      .finally(() => setLoading(false));
    activityApi.feed('global', 20).then(setFeed).catch(() => {});
  };

  useEffect(load, [clubId]);

  const joined = useMemo(
    () => club?.members?.some((m) => m.id === user?.id) ?? false,
    [club, user],
  );

  if (loading && !club) {
    return (
      <div className="stack gap-4">
        <Skeleton h={120} r="var(--r-lg)" />
        <Skeleton h={280} r="var(--r-lg)" />
      </div>
    );
  }

  if (!club) {
    return <Empty title="Club not found" action={<Button onClick={() => navigate('/clubs')}>Back to clubs</Button>} />;
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
    return null;
  };

  return (
    <>
      <button className="row gap-2 faint" style={{ fontSize: 'var(--fs-12)' }} onClick={() => navigate('/clubs')}>
        <ArrowLeft size={14} /> All clubs
      </button>

      <section
        className="panel shine"
        style={{
          padding: 'var(--sp-6)',
          background:
            'linear-gradient(120deg, color-mix(in oklab, var(--accent) 18%, var(--surface-1)), var(--surface-1))',
        }}
      >
        <div className="row gap-4 wrap">
          <Avatar src={club.image_url} name={club.name} size={64} />
          <div className="grow" style={{ minWidth: 220 }}>
            <h1>{club.name}</h1>
            <p className="muted" style={{ maxWidth: '62ch' }}>
              {club.description || 'No description yet.'}
            </p>
            <div className="row gap-2 wrap" style={{ marginTop: 'var(--sp-3)' }}>
              <Chip>
                <Users size={12} /> {club.member_count} members
              </Chip>
              <Chip>{club.lists?.length ?? 0} lists</Chip>
              <Chip>created {timeAgo(club.created_at)}</Chip>
            </div>
          </div>

          <div className="row gap-2">
            <Button
              variant={joined ? 'ghost' : 'primary'}
              icon={joined ? <LogOut size={15} /> : <LogIn size={15} />}
              onClick={async () => {
                if (joined) await clubsApi.leave(club.id);
                else await clubsApi.join(club.id);
                load();
              }}
            >
              {joined ? 'Leave club' : 'Join club'}
            </Button>
            {joined && (
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
            <section key={l.id} className="reveal">
              <div className="section-head">
                <h2>{titleCase(l.name)}</h2>
                <Chip>{(l.movie_count ?? 0) + (l.show_count ?? 0)} titles</Chip>
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
              <article key={m.id} className="card" onClick={() => navigate(`/profile/${m.username}`)}>
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
                    <div className="faint truncate" style={{ fontSize: 'var(--fs-12)' }}>
                      @{m.username}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {tab === 'activity' && (
        <Panel flush>
          <div className="stack" style={{ padding: 'var(--sp-2)' }}>
            {feed.length === 0 && <Empty title="No activity yet" />}
            {feed.map((a) => (
              <ActivityRow key={a.id} activity={a} />
            ))}
          </div>
        </Panel>
      )}

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
        <Field label="List name" hint="Everyone in the club can add to it.">
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