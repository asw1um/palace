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
<<<<<<< Updated upstream

          {/* Members */}
          <GlassBox title="Members" collapsible defaultCollapsed={false} rightAction={<span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0', textTransform: 'none' }}>{members.length}</span>}>
            {members.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px' }}>
                {members.map(m => {
                  const display_name = (m.nickname ?? m.username) || 'User';
                  const isSelected = selectedMember?.id === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={e => {
                        if (isSelected) { setSelectedMember(null); return; }
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const popupW = 340, popupH = 320;
                        const MARGIN = 16;
                        // Position to the right of the card, top-aligned with the card
                        let x = rect.right + MARGIN;
                        if (x + popupW > window.innerWidth - MARGIN) x = rect.left - popupW - MARGIN;
                        if (x < MARGIN) x = MARGIN;
                        let y = rect.top;
                        if (y < MARGIN) y = MARGIN;
                        if (y + popupH > window.innerHeight - MARGIN) y = window.innerHeight - popupH - MARGIN;
                        setPopupPos({ x, y });
                        setSelectedMember(m);
                      }}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', cursor: 'pointer', padding: '6px', borderRadius: '10px', border: `1px solid ${isSelected ? 'var(--t-primary-50)' : 'transparent'}`, background: isSelected ? 'var(--t-primary-12)' : 'transparent', transition: 'all 0.15s' }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {m.profile_picture ? (
                        <div className="avatar-circle" style={{ width: '52px', height: '52px', borderRadius: '50%', overflow: 'hidden', boxShadow: isSelected ? 'inset 0 0 0 2px var(--t-primary), 0 0 0 3px var(--t-primary-30)' : 'inset 0 0 0 2px rgba(255,255,255,0.2)', transition: 'all 0.15s' }}>
                          <img src={m.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        </div>
                      ) : (
                        <div className="avatar-circle" style={{ width: '52px', height: '52px', background: userGradient(display_name), borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: '#fff', boxShadow: isSelected ? 'inset 0 0 0 2px var(--t-primary), 0 0 0 3px var(--t-primary-30)' : 'inset 0 0 0 2px rgba(255,255,255,0.2)', transition: 'all 0.15s' }}>
                          {display_name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', maxWidth: '64px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'center' }}>{display_name}</div>
                      {m.id === club.admin_id
                        ? <div style={{ fontSize: '8px', color: 'var(--t-primary)', fontWeight: 700, letterSpacing: '0.5px', marginTop: '-2px' }}>ADMIN</div>
                        : (club.mod_ids || []).includes(m.id)
                          ? <div style={{ fontSize: '8px', color: '#f0a500', fontWeight: 700, letterSpacing: '0.5px', marginTop: '-2px' }}>MOD</div>
                          : (club.helper_ids || []).includes(m.id)
                            ? <div style={{ fontSize: '8px', color: '#63b3ed', fontWeight: 700, letterSpacing: '0.5px', marginTop: '-2px' }}>HELPER</div>
                            : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>No members yet</div>
=======
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
>>>>>>> Stashed changes
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
