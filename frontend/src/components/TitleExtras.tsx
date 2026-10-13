import { useEffect, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { ExternalLink, MessageSquare, Trash2 } from '@/lib/icons';
import { reviews as reviewsApi } from '@/data/api';
import type { ReviewComment, TMDBResult, WatchProviders } from '@/data/types';
import { timeAgo } from '@/lib/format';
import { useAuth } from '@/data/AuthContext';
import { Button } from './ui/Button';
import { Avatar } from './ui/Bits';
import { Input } from './ui/Field';
import type { TitleRef } from './AppData';

/* -------------------------------------------------------------------------- */
/* Where to watch                                                              */
/* -------------------------------------------------------------------------- */

function ProviderRow({ label, items }: { label: string; items: WatchProviders['stream'] }) {
  if (!items.length) return null;
  // The same service is often listed twice (e.g. with and without ads).
  const unique = items.filter((p, i) => items.findIndex((q) => q.name === p.name) === i);
  return (
    <div className="row gap-3 wrap" style={{ alignItems: 'center' }}>
      <span className="faint" style={{ width: 52, fontSize: 'var(--text-xs)' }}>{label}</span>
      {unique.map((p) => (
        <span key={p.name} className="provider" title={p.name}>
          {p.logo_url && <Image src={p.logo_url} alt="" width={22} height={22} />}
          {p.name}
        </span>
      ))}
    </div>
  );
}

export function WhereToWatch({ providers }: { providers?: WatchProviders | null }) {
  if (!providers) return null;
  const { stream, rent, buy } = providers;
  if (!stream.length && !rent.length && !buy.length) return null;
  return (
    <div>
      <div className="row between" style={{ marginBottom: 'var(--space-3)' }}>
        <div className="eyebrow">Where to watch · {providers.region}</div>
        {providers.link && (
          <a className="faint" href={providers.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--text-xs)' }}>
            All options <ExternalLink size={11} />
          </a>
        )}
      </div>
      <div className="stack gap-2">
        <ProviderRow label="Stream" items={stream} />
        <ProviderRow label="Rent" items={rent} />
        <ProviderRow label="Buy" items={buy} />
      </div>
      <div className="faint" style={{ fontSize: 'var(--text-xs)', marginTop: 'var(--space-2)' }}>
        Availability data from JustWatch.
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* More like this                                                              */
/* -------------------------------------------------------------------------- */

export function MoreLikeThis({
  items, onOpen,
}: { items?: TMDBResult['similar']; onOpen: (ref: TitleRef) => void }) {
  if (!items?.length) return null;
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>More like this</div>
      <div className="similar-row no-scrollbar">
        {items.map((s) => (
          <button
            key={`${s.media_type}-${s.id}`}
            className="similar-card"
            title={s.title}
            onClick={() =>
              onOpen({
                tmdb_id: s.id, media_type: s.media_type, title: s.title, poster_url: s.poster_url,
                release_date: s.release_date ?? undefined, rating: s.rating ?? undefined,
              })
            }
          >
            {s.poster_url && <Image src={s.poster_url} alt="" width={104} height={156} />}
            <span className="truncate">{s.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Comments under a review                                                     */
/* -------------------------------------------------------------------------- */

export function ReviewComments({
  reviewId, reviewAuthorId, count,
}: { reviewId: number; reviewAuthorId: number; count: number }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ReviewComment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open && rows === null) reviewsApi.comments(reviewId).then(setRows).catch(() => setRows([]));
  }, [open, rows, reviewId]);

  const total = rows?.length ?? count;

  const post = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const added = await reviewsApi.addComment(reviewId, text);
      setRows((prev) => [...(prev ?? []), added]);
      setDraft('');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    await reviewsApi.removeComment(id);
    setRows((prev) => (prev ?? []).filter((c) => c.id !== id));
    toast.success('Comment deleted');
  };

  return (
    <>
      <button className="chip" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <MessageSquare size={13} /> {total}
      </button>

      {open && (
        <div className="stack gap-3 review-comments">
          {rows === null && <span className="faint">Loading…</span>}
          {rows?.map((c) => (
            <div key={c.id} className="row gap-2" style={{ alignItems: 'flex-start' }}>
              <Avatar src={c.author?.profile_picture} name={c.author?.nickname ?? c.author?.username} size={24} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-xs)' }}>
                  <strong>{c.author?.nickname ?? c.author?.username ?? 'Someone'}</strong>{' '}
                  <span className="faint">{timeAgo(c.created_at)}</span>
                </div>
                <div className="muted" style={{ fontSize: 'var(--text-sm)', overflowWrap: 'anywhere' }}>
                  {c.content}
                </div>
              </div>
              {(c.user_id === user?.id || reviewAuthorId === user?.id) && (
                <Button variant="ghost" size="sm" aria-label="Delete comment" onClick={() => remove(c.id)}>
                  <Trash2 size={13} />
                </Button>
              )}
            </div>
          ))}
          {rows?.length === 0 && <span className="faint">No comments yet.</span>}
          <div className="row gap-2">
            <Input
              value={draft}
              maxLength={1000}
              placeholder="Add a comment…"
              aria-label="Add a comment"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && post()}
            />
            <Button size="sm" variant="primary" disabled={!draft.trim() || busy} onClick={post}>
              Post
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
