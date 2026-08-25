import { useEffect, useMemo, useState } from 'react';
import { Activity as ActivityIcon, Search } from 'lucide-react';
import { activity as activityApi } from '@/data/api';
import type { Activity } from '@/data/types';
import { ActivityRow } from './Dashboard';
import { SearchInput } from '@/components/ui/Field';
import { Empty, Panel, Skeleton, Tabs } from '@/components/ui/Bits';
import { rank } from '@/lib/fuzzy';
import { useBus } from '@/lib/bus';

type Tab = 'global' | 'me';

export default function ActivityPage() {
  const [tab, setTab] = useState<Tab>('global');
  const [rows, setRows] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [type, setType] = useState<string>('all');

  const load = () => {
    setLoading(true);
    activityApi
      .feed(tab, 80)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, [tab]);
  useBus(['lists', 'reviews', 'progress'], load);

  const types = useMemo(
    () => ['all', ...new Set(rows.map((r) => r.event_type))],
    [rows],
  );

  const shown = useMemo(() => {
    let out = rows;
    if (type !== 'all') out = out.filter((r) => r.event_type === type);
    return rank(out, query, (r) => `${r.description} ${r.actor?.nickname ?? ''} ${r.actor?.username ?? ''}`);
  }, [rows, query, type]);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Activity</h1>
          <p className="page-head__sub">Everything happening across Palace.</p>
        </div>
      </header>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'global', label: 'Everyone' },
          { value: 'me', label: 'Just me' },
        ]}
      />

      <div className="row gap-3 wrap">
        <div style={{ flex: '1 1 280px' }}>
          <SearchInput
            icon={<Search />}
            value={query}
            placeholder="Search activity…"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="row gap-2 wrap">
          {types.map((t) => (
            <button key={t} className="chip" aria-pressed={type === t} onClick={() => setType(t)}>
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="stack gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} h={52} r="var(--r-sm)" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <Empty icon={<ActivityIcon size={22} />} title="Nothing to show" />
      ) : (
        <Panel flush>
          <div className="stack" style={{ padding: 'var(--sp-2)' }}>
            {shown.map((a) => (
              <ActivityRow key={a.id} activity={a} />
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}
