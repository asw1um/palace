import React, { useState, useEffect } from 'react';
import { Star, ThumbsUp, ThumbsDown, EyeOff, Eye } from 'lucide-react';
import { upsert_review, delete_review, get_my_review, get_title_reviews, react_to_review } from '@/api/reviews';
import type { Review } from '@/api/reviews';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/data/ThemeContext';
import { THEMES } from '@/data/themeStore';
import { toast } from 'sonner';

interface Props {
  tmdb_id: number;
  media_type: string;
  title: string;
  poster_url?: string | null;
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
          <Star style={{ width: '18px', height: '18px', color: display >= star ? '#ffd700' : 'rgba(255,255,255,0.2)', fill: display >= star ? '#ffd700' : 'none', transition: 'color 0.1s, fill 0.1s' }} />
        </button>
      ))}
      {value !== null && value !== undefined && value > 0 && (
        <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginLeft: '4px', alignSelf: 'center' }}>{value}/5</span>
      )}
    </div>
  );
}

export function InlineSpoiler({ text, themeColor }: { text: string; themeColor: string}) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      onClick={(e) => { e.stopPropagation(); setRevealed(!revealed); }}
      title={revealed ? 'Click to hide' : 'Spoiler — click to reveal'}
      style={{
        backgroundColor: revealed ? 'rgba(25,25,25,0.5)' : `linear-gradient(0deg, rgba(0,0,0,0.65), rgba(0,0,0,0.65)), linear-gradient(0deg, ${themeColor}40, ${themeColor}40)`,
        color: revealed ? 'inherit' : 'transparent',
        cursor: 'pointer',
        borderRadius: '4px',
        padding: '1px 6px',
        margin: '0 2px',
        transition: 'background-color 0.15s, color 0.15s',
        userSelect: revealed ? 'text' : 'none',
        border: '1px solid rgba(255,255,255,0.3)',
      }}
    >
      {text}
    </span>
  );
}

type RawToken = { kind: 'delim'; delim: string } | { kind: 'text'; value: string };
type Node =
  | { type: 'text';      value: string }
  | { type: 'spoiler';   children: Node[] }
  | { type: 'bold';      children: Node[] }
  | { type: 'italic';    children: Node[] }
  | { type: 'strike';    children: Node[] }
  | { type: 'underline'; children: Node[] }
  | { type: 'bolditalic'; children: Node[] };

type BranchNode = Exclude<Node, { type: 'text' }>;

const SCAN_RE = /(\\\|\||\\(?:\*\*\*|\*\*|__|\|\||[*_~])|\|\||\*\*\*|\*\*|__|~~|\*(?!\*)(?=[^*])|_(?!_)(?=[^_]))/g;
const BP: Record<string, number> = { '||': 40, '***': 35, '**': 30, '__': 20, '~~': 20, '*': 10, '_': 10 };
const DELIM_TYPE: Record<string, Node['type']> = { '||': 'spoiler', '***': 'bolditalic', '**': 'bold', '__': 'underline', '~~': 'strike', '*': 'italic', '_': 'italic' };

