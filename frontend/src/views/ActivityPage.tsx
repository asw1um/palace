import { useEffect, useMemo, useState } from 'react';
import { Activity as ActivityIcon, Search } from '@/lib/icons';
import { activity as activityApi } from '@/data/api';
import type { Activity } from '@/data/types';
import { ActivityRow } from './Dashboard';
import { SearchInput } from '@/components/ui/Field';
import { Empty, Panel, Skeleton, Tabs } from '@/components/ui/Bits';
import { rank } from '@/lib/fuzzy';
import { useBus } from '@/lib/bus';

type Tab = 'global' | 'me';

/** Readable names for the filter chips; the API sends internal event names. */
const EVENT_LABELS: Record<string, string> = {
  new_user: 'New members',
  user_created_club: 'Clubs created',
  user_joined_club: 'Club joins',
  user_left_club: 'Club leaves',
  user_renamed_club: 'Club renames',
  user_deleted_club: 'Clubs deleted',
  user_changed_pfp: 'Profile pictures',
  user_changed_banner: 'Banners',
  user_created_list: 'Lists created',
  user_renamed_list: 'List renames',
  user_deleted_list: 'Lists deleted',
  user_created_club_list: 'Club lists created',
  user_renamed_club_list: 'Club list renames',
  user_deleted_club_list: 'Club lists deleted',
  user_added_movie: 'Films added',
  user_added_show: 'Series added',
  user_removed_movie: 'Films removed',
  user_removed_show: 'Series removed',
  user_in_club_added_movie: 'Films added to clubs',
  user_in_club_added_show: 'Series added to clubs',
  user_in_club_removed_movie: 'Films removed from clubs',
  user_in_club_removed_show: 'Series removed from clubs',
  user_reviewed: 'Reviews',
  user_updated_review: 'Review edits',
  user_liked_review: 'Review likes',
  user_disliked_review: 'Review dislikes',
};

function eventLabel(type: string): string {
  if (EVENT_LABELS[type]) return EVENT_LABELS[type];
  // Anything new still reads as words rather than a code name.
  const words = type.replace(/^user_/, '').replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

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
              {t === 'all' ? 'All' : eventLabel(t)}
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
          <div className="stack" style={{ padding: 'var(--space-2)' }}>
            {shown.map((a) => (
              <ActivityRow key={a.id} activity={a} />
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}
