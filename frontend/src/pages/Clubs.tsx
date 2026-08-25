import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, LogOut, Plus, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import { clubs as clubsApi } from '@/data/api';
import type { Club } from '@/data/types';
import { useAuth } from '@/data/AuthContext';
import { Button } from '@/components/ui/Button';
import { Field, Input, SearchInput, Textarea } from '@/components/ui/Field';
import { Avatar, Chip, Empty, Skeleton, Tabs } from '@/components/ui/Bits';
import { Modal } from '@/components/ui/Modal';
import { emit } from '@/lib/bus';
import { rank } from '@/lib/fuzzy';
import { timeAgo } from '@/lib/format';
import { staggerIn } from '@/lib/motion';

type Tab = 'mine' | 'all';

export default function Clubs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('mine');
  const [data, setData] = useState<{ my_clubs: Club[]; all_clubs: Club[] }>({ my_clubs: [], all_clubs: [] });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    clubsApi
      .all()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    if (!loading) staggerIn(gridRef.current?.querySelectorAll('.card'), { y: 16, each: 40 });
  }, [loading, tab, query]);

  const rows = useMemo(() => {
    const source = tab === 'mine' ? data.my_clubs : data.all_clubs;
    return rank(source, query, (c) => `${c.name} ${c.description}`);
  }, [data, tab, query]);

  const create = async () => {
    if (!name.trim()) return;
    const club = await clubsApi.create(name.trim(), description.trim());
    toast.success(`Created ${club.name}`);
    setCreating(false);
    setName('');
    setDescription('');
    load();
    emit('clubs');
  };

  const toggleMembership = async (club: Club, joined: boolean) => {
    if (joined) await clubsApi.leave(club.id);
    else await clubsApi.join(club.id);
    toast.success(joined ? `Left ${club.name}` : `Joined ${club.name}`);
    load();
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Clubs</h1>
          <p className="page-head__sub">Shared lists and arguments with people you like.</p>
        </div>
        <div className="page-head__actions">
          <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
            New club
          </Button>
        </div>
      </header>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'mine', label: 'My clubs', count: data.my_clubs.length },
          { value: 'all', label: 'All clubs', count: data.all_clubs.length },
        ]}
      />

      <div style={{ maxWidth: 380 }}>
        <SearchInput
          icon={<Search />}
          value={query}
          placeholder="Search clubs…"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid grid--cards">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} h={150} r="var(--r-md)" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Empty
          icon={<Users size={22} />}
          title={tab === 'mine' ? 'You are not in any clubs' : 'No clubs found'}
          action={
            <Button variant="primary" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
              Start one
            </Button>
          }
        >
          Clubs bundle a group of people around shared lists — great for a weekly film night.
        </Empty>
      ) : (
        <div className="grid grid--cards" ref={gridRef}>
          {rows.map((club) => {
            const joined = club.members?.some((m) => m.id === user?.id) ?? false;
            return (
              <article key={club.id} className="card" onClick={() => navigate(`/clubs/${club.id}`)}>
                <div className="row gap-3" style={{ marginBottom: 'var(--sp-3)' }}>
                  <Avatar src={club.image_url} name={club.name} size={40} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <h3 className="truncate" style={{ fontSize: 'var(--fs-16)' }}>
                      {club.name}
                    </h3>
                    <div className="faint" style={{ fontSize: 'var(--fs-11)' }}>
                      created {timeAgo(club.created_at)}
                    </div>
                  </div>
                </div>

                <p className="muted clamp-2" style={{ fontSize: 'var(--fs-13)', minHeight: 40 }}>
                  {club.description || 'No description yet.'}
                </p>

                <div className="row between" style={{ marginTop: 'var(--sp-3)' }}>
                  <div className="row gap-2">
                    <Chip>
                      <Users size={12} /> {club.member_count}
                    </Chip>
                    {!!club.lists?.length && <Chip>{club.lists.length} lists</Chip>}
                  </div>
                  <Button
                    size="sm"
                    variant={joined ? 'ghost' : 'soft'}
                    icon={joined ? <LogOut size={14} /> : <LogIn size={14} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMembership(club, joined);
                    }}
                  >
                    {joined ? 'Leave' : 'Join'}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Create a club"
        width={460}
        footer={
          <>
            <Button onClick={() => setCreating(false)}>Cancel</Button>
            <Button variant="primary" disabled={!name.trim()} onClick={create}>
              Create club
            </Button>
          </>
        }
      >
        <div className="stack gap-4">
          <Field label="Name">
            <Input value={name} placeholder="Sunday Cinema" onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Description" hint="What is this club for?">
            <Textarea
              value={description}
              placeholder="Weekly picks, no phones, opinions encouraged."
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        </div>
      </Modal>
    </>
  );
}