function lex(text: string): RawToken[] {
  const tokens: RawToken[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  SCAN_RE.lastIndex = 0;
  while ((m = SCAN_RE.exec(text)) !== null) {
    if (m.index > last) tokens.push({ kind: 'text', value: text.slice(last, m.index) });
    const raw = m[0];
    if (raw.startsWith('\\')) tokens.push({ kind: 'text', value: raw.slice(1) });
    else tokens.push({ kind: 'delim', delim: raw });
    last = m.index + raw.length;
  }
  if (last < text.length) tokens.push({ kind: 'text', value: text.slice(last) });
  return tokens;
}

function parseExpr(tokens: RawToken[], openDelim: string | null = null): Node[] {
  const nodes: Node[] = [];
  while (tokens.length > 0) {
    const tok = tokens[0];
    if (tok.kind === 'text') { tokens.shift(); nodes.push({ type: 'text', value: tok.value }); continue; }
    const delim = tok.delim;
    if (delim === openDelim) { tokens.shift(); return nodes; }
    if (openDelim && (BP[delim] ?? 0) < (BP[openDelim] ?? 0)) { tokens.shift(); nodes.push({ type: 'text', value: delim }); continue; }
    const closeIdx = tokens.findIndex((t, i) => i > 0 && t.kind === 'delim' && t.delim === delim);
    if (closeIdx === -1) { tokens.shift(); nodes.push({ type: 'text', value: delim }); continue; }
    tokens.shift();
    const children = parseExpr(tokens, delim);
    nodes.push({ type: DELIM_TYPE[delim], children } as BranchNode);
  }
  if (openDelim) nodes.unshift({ type: 'text', value: openDelim });
  return nodes;
}

function nodesToString(nodes: Node[]): string {
  return nodes.map(n => n.type === 'text' ? n.value : nodesToString((n as BranchNode).children)).join('');
}

function renderNodes(nodes: Node[], themeColor: string): React.ReactNode[] {
  return nodes.map((node, i) => {
    if (node.type === 'text') return node.value;
    const branch = node as BranchNode;
    const inner = renderNodes(branch.children, themeColor);
    switch (branch.type) {
      case 'spoiler':   return <InlineSpoiler key={i} text={nodesToString(branch.children)} themeColor={themeColor} />;
      case 'bold':      return <strong key={i} style={{ color: '#fff', fontWeight: 700 }}>{inner}</strong>;
      case 'bolditalic': return <strong key={i} style={{ color: '#fff', fontWeight: 700 }}><em style={{ fontStyle: 'italic' }}>{inner}</em></strong>;
      case 'italic':    return <em key={i} style={{ fontStyle: 'italic' }}>{inner}</em>;
      case 'strike':    return <span key={i} style={{ textDecoration: 'line-through', opacity: 0.6 }}>{inner}</span>;
      case 'underline': return <span key={i} style={{ textDecoration: 'underline' }}>{inner}</span>;
      default:           return inner;
    }
  });
}

export function ReviewContentRenderer({ text, themeColor }: { text: string; themeColor: string }) {
  if (!text) return null;
  return (
    <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5, margin: 0 }}>
      {renderNodes(parseExpr(lex(text)), themeColor)}
    </p>
  );
}

