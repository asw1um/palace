import { useState, useEffect } from 'react';
import { Star, Trash2, MessageSquare } from 'lucide-react';
import { upsertReview, deleteReview, getMyReview, getTitleReviews } from '@/api/reviews';
import type { Review } from '@/api/reviews';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Props {
  tmdbId: number;
  mediaType: string;
  title: string;
  posterUrl?: string | null;
}

function StarRow({ value, onChange, readonly }: { value: number | null; onChange?: (v: number) => void; readonly?: boolean }) {
  const [hover, setHover] = useState<number | null>(null);
  const display = hover ?? value ?? 0;
  return (
    <div style={{ display: 'flex', gap: '3px' }}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          disabled={readonly}
          onClick={() => onChange?.(star === value ? 0 : star)}
          onMouseEnter={() => !readonly && setHover(star)}
          onMouseLeave={() => setHover(null)}
          style={{ background: 'none', border: 'none', padding: '2px', cursor: readonly ? 'default' : 'pointer', lineHeight: 0 }}
        >
          <Star
            style={{
              width: '18px', height: '18px',
              color: display >= star ? '#ffd700' : 'rgba(255,255,255,0.2)',
              fill: display >= star ? '#ffd700' : 'none',
              transition: 'color 0.1s, fill 0.1s',
            }}
          />
        </button>
      ))}
      {value !== null && value !== undefined && value > 0 && (
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginLeft: '4px', alignSelf: 'center' }}>{value}/5</span>
      )}
    </div>
  );
}

export default function ReviewPanel({ tmdbId, mediaType, title, posterUrl }: Props) {
  const { user } = useAuth();
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [tab, setTab] = useState<'mine' | 'all'>('mine');
  const [rating, setRating] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);

  useEffect(() => {
    getMyReview(tmdbId, mediaType).then(r => {
      if (r) { setMyReview(r); setRating(r.rating); setContent(r.content); }
    }).catch(() => {});
  }, [tmdbId, mediaType]);

  useEffect(() => {
    if (tab === 'all') {
      setLoadingAll(true);
      getTitleReviews(tmdbId, mediaType).then(r => setAllReviews(r)).catch(() => {}).finally(() => setLoadingAll(false));
    }
  }, [tab, tmdbId, mediaType]);

  const handleSave = async () => {
    if (!rating && !content.trim()) return;
    setSaving(true);
    try {
      const saved = await upsertReview({ tmdb_id: tmdbId, media_type: mediaType, title, poster_url: posterUrl || '', rating, content });
      setMyReview(saved);
      toast.success('Review saved');
    } catch { /* handled by interceptor */ }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!myReview) return;
    try {
      await deleteReview(myReview.id);
      setMyReview(null); setRating(null); setContent('');
      toast.success('Review deleted');
    } catch { /* handled */ }
  };

  const displayName = (u: Review['author']) => u?.nickname || u?.username || 'User';

  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden', marginTop: '8px' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {(['mine', 'all'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '10px', background: tab === t ? 'var(--t-primary-15)' : 'transparent', border: 'none', borderBottom: tab === t ? '2px solid var(--t-primary)' : '2px solid transparent', color: tab === t ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
            {t === 'mine' ? 'My Review' : 'Palace Reviews'}
          </button>
        ))}
      </div>

      <div style={{ padding: '14px' }}>
        {tab === 'mine' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <StarRow value={rating} onChange={setRating} />
              {myReview && (
                <button onClick={handleDelete} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(220,60,60,0.7)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                  <Trash2 style={{ width: '13px' }} /> Delete
                </button>
              )}
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write a review (optional)..."
              rows={3}
              style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: '#fff', fontSize: '12px', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--t-primary)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            />
            <button
              onClick={handleSave}
              disabled={saving || (!rating && !content.trim())}
              style={{ padding: '8px 16px', borderRadius: '8px', background: saving ? 'rgba(255,255,255,0.08)' : 'var(--t-primary-25)', border: '1px solid var(--t-primary-40)', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'inherit', alignSelf: 'flex-start', opacity: (!rating && !content.trim()) ? 0.4 : 1 }}
            >
              {saving ? 'Saving...' : myReview ? 'Update Review' : 'Save Review'}
            </button>
          </div>
        )}

        {tab === 'all' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
            {loadingAll && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '16px' }}>Loading...</div>}
            {!loadingAll && allReviews.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px', color: 'rgba(255,255,255,0.3)', gap: '6px' }}>
                <MessageSquare style={{ width: '20px' }} />
                <span style={{ fontSize: '12px' }}>No reviews yet — be the first!</span>
              </div>
            )}
            {allReviews.map(r => (
              <div key={r.id} style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {r.author?.profile_picture ? (
                      <img src={r.author.profile_picture} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--t-primary-25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#fff' }}>
                        {displayName(r.author).slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>{displayName(r.author)}</span>
                    {r.user_id === user?.id && <span style={{ fontSize: '10px', color: 'var(--t-primary)', fontWeight: 600 }}>You</span>}
                  </div>
                  {r.rating !== null && <StarRow value={r.rating} readonly />}
                </div>
                {r.content && <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, margin: 0 }}>{r.content}</p>}
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '6px' }}>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
