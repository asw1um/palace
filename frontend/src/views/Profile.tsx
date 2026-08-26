import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import {
  CalendarDays, Camera, Flame, ListVideo, Pencil, PlayCircle, Star, Timer,
} from '@/lib/icons';
import { toast } from 'sonner';
import { auth as authApi, people as peopleApi, reviews as reviewsApi, stats as statsApi } from '@/data/api';
import type { Review, User, UserStats } from '@/data/types';
import { useAuth } from '@/data/AuthContext';
import { useAppData } from '@/components/AppData';
const Heatmap = dynamic(() => import('@/components/Heatmap').then(m => ({ default: m.Heatmap })), { ssr: false });
import { ReviewCard } from '@/components/MediaModal';
import { Poster } from '@/components/Poster';
import { Button } from '@/components/ui/Button';
import { Field, Input, Textarea } from '@/components/ui/Field';
import { Avatar, Chip, Empty, Panel, Skeleton, Stat, Tabs } from '@/components/ui/Bits';
import { Modal } from '@/components/ui/Modal';
import { titleCase, timeAgo } from '@/lib/format';
import { useLocalState } from '@/lib/hooks';

type Tab = 'overview' | 'lists' | 'reviews';

export default function Profile() {
  const { username: usernameParam } = useParams();
  const username = typeof usernameParam === 'string' ? usernameParam : '';
  const { user: me, patchUser } = useAuth();
  const { lists, progressFor } = useAppData();
  const [profile, setProfile] = useState<User | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [rows, setRows] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [pinnedLists] = useLocalState<number[]>('palace.pinnedLists', []);
  const avatarInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  const isMe = !!me && (me.username === username || !username);

  const load = () => {
    setLoading(true);
    peopleApi
      .one(username ?? me?.username ?? '')
      .then(async (u) => {
        setProfile(u);
        if (u) {
          setStats(await statsApi.forUser(u.id).catch(() => null));
          setRows(await reviewsApi.byUser(u.id).catch(() => []));
        }
      })
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  };

  useEffect(load, [username, me?.username]);

  const myLists = useMemo(
    () => (isMe ? lists : []),
    [isMe, lists],
  );

  const pinned = useMemo(
    () => myLists.filter((l) => pinnedLists.includes(l.id)),
    [myLists, pinnedLists],
  );

  if (loading && !profile) {
    return (
      <div className="stack gap-4">
        <Skeleton h={180} r="var(--r-lg)" />
        <Skeleton h={90} r="var(--r-md)" />
      </div>
    );
  }

  if (!profile) return <Empty title="Profile not found" />;

  const saveProfile = async () => {
    const updated = await authApi.updateProfile({ nickname: nickname.trim(), bio: bio.trim() });
    patchUser(updated);
    setProfile(updated);
    setEditing(false);
    toast.success('Profile updated');
  };

  const upload = async (file: File | undefined, kind: 'avatar' | 'banner') => {
    if (!file) return;
    const url = kind === 'avatar' ? await authApi.uploadPicture(file) : await authApi.uploadBanner(file);
    patchUser(kind === 'avatar' ? { profile_picture: url } : { banner: url });
    setProfile((p) =>
      p ? { ...p, ...(kind === 'avatar' ? { profile_picture: url } : { banner: url }) } : p,
    );
    toast.success(kind === 'avatar' ? 'Avatar updated' : 'Banner updated');
  };

  const hours = Math.round((stats?.minutes ?? 0) / 60);

  return (
    <>
      <section className="panel" style={{ overflow: 'hidden' }}>
        <div
          style={{
            position: 'relative',
            height: 168,
            background: profile.banner
              ? `url(${profile.banner}) center/cover`
              : 'var(--accent-soft)',
          }}
        >
          {isMe && (
            <Button
              size="sm"
              variant="ghost"
              icon={<Camera size={14} />}
              style={{ position: 'absolute', right: 12, top: 12, background: 'rgba(0,0,0,.4)', color: '#fff' }}
              onClick={() => bannerInput.current?.click()}
            >
              Banner
            </Button>
          )}
        </div>

        <div className="row gap-4 wrap" style={{ padding: 'var(--space-5)', marginTop: -46 }}>
          <div style={{ position: 'relative' }}>
            <Avatar
              src={profile.profile_picture}
              name={profile.nickname ?? profile.username}
              size={92}
            />
            {isMe && (
              <button
                className="icon-btn"
                aria-label="Change avatar"
                style={{ position: 'absolute', right: -4, bottom: -4 }}
                onClick={() => avatarInput.current?.click()}
              >
                <Camera size={14} />
              </button>
            )}
          </div>

          <div className="grow" style={{ minWidth: 220, marginTop: 'var(--space-6)' }}>
            <h1>{profile.nickname ?? profile.username}</h1>
            <div className="faint" style={{ fontSize: 'var(--text-sm)' }}>
              @{profile.username}
              {profile.created_at ? ` · joined ${timeAgo(profile.created_at)}` : ''}
            </div>
            <p className="muted" style={{ marginTop: 'var(--space-2)', maxWidth: '68ch' }}>
              {profile.bio || 'No bio yet.'}
            </p>
          </div>

          {isMe && (
            <div style={{ marginTop: 'var(--space-6)' }}>
              <Button
                icon={<Pencil size={15} />}
                onClick={() => {
                  setNickname(profile.nickname ?? '');
                  setBio(profile.bio ?? '');
                  setEditing(true);
                }}
              >
                Edit profile
              </Button>
            </div>
          )}
        </div>

        <input ref={avatarInput} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0], 'avatar')} />
        <input ref={bannerInput} type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files?.[0], 'banner')} />
      </section>

      <div className="grid grid--stats">
        <Stat label="Titles" value={stats?.titles ?? 0} icon={<ListVideo />} />
        <Stat label="Episodes" value={stats?.episodes ?? 0} icon={<PlayCircle />} />
        <Stat label="Hours" value={hours} icon={<Timer />} />
        <Stat
          label="Reviews"
          value={stats?.reviews ?? 0}
          icon={<Star />}
          foot={stats?.avgRating ? `Avg ${stats.avgRating.toFixed(1)}/10` : undefined}
        />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview' },
          ...(isMe ? [{ value: 'lists' as Tab, label: 'Lists', count: myLists.length }] : []),
          { value: 'reviews', label: 'Reviews', count: rows.length },
        ]}
      />

      {tab === 'overview' && (
        <div className="stack gap-6">
          <Panel title="Watch activity" icon={<CalendarDays size={16} />}>
            <Heatmap events={stats?.heatmap ?? []} />
          </Panel>

          {isMe && pinned.length > 0 && (
            <section>
              <div className="section-head">
                <h2>
                  <ListVideo /> Pinned lists
                </h2>
              </div>
              <div className="stack gap-6">
                {pinned.map((l) => (
                  <div key={l.id}>
                    <div className="row gap-2" style={{ marginBottom: 'var(--space-2)' }}>
                      <strong>{titleCase(l.name)}</strong>
                      <Chip>{(l.movie_count ?? 0) + (l.show_count ?? 0)}</Chip>
                    </div>
                    <div className="rail no-scrollbar">
                      {(l.items ?? []).slice(0, 12).map((item) => {
                        const p = progressFor(item);
                        return <Poster key={item.id} item={item} watched={p.watched} progress={p.pct} />;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!!stats?.topGenres?.length && (
            <Panel title="Most watched genres" icon={<Flame size={16} />}>
              <div className="row gap-2 wrap">
                {stats.topGenres.map((g) => (
                  <Chip key={g.name} tone="accent">
                    {g.name} · {g.count}
                  </Chip>
                ))}
              </div>
            </Panel>
          )}

          <section>
            <div className="section-head">
              <h2>
                <Star /> Latest reviews
              </h2>
            </div>
            {rows.length === 0 ? (
              <Empty title="No reviews yet" icon={<Star size={20} />} />
            ) : (
              <div className="stack gap-3">
                {rows.slice(0, 3).map((r) => (
                  <ProfileReview key={r.id} review={r} onChanged={load} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'lists' && (
        <div className="stack gap-6">
          {myLists.length === 0 && <Empty title="No lists yet" icon={<ListVideo size={20} />} />}
          {myLists.map((l) => (
            <section key={l.id}>
              <div className="section-head">
                <h2>{titleCase(l.name)}</h2>
                <Chip>{(l.movie_count ?? 0) + (l.show_count ?? 0)} titles</Chip>
              </div>
              {(l.items ?? []).length === 0 ? (
                <Panel>
                  <p className="faint">Empty.</p>
                </Panel>
              ) : (
                <div className="rail no-scrollbar">
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

      {tab === 'reviews' && (
        <div className="stack gap-3">
          {rows.length === 0 && <Empty title="No reviews yet" icon={<Star size={20} />} />}
          {rows.map((r) => (
            <ProfileReview key={r.id} review={r} onChanged={load} />
          ))}
        </div>
      )}

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit profile"
        width={460}
        footer={
          <>
            <Button onClick={() => setEditing(false)}>Cancel</Button>
            <Button variant="primary" onClick={saveProfile}>
              Save
            </Button>
          </>
        }
      >
        <div className="stack gap-4">
          <Field label="Display name">
            <Input value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </Field>
          <Field label="Bio" hint="Markdown works here too.">
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </>
  );
}

/** A review on a profile shows what it is about and opens that title. — issue #115 */
function ProfileReview({ review, onChanged }: { review: Review; onChanged: () => void }) {
  const { openMedia } = useAppData();
  return (
    <div className="stack gap-2">
      {review.title && (
        <button
          className="row gap-2"
          onClick={() =>
            openMedia({
              tmdb_id: review.tmdb_id,
              media_type: review.media_type,
              title: review.title!,
              poster_url: review.poster_url ?? null,
            })
          }
        >
          <div
            style={{
              width: 28, height: 42, borderRadius: 'var(--r-sm)', overflow: 'hidden',
              background: 'var(--bg-subtle)', flexShrink: 0,
            }}
          >
            {review.poster_url && (
              <Image src={review.poster_url} alt="" width={28} height={42} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )}
          </div>
          <span style={{ fontWeight: 650, fontSize: 'var(--text-sm)' }}>{review.title}</span>
          <Chip>{review.media_type === 'tv' ? 'Series' : 'Film'}</Chip>
        </button>
      )}
      <ReviewCard review={review} onChanged={onChanged} />
    </div>
  );
}
