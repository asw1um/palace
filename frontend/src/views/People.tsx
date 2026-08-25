import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Search, UserPlus, UserX, Users, X } from '@/lib/icons';
import { toast } from 'sonner';
import { people as peopleApi } from '@/data/api';
import type { Friendship, User } from '@/data/types';
import { useAuth } from '@/data/AuthContext';
import { isDemo } from '@/data/client';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/Field';
import { Avatar, Chip, Empty, Panel, Skeleton, Tabs } from '@/components/ui/Bits';
import { rank } from '@/lib/fuzzy';
import { timeAgo } from '@/lib/format';
type Tab = 'everyone' | 'friends' | 'requests';

export default function People() {
  const router = useRouter();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('everyone');
  const [users, setUsers] = useState<User[]>([]);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = () => {
    setLoading(true);
    Promise.all([peopleApi.all(), peopleApi.friends()])
      .then(([u, f]) => {
        setUsers(u);
        setFriends(f);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const accepted = friends.filter((f) => f.status === 'accepted');
  const incoming = friends.filter((f) => f.status === 'incoming');

  const rows = useMemo(() => {
    const source =
      tab === 'everyone'
        ? users.filter((u) => u.id !== user?.id)
        : tab === 'friends'
          ? accepted.map((f) => f.user)
          : incoming.map((f) => f.user);
    return rank(source, query, (u) => `${u.nickname ?? ''} ${u.username}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, friends, tab, query, user?.id]);

  const friendshipFor = (id: number) => friends.find((f) => f.user.id === id);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>People</h1>
          <p className="page-head__sub">
            {users.length} members · {accepted.length} friends
          </p>
        </div>
      </header>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'everyone', label: 'Everyone', count: Math.max(0, users.length - 1) },
          { value: 'friends', label: 'Friends', count: accepted.length },
          { value: 'requests', label: 'Requests', count: incoming.length },
        ]}
      />

      {!isDemo() && (
        <Panel>
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Friends are a front-end preview — the backend does not expose friendship endpoints yet
            (issue #113). Everything else on this page is live.
          </p>
        </Panel>
      )}

      <div style={{ maxWidth: 380 }}>
        <SearchInput
          icon={<Search />}
          value={query}
          placeholder="Search people…"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid grid--cards">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} h={110} r="var(--r-md)" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Empty
          icon={<Users size={22} />}
          title={tab === 'requests' ? 'No pending requests' : 'Nobody here'}
        />
      ) : (
        <div className="grid grid--cards">
          {rows.map((u) => {
            const rel = friendshipFor(u.id);
            return (
              <article key={u.id} className="card person-card" onClick={() => router.push(`/profile/${u.username}`)}>
                <div className="row gap-3">
                  <Avatar src={u.profile_picture} name={u.nickname ?? u.username} size={44} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="row gap-2">
                      <strong className="truncate">{u.nickname ?? u.username}</strong>
                      {rel?.status === 'accepted' && <Chip tone="success">Friend</Chip>}
                      {rel?.status === 'pending' && <Chip>Requested</Chip>}
                    </div>
                    <div className="faint truncate" style={{ fontSize: 'var(--text-xs)' }}>
                      @{u.username}
                      {u.created_at ? ` · joined ${timeAgo(u.created_at)}` : ''}
                    </div>
                  </div>
                </div>

                <p className="muted clamp-2" style={{ fontSize: 'var(--text-sm)', marginTop: 'var(--space-3)', minHeight: 36 }}>
                  {u.bio || 'No bio yet.'}
                </p>

                <div className="row gap-2" style={{ marginTop: 'var(--space-3) ' }} onClick={(e) => e.stopPropagation()}>
                  {rel?.status === 'incoming' ? (
                    <>
                      <Button
                        size="sm"
                        variant="primary"
                        icon={<Check size={14} />}
                        onClick={async () => {
                          await peopleApi.respondFriend(rel.id, true);
                          toast.success(`You and ${u.nickname ?? u.username} are now friends`);
                          load();
                        }}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<X size={14} />}
                        onClick={async () => {
                          await peopleApi.respondFriend(rel.id, false);
                          load();
                        }}
                      >
                        Decline
                      </Button>
                    </>
                  ) : rel?.status === 'accepted' ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<UserX size={14} />}
                      onClick={async () => {
                        await peopleApi.removeFriend(rel.id);
                        load();
                      }}
                    >
                      Remove friend
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="soft"
                      icon={<UserPlus size={14} />}
                      disabled={rel?.status === 'pending'}
                      onClick={async () => {
                        await peopleApi.addFriend(u.id);
                        toast.success('Friend request sent');
                        load();
                      }}
                    >
                      {rel?.status === 'pending' ? 'Requested' : 'Add friend'}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
