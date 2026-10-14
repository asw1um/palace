import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity as ActivityIcon, ArrowRight, CalendarDays, Clapperboard, Flame, ListVideo,
  PlayCircle, Plus, Star, Timer, Users,
} from '@/lib/icons';
import { activity as activityApi, clubs as clubsApi, progress as progressApi, stats as statsApi } from '@/data/api';
import type { Activity, Club, UpcomingEpisode, UserStats } from '@/data/types';
import { useAuth } from '@/data/AuthContext';
import { useAppData } from '@/components/AppData';
import { Poster } from '@/components/Poster';
const Heatmap = dynamic(() => import('@/components/Heatmap').then(m => ({ default: m.Heatmap })), { ssr: false });
import { Panel, Avatar, Chip, Empty, Skeleton, Stat, ProgressBar } from '@/components/ui/Bits';
import { Button } from '@/components/ui/Button';
import { Markdown } from '@/components/Markdown';
import { useBus } from '@/lib/bus';
import { fullRows, useGridColumns } from '@/lib/hooks';
import { percent, runtime as fmtRuntime, titleCase, timeAgo } from '@/lib/format';
import { episodeLabel, type SeasonInfo } from '@/lib/episodes';
/** "Today", "Tomorrow", "in 4 days", then a date once it's more than a week out. */
function airsIn(iso: string): string {
  const day = new Date(`${iso}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 7) return `in ${days} days`;
  return day.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const { user } = useAuth();
  const { lists, loadingLists, progress, progressFor, nextFor, openCreateList, openMedia } = useAppData();
  const router = useRouter();
  const [feed, setFeed] = useState<Activity[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingEpisode[]>([]);

  const load = () => {
    activityApi.feed('global', 12).then(setFeed).catch(() => {});
    clubsApi.all().then((r) => setClubs(r.my_clubs)).catch(() => {});
    if (user) statsApi.forUser(user.id).then(setStats).catch(() => {});
  };

  useEffect(load, [user?.id]);

  // Air dates only depend on which series are in the lists, so reload with those.
  useEffect(() => {
    if (user) progressApi.upcoming().then(setUpcoming).catch(() => {});
  }, [user?.id, lists.length]);
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

  /** "Next: S2 E5 · 23m in" for a series, "47m left" for a film. */
  const resumeLabel = (item: { tmdb_id: number; media_type: 'movie' | 'tv'; seasons?: SeasonInfo[] }) => {
    if (item.media_type === 'tv') {
      const next = nextFor(item);
      if (!next) return '';
      return `Next: ${episodeLabel(next)}${next.minutes ? ` · ${next.minutes}m in` : ''}`;
    }
    const entry = progress[`movie:${item.tmdb_id}`];
    return entry?.total ? `${fmtRuntime(entry.total - entry.minutes)} left` : '';
  };

  // Lists pinned on the My Lists page; until some are, the panel shows the first few lists.
  const pinnedLists = useMemo(
    () => lists.filter((l) => user?.pinned_list_ids?.includes(l.id)),
    [lists, user?.pinned_list_ids],
  );

  const [upNextRef, upNextCols] = useGridColumns(5);

  const upNext = useMemo(() => {
    const list = lists.find((l) => /^want to watch$/i.test(l.name)) ?? lists[0];
    // A preview of the watchlist: up to two whole rows, never a part-filled one.
    const items = list?.items ?? [];
    return items.slice(0, fullRows(items.length, upNextCols, 2));
  }, [lists, upNextCols]);


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
                Start a series, or stop a film partway through, and it will show up here.
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
                        <div className="truncate faint" style={{ fontSize: 'var(--text-xs)' }}>
                          {resumeLabel(item)}
                        </div>
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
              <div className="grid grid--posters" ref={upNextRef}>
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
          {upcoming.length > 0 && (
            <Panel title="Upcoming episodes" icon={<CalendarDays size={16} />} flush>
              <div className="stack gap-1" style={{ padding: 'var(--space-2)' }}>
                {upcoming.slice(0, 6).map((e) => (
                  <button
                    key={e.show_id}
                    className="list-row"
                    style={{ textAlign: 'left', width: '100%' }}
                    onClick={() => openMedia({ tmdb_id: e.show_id, media_type: 'tv', title: e.title, poster_url: e.poster_url })}
                  >
                    <span className="grow" style={{ minWidth: 0 }}>
                      <span className="truncate" style={{ display: 'block', fontWeight: 600 }}>{e.title}</span>
                      <span className="truncate faint" style={{ display: 'block', fontSize: 'var(--text-xs)' }}>
                        S{e.season_number} E{e.episode_number}{e.name ? ` · ${e.name}` : ''}
                      </span>
                    </span>
                    <Chip>{airsIn(e.air_date)}</Chip>
                  </button>
                ))}
              </div>
            </Panel>
          )}

          <Panel
            title={pinnedLists.length ? 'Pinned lists' : 'Your lists'}
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
              {(pinnedLists.length ? pinnedLists : lists.slice(0, 6)).map((l) => (
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
/**
 * The row already leads with the person's current name. Some stored descriptions
 * start with the name they had at the time ("Mira reviewed Heat") and others with
 * a capitalised verb ("Created club: X"), so trim both down to just the action.
 */
const NAMED_ACTION = /(joined the forum|created list:|reviewed|updated their review|changed their (?:profile picture|banner))/;

function actionText(description: string): string {
  const named = description.match(NAMED_ACTION);
  if (named?.index) return description.slice(named.index);
  return description.charAt(0).toLowerCase() + description.slice(1);
}

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
          <Markdown text={actionText(activity.description)} className="muted" inline />
        </div>
        <div className="faint" style={{ fontSize: 'var(--text-xs)' }}>
          {activity.time_ago ?? timeAgo(activity.created_at)}
        </div>
      </div>
    </button>
  );
}
