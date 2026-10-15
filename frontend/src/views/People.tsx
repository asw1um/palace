import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users } from '@/lib/icons';
import { people as peopleApi } from '@/data/api';
import type { User } from '@/data/types';
import { useAuth } from '@/data/AuthContext';
import { SearchInput } from '@/components/ui/Field';
import { Avatar, Chip, Empty, Skeleton } from '@/components/ui/Bits';
import { rank } from '@/lib/fuzzy';
import { timeAgo } from '@/lib/format';

export default function People() {
  const router = useRouter();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    peopleApi
      .all()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(
    () => rank(users, query, (u) => `${u.nickname ?? ''} ${u.username}`),
    [users, query],
  );

  return (
    <>
      <header className="page-head">
        <div>
          <h1>People</h1>
          <p className="page-head__sub">
            {users.length} member{users.length === 1 ? '' : 's'}
          </p>
        </div>
      </header>

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
        <Empty icon={<Users size={22} />} title={query.trim() ? 'Nobody matches that' : 'Nobody here yet'} />
      ) : (
        <div className="grid grid--cards">
          {rows.map((u) => (
            <article
              key={u.id}
              className="card person-card"
              onClick={() => router.push(`/profile/${u.username}`)}
            >
              <div className="row gap-3">
                <Avatar src={u.profile_picture} name={u.nickname ?? u.username} size={44} />
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row gap-2">
                    <strong className="truncate">{u.nickname ?? u.username}</strong>
                    {u.id === user?.id && <Chip>You</Chip>}
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
            </article>
          ))}
        </div>
      )}
    </>
  );
}