export function ReviewCard({ r, currentUserId, onReact, themeColor }: { r: Review & { is_spoiler?: boolean }; currentUserId?: number; onReact: (id: number, type: 'like' | 'dislike') => void; themeColor: string }) {
  const [revealFullSpoiler, setRevealFullSpoiler] = useState(false);
  const isReviewSpoiler = !!r.is_spoiler;
  const shouldHide = isReviewSpoiler && !revealFullSpoiler;
  const displayName = (u: Review['author']) => u?.nickname || u?.username || 'User';

  return (
    <div style={{ padding: '15px 12px 4px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {r.author?.profile_picture ? (
            <img src={r.author.profile_picture} alt="" style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--t-primary-25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#fff' }}>
              {displayName(r.author).slice(0, 2).toUpperCase()}
            </div>
          )}
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>{displayName(r.author)}</span>
          {r.user_id === currentUserId && (
            <span style={{ fontSize: '10px', color: 'var(--t-primary)', fontWeight: 600 }}>You</span>
          )}
          {isReviewSpoiler && (
            <span style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '4px', color: '#f87171', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '3px' }}>
              <EyeOff style={{ width: '10px', height: '10px' }} /> CONTAINS SPOILER
            </span>
          )}
        </div>
        {r.rating !== null && <StarRow value={r.rating} readonly />}
      </div>

      {/* Content */}
      <div style={{ margin: '14px 0 0 0' }}>
        {shouldHide ? (
          <div
            onClick={() => setRevealFullSpoiler(true)}
            style={{ padding: '12px', borderRadius: '6px', background:`linear-gradient(135deg, rgba(30, 30, 30, 0.7) 0%, ${themeColor}18 50%,rgba(30, 30, 30, 0.7) 100%)`, border: '1px dashed rgba(255,255,255,0.15)', textAlign: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', userSelect: 'none' }}
          >
            <Eye style={{ width: '13px' }} /> This review contains spoilers. Click to reveal.
          </div>
        ) : (
          <div>
            <ReviewContentRenderer text={r.content || ''} themeColor = {themeColor}/>
            {isReviewSpoiler && (
              <button
                onClick={() => setRevealFullSpoiler(false)}
                style={{ background: 'none', border: 'none', padding: 0, marginTop: '6px', color: 'rgba(255,255,255,0.3)', fontSize: '10px', cursor: 'pointer', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                <EyeOff style={{ width: '10px' }} /> Hide Spoilers
              </button>
            )}
          </div>
        )}
      </div>

{/* Footer: date + reactions */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginTop: '12px', // FIX: Pushes the row down away from the text/date above it
        marginBottom: '6px' // FIX: Pushes the row UP away from the card's bottom border
      }}>
        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>
          {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {(['like', 'dislike'] as const).map(type => {
            const active = r.reactions?.my_reaction === type;
            const count = type === 'like' ? (r.reactions?.likes ?? 0) : (r.reactions?.dislikes ?? 0);
            return (
              <button
                key={type}
                onClick={() => onReact(r.id, type)}
                style={{ 
                  height: '26px', 
                  padding: '0 12px', 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  background: active ? 'var(--t-primary-25)' : 'rgba(255,255,255,0.08)', 
                  border: `1px solid ${active ? 'var(--t-primary-40)' : 'rgba(255,255,255,0.2)'}`, 
                  borderRadius: '6px', 
                  cursor: 'pointer', 
                  color: active ? 'var(--t-primary)' : 'rgba(255,255,255,0.6)', 
                  fontSize: '11px', 
                  fontFamily: 'inherit', 
                  transition: 'all 0.15s',
                  lineHeight: 1
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', marginTop: '-1px' }}>
                  {type === 'like' ? (
                    <ThumbsUp style={{ width: '11px', height: '11px' }} />
                  ) : (
                    <ThumbsDown style={{ width: '11px', height: '11px' }} />
                  )}
                </div>
                <span>{count}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ReviewPanel({ tmdb_id, media_type, title, poster_url }: Props) {
  const { user } = useAuth();
  const { themeId} = useTheme();
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState<number | null>(null);
  const [content, setContent] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingAll, setLoadingAll] = useState(false);
  const activeTheme = THEMES.find(t => t.id === themeId) ?? THEMES[0]; 
  const themeColor = activeTheme.primary;
  const isFullWrapped = /^\|\|[\s\S]*\|\|$/.test(content.trim());

  useEffect(() => {
    get_my_review(tmdb_id, media_type).then(r => {
      if (r) {
        setMyReview(r);
        setRating(r.rating);
        setContent(r.content);
        setIsSpoiler(!!r.is_spoiler);
      }
    }).catch(() => {});
    setLoadingAll(true);
    get_title_reviews(tmdb_id, media_type)
      .then(r => setAllReviews(r))
      .catch(() => {})
      .finally(() => setLoadingAll(false));
  }, [tmdb_id, media_type]);

  const handleSave = async () => {
    if (!rating && !content.trim()) return;
    setSaving(true);


    
    const isFullWrapped = /^\|\|[\s\S]*\|\|$/.test(content.trim());
    const effectiveIsSpoiler = isSpoiler || isFullWrapped;
    const effectiveContent = effectiveIsSpoiler ? content.trim().replace(/(?<!\\)\|\|(.*?)(?<!\\)\|\|/g, '$1') : content;

    try {
      const saved = await upsert_review({ tmdb_id, media_type, title, poster_url: poster_url || '', rating, content: effectiveContent, is_spoiler: effectiveIsSpoiler });
      setMyReview(saved);
      toast.success('Review saved');
      get_title_reviews(tmdb_id, media_type).then(r => setAllReviews(r)).catch(() => {});
    } catch { /* handled by interceptor */ }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!myReview) return;
    try {
      await delete_review(myReview.id);
      setMyReview(null); setRating(null); setContent(''); setIsSpoiler(false);
      toast.success('Review deleted');
      get_title_reviews(tmdb_id, media_type).then(r => setAllReviews(r)).catch(() => {});
    } catch { /* handled */ }
  };

  const handleReact = async (review_id: number, reaction: 'like' | 'dislike') => {
    const newReaction = await react_to_review(review_id, reaction).catch(() => undefined);
    if (newReaction === undefined) return;
    setAllReviews(prev => prev.map(r => {
      if (r.id !== review_id) return r;
      const old = r.reactions ?? { likes: 0, dislikes: 0, my_reaction: null };
      const wasLike = old.my_reaction === 'like';
      const wasDislike = old.my_reaction === 'dislike';
      return {
        ...r,
        reactions: {
          likes: old.likes + (newReaction === 'like' ? 1 : wasLike ? -1 : 0),
          dislikes: old.dislikes + (newReaction === 'dislike' ? 1 : wasDislike ? -1 : 0),
          my_reaction: newReaction,
        },
      };
    }));
  };

  return (
    <div>
      {/* Write / edit review */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '10px' }}>Your Rating</div>
        <div style={{ marginBottom: '12px' }}>
          <StarRow value={rating} onChange={setRating} />
        </div>

        <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '8px' }}>Your Thoughts</div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="What did you think? Use ||text|| for inline spoilers."
          rows={3}
          style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.25)', color: '#fff', fontSize: '13px', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box', lineHeight: 1.5 }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--t-primary)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        />

        {/* Live preview */}
        {content && !isSpoiler &&  !/^\|\|[\s\S]*\|\|$/.test(content.trim()) &&(
          <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', marginBottom: '4px' }}>Preview</div>
            <ReviewContentRenderer text={content} themeColor = {themeColor} />
          </div>
        )}

        {/* Spoiler checkbox */}
        {/* <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', marginLeft: '0.5px', userSelect: 'none', opacity: isFullWrapped ? 0.5 : 1
          
         }}>
          <input
            type="checkbox"
            id="spoiler-checkbox"
            checked={isSpoiler || isFullWrapped}
            disabled={isFullWrapped}
            onChange={e => setIsSpoiler(e.target.checked)}
            style={{ cursor: isFullWrapped ? 'not-allowed' : 'pointer',
              WebkitAppearance: 'none',
              appearance: 'none',
              width: '14px',
              height: '14px',
              borderRadius: '4px',
              border: `1px solid ${(isSpoiler || isFullWrapped) ? themeColor : 'rgba(255,255,255,0.25)'}`,
              display: 'inline-grid',
              placeContent: 'center',
              transition: 'all 0.1s ease',
              color: themeColor, 
                  // 2. Theme checkmark (stroke='currentColor' pulls from the color property above)
                  background: (isSpoiler || isFullWrapped)
                    ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${themeColor.replace('#', '%23')}' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='20 6 9 17 4 12'%3E%3C/polyline%3E%3C/svg%3E") no-repeat center / 10px, rgba(255,255,255,0.04)`
                    : 'rgba(0,0,0,0.25)',
             }}
          />
          <label htmlFor="spoiler-checkbox" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', cursor: isFullWrapped ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <EyeOff style={{ width: '12px', height: '12px', color: (isSpoiler || isFullWrapped) ? '#f87171' : 'rgba(255,255,255,0.4)' }} />
            Entire review contains spoilers {isFullWrapped && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>(auto-detected)</span>}
          </label>
        </div>
         */}

         {/*using the eye and words as the checkmark*/}
         <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', marginLeft: '0.5px', userSelect: 'none', opacity: isFullWrapped ? 0.5 : 1 }}>
          {/* Interactive Eye Toggle */}
          <button
            type="button"
            disabled={isFullWrapped}
            onClick={() => setIsSpoiler(!isSpoiler)}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: isFullWrapped ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: (isSpoiler || isFullWrapped) ? '#f87171' : 'rgba(255,255,255,0.4)',
              transition: 'color 0.15s ease'
            }}
          >
            {(isSpoiler || isFullWrapped) ? (
              <EyeOff style={{ width: '16px', height: '16px' }} />
            ) : (
              <Eye style={{ width: '16px', height: '16px' }} />
            )}
          </button>

          {/* Text Label */}
          <span 
            onClick={() => !isFullWrapped && setIsSpoiler(!isSpoiler)}
            style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', cursor: isFullWrapped ? 'not-allowed' : 'pointer' }}
          >
            Entire review contains spoilers {isFullWrapped && <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>(auto-detected)</span>}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'center' }}>
          <button
            onClick={handleSave}
            disabled={saving || (!rating && !content.trim())}
            style={{ 
              padding: '11px 24px', // Increased horizontal padding from 18px to 24px
              borderRadius: '8px', 
              background: 'var(--t-primary)', 
              border: `1px solid ${themeColor}`, 
              color: '#fff', 
              fontSize: '13px', 
              fontWeight: 600, // Added bold back
              cursor: 'pointer', 
              fontFamily: 'inherit', 
              opacity: (!rating && !content.trim()) ? 0.4 : 1,
              lineHeight: 1 
            }}
          >
            {saving ? 'Saving…' : myReview ? 'Update Review' : 'Save Review'}
          </button>
          {myReview && (
            <button
              onClick={handleDelete}
              style={{ 
                padding: '12px 20px', // Increased horizontal padding from 16px to 20px
                borderRadius: '8px', 
                background: 'rgba(220,60,60,0.12)', 
                border: '1px solid rgba(220,60,60,0.25)', 
                color: '#f56565', 
                fontSize: '13px', 
                cursor: 'pointer', 
                fontFamily: 'inherit',
                lineHeight: 1 
              }}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Palace Reviews list */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '12px' }}>
          Palace Reviews {allReviews.length > 0 && <span style={{ color: 'rgba(255,255,255,0.25)', fontWeight: 400 }}>· {allReviews.length}</span>}
        </div>
        {loadingAll && (
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '20px 0' }}>Loading...</div>
        )}
        {!loadingAll && allReviews.length === 0 && (
          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '20px 0' }}>No reviews yet — be the first!</div>
        )}
        {!loadingAll && allReviews.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {allReviews.map(r => (
              <ReviewCard key={r.id} r={r} currentUserId={user?.id} onReact={handleReact} themeColor={themeColor} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}