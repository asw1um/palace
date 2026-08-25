import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity as ActivityIcon, ArrowRight, CalendarDays, Clapperboard, Flame, ListVideo,
  PlayCircle, Plus, Star, Timer, Users,
} from '@/lib/icons';
import { activity as activityApi, clubs as clubsApi, stats as statsApi } from '@/data/api';
import type { Activity, Club, UserStats } from '@/data/types';
import { useAuth } from '@/data/AuthContext';
import { useAppData } from '@/components/AppData';
import { Poster } from '@/components/Poster';
const Heatmap = dynamic(() => import('@/components/Heatmap').then(m => ({ default: m.Heatmap })), { ssr: false });
import { Panel, Avatar, Chip, Empty, Skeleton, Stat, ProgressBar } from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { Markdown } from '@/components/Markdown';
import { useBus } from '@/lib/bus';
import { percent, titleCase, timeAgo } from '@/lib/format';
function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { user } = useAuth();
  const { lists, loadingLists, progressFor, openCreateList } = useAppData();
  const router = useRouter();
  const [feed, setFeed] = useState<Activity[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);

  const load = () => {
    activityApi.feed('global', 12).then(setFeed).catch(() => {});
    clubsApi.all().then((r) => setClubs(r.my_clubs)).catch(() => {});
    if (user) statsApi.forUser(user.id).then(setStats).catch(() => {});
  };

  useEffect(load, [user?.id]);
  useBus(['lists', 'reviews', 'progress'], load);

  const continueWatching = useMemo(() => {
    const items = lists.flatMap((l) => l.items ?? []);
    const seen = new Map<number, (typeof items)[number]>();
    for (const i of items) if (!seen.has(i.tmdb_id)) seen.set(i.tmdb_id, i);
    return [...seen.values()]
      .map((i) => ({ item: i, ...progressFor(i) }))
      .filter((x) => x.pct > 0 && x.pct < 100)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 8);
  }, [lists, progressFor]);

  const upNext = useMemo(() => {
    const list = lists.find((l) => /^want to watch$/i.test(l.name)) ?? lists[0];
    return (list?.items ?? []).slice(0, 8);
  }, [lists]);


  const hours = Math.round((stats?.minutes ?? 0) / 60);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>
            {greeting()}, {user?.nickname ?? user?.username ?? 'friend'}
          </h1>
          <p className="page-head__sub">
            {continueWatching.length
              ? `You have ${continueWatching.length} title${continueWatching.length > 1 ? 's' : ''} on the go.`
              : 'Nothing in progress — pick something new.'}
          </p>
        </div>
        <div className="page-head__actions">
          <Button icon={<Plus size={15} />} onClick={() => openCreateList()}>
            New list
          </Button>
          <Button variant="primary" icon={<Clapperboard size={15} />} onClick={() => router.push('/discover')}>
            Discover
          </Button>
        </div>
      </header>

      <div className="grid grid--stats">
        <Stat label="Titles tracked" value={stats?.titles ?? 0} icon={<ListVideo />} />
        <Stat label="Episodes watched" value={stats?.episodes ?? 0} icon={<PlayCircle />} />
        <Stat label="Hours" value={hours} icon={<Timer />} foot={`${(stats?.minutes ?? 0).toLocaleString()} minutes`} />
        <Stat
          label="Day streak"
          value={stats?.streak ?? 0}
          icon={<Flame />}
          foot={stats?.avgRating ? `Avg rating ${stats.avgRating.toFixed(1)}/10` : undefined}
        />
      </div>

      <div className="grid--dash">
        <div className="stack gap-6">
          <section className="reveal">
            <div className="section-head">
              <h2>
                <PlayCircle /> Continue watching
              </h2>
              <Button variant="ghost" size="sm" onClick={() => router.push('/lists')}>
                All lists <ArrowRight size={14} />
              </Button>
            </div>
            {loadingLists ? (
              <div className="grid grid--posters">
                {Array.from({ length: 5 }, (_, i) => (
                  <div key={i} className="skeleton" style={{ aspectRatio: '2/3' }} />
                ))}
              </div>
            ) : continueWatching.length === 0 ? (
              <Empty icon={<PlayCircle size={22} />} title="Nothing in progress">
                Start a series or mark a film watched and it will show up here.
              </Empty>
            ) : (
              <div className="grid grid--posters">
                {continueWatching.map(({ item, pct }, i) => (
                  <Poster
                    key={item.id}
                    item={item}
                    progress={pct}
                    priority={i === 0}
                    footer={
                      <div className="stack gap-1">
                        <div className="truncate" style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                          {item.title}
                        </div>
                        <ProgressBar value={pct} label={`${item.title} progress`} />
                      </div>
                    }
                  />
                ))}
              </div>
            )}
          </section>

          <section className="reveal">
            <div className="section-head">
              <h2>
                <ListVideo /> Up next
              </h2>
            </div>
            {upNext.length === 0 ? (
              <Empty icon={<ListVideo size={22} />} title="Your watchlist is empty">
                Add something from Discover and it will appear here.
              </Empty>
            ) : (
              <div className="grid grid--posters">
                {upNext.map((item) => {
                  const p = progressFor(item);
                  return <Poster key={item.id} item={item} watched={p.watched} progress={p.pct} />;
                })}
              </div>
            )}
          </section>

          <section className="reveal">
            <div className="section-head">
              <h2>
                <CalendarDays /> Watch activity
              </h2>
              <Chip tone="accent">
                <Flame size={12} /> {stats?.streak ?? 0} day streak
              </Chip>
            </div>
            <Panel>
              <Heatmap events={stats?.heatmap ?? []} />
            </Panel>
          </section>
        </div>

        <div className="stack gap-5">
          <Panel
            title="Pinned lists"
            icon={<ListVideo size={16} />}
            actions={
              <Button variant="ghost" size="sm" onClick={() => router.push('/lists')}>
                Manage
              </Button>
            }
            flush
          >
            <div className="stack gap-1" style={{ padding: 'var(--space-2)' }}>
              {loadingLists && <Skeleton h={40} />}
              {!loadingLists && lists.length === 0 && (
                <Empty title="No lists yet" icon={<ListVideo size={20} />} />
              )}
              {lists.slice(0, 6).map((l) => (
                <Link key={l.id} href={`/lists/${l.id}`} className="list-row">
                  <span className="grow truncate">{titleCase(l.name)}</span>
                  <Chip>{(l.movie_count ?? 0) + (l.show_count ?? 0)}</Chip>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel
            title="Your clubs"
            icon={<Users size={16} />}
            actions={
              <Button variant="ghost" size="sm" onClick={() => router.push('/clubs')}>
                Browse
              </Button>
            }
            flush
          >
            <div className="stack gap-1" style={{ padding: 'var(--space-2)' }}>
              {clubs.length === 0 && <Empty title="Not in a club yet" icon={<Users size={20} />} />}
              {clubs.map((c) => (
                <Link key={c.id} href={`/clubs/${c.id}`} className="list-row">
                  <Avatar src={c.image_url} name={c.name} size={28} />
                  <span className="grow truncate">{c.name}</span>
                  <span className="faint" style={{ fontSize: 'var(--text-xs)' }}>
                    {c.member_count}
                  </span>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel
            title="Recent activity"
            icon={<ActivityIcon size={16} />}
            actions={
              <Button variant="ghost" size="sm" onClick={() => router.push('/activity')}>
                All
              </Button>
            }
            flush
          >
            <div className="stack" style={{ padding: 'var(--space-2)' }}>
              {feed.length === 0 && <Empty title="Quiet around here" icon={<ActivityIcon size={20} />} />}
              {feed.slice(0, 8).map((a) => (
                <ActivityRow key={a.id} activity={a} />
              ))}
            </div>
          </Panel>

          {!!stats?.topGenres?.length && (
            <Panel title="Your genres" icon={<Star size={16} />}>
              <div className="stack gap-3">
                {stats.topGenres.map((g) => (
                  <div key={g.name} className="stack gap-1">
                    <div className="row between" style={{ fontSize: 'var(--text-xs)' }}>
                      <span>{g.name}</span>
                      <span className="faint">{g.count}</span>
                    </div>
                    <ProgressBar
                      value={percent(g.count, stats.topGenres[0].count)}
                      label={`${g.name} share`}
                    />
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );
}

/** Activity rows link through to whatever they are about. — issue #40 */
export function ActivityRow({ activity }: { activity: Activity }) {
  const router = useRouter();
  const target = activity.actor?.username ? `/profile/${activity.actor.username}` : '/activity';
  return (
    <button className="activity-item" onClick={() => router.push(target)}>
      <Avatar
        src={activity.actor?.profile_picture}
        name={activity.actor?.nickname ?? activity.actor?.username}
        size={30}
      />
      <div className="grow" style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)' }}>
          <strong>{activity.actor?.nickname ?? activity.actor?.username ?? 'Someone'}</strong>{' '}
          <Markdown text={activity.description} className="muted" inline />
        </div>
        <div className="faint" style={{ fontSize: 'var(--text-xs)' }}>
          {activity.time_ago ?? timeAgo(activity.created_at)}
        </div>
      </div>
    </button>
  );
}
