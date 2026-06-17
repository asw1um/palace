import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { get_user } from '@/api/users';
import { get_user_activity_by_id } from '@/api/activity';
import { get_user_reviews } from '@/api/reviews';
import type { Review } from '@/api/reviews';
import { Users, Calendar, Star } from 'lucide-react';
import GlassBox from '@/components/GlassBox';
import Poster from '@/components/Poster';
import type { User, List, Club, Activity } from '@/types/api';
import { useTheme } from '@/data/ThemeContext';
import { THEMES } from '@/data/themeStore';
import { ReviewContentRenderer } from '@/utils/markdownParser';
import MediaDetailModal from '@/components/MediaDetailModal';
import ShowDetailModal from '@/components/ShowDetailModal';
import { get_movie_details, get_tv_details } from '@/api/search';
import { useSearchParams } from 'react-router-dom';
import type { TMDBResult } from '@/types/api';

function userGradient(nickname: string) {
  const hash = nickname.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hues = [200, 220, 240, 180, 260, 210, 230, 190];
  const hue1 = hues[hash % hues.length];
  return `linear-gradient(135deg, hsl(${hue1}, 60%, 45%), hsl(${(hue1 + 30) % 360}, 50%, 30%))`;
}

function userBannerGradient(nickname: string) {
  const hash = nickname.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hues = [210, 230, 200, 250, 190, 240, 220, 180];
  const hue1 = hues[hash % hues.length];
  return `linear-gradient(135deg, hsl(${hue1}, 55%, 30%), hsl(${(hue1 + 40) % 360}, 50%, 22%))`;
}

function clubGradient(name: string) {
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const hues = [200, 240, 260, 180, 210, 220, 190, 230];
  const h1 = hues[hash % hues.length];
  return `linear-gradient(135deg, hsl(${h1}, 55%, 30%), hsl(${(h1 + 40) % 360}, 50%, 22%))`;
}

export default function UserProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<{ user: User; lists: List[]; clubs: Club[] } | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const { themeId } = useTheme(); // Use whatever theme hook or state your profile uses
  const activeTheme = THEMES.find(t => t.id === themeId) ?? THEMES[0];
  const themeColor = activeTheme.primary; // This creates the 'themeColor' variable
  const [selectedItem, setSelectedItem] = useState<TMDBResult | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
  const shouldOpen = searchParams.get('mediaModal') === 'true';
  const id = searchParams.get('id');
  const type = searchParams.get('type');
  if (!shouldOpen || !id || !type) return;

  const fetcher = type === 'tv' ? get_tv_details : get_movie_details;
  fetcher(Number(id)).then(data => { if (data) setSelectedItem(data); }).catch(() => {});
}, [searchParams]);

  const closeModal = () => {
    setSelectedItem(null);
    searchParams.delete('mediaModal');
    searchParams.delete('id');
    searchParams.delete('type');
    searchParams.delete('tab');
    setSearchParams(searchParams, { replace: true });
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const profileData = await get_user(username!).catch(() => null as any);
        if (!profileData) {
          if (!cancelled) { setProfile(null); setLoading(false); }
          return;
        }
        const user_id = profileData.user.id;
        const [activityData, reviewData] = await Promise.all([
          get_user_activity_by_id(user_id, 20).catch(() => []),
          get_user_reviews(user_id).catch(() => []),
        ]);
        if (!cancelled) {
          setProfile(profileData);
          setActivities(activityData);
          setReviews(reviewData);
        }
      } catch {
        if (!cancelled) setProfile(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (username) load();
    return () => { cancelled = true; };
  }, [username]);

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Loading...</div>;
  if (!profile) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>User not found</div>;

  const user = profile.user;
  const user_lists = profile.lists;
  const user_clubs = profile.clubs;
  const display_name = user.nickname || user.username || 'User';

  return (
    <div style={{ height: '100%', overflowY: 'auto',padding: '0 16px 16px 12px', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'start', width: '100%' }}>

        {/* ===== LEFT COLUMN ===== */}
        <div style={{ flex: '1 1 320px', minWidth: 0, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Profile card */}
          <div style={{
            background: 'linear-gradient(180deg, var(--t-primary-18) 0%, var(--t-primary-10) 100%)',
            border: '1px solid var(--t-primary-25)',
            borderRadius: '16px',
            overflow: 'hidden',
            backdropFilter: 'blur(20px)',
          }}>
            {/* Banner */}
            <div style={{
              width: '100%', height: '130px',
              background: user.banner ? `url(${user.banner}) center/cover no-repeat` : userBannerGradient(display_name),
              position: 'relative', flexShrink: 0,
            }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.35) 100%)', pointerEvents: 'none' }} />
            </div>

            {/* Avatar */}
            <div style={{ position: 'relative', marginTop: '-54px', padding: '0 18px' }}>
              {user.profile_picture ? (
                <div className="avatar-circle" style={{ width: '108px', height: '108px', boxShadow: '0 0 0 5px rgba(255,255,255,0.12), 0 8px 24px rgba(0,0,0,0.5)' }}>
                  <img src={user.profile_picture} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              ) : (
                <div className="avatar-circle" style={{ width: '108px', height: '108px', background: userGradient(display_name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', fontWeight: 700, color: '#fff', boxShadow: '0 0 0 5px rgba(255,255,255,0.12), 0 8px 24px rgba(0,0,0,0.5)' }}>
                  {display_name.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>

            <div style={{ padding: '10px 18px 0' }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff' }}>{display_name}</div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>@{user.username || user.nickname || 'user'}</div>
            </div>

            {user.bio && (
              <div style={{ padding: '12px 18px 0' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '6px' }}>About Me</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>{user.bio}</div>
              </div>
            )}

            <div style={{ padding: '14px 18px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '6px' }}>Member Since</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar style={{ width: '13px', color: 'rgba(255,255,255,0.45)' }} />
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>
                  {user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', borderTop: '1px solid var(--t-primary-15)' }}>
              {[{ label: 'Lists', value: user_lists.length }, { label: 'Clubs', value: user_clubs.length }].map((s, i) => (
                <div key={s.label} style={{ flex: 1, textAlign: 'center', padding: '12px 0', borderRight: i === 0 ? '1px solid var(--t-primary-15)' : 'none' }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>{s.value}</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '2px' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity box */}
          <GlassBox title="Activity" collapsible defaultCollapsed={false} rightAction={<span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: 0, textTransform: 'none' }}>{activities.length}</span>}>
            {activities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>No activity yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '156px', overflowY: 'auto' }}>
                {activities.map(act => (
                  <div key={act.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: userGradient(display_name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {display_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{act.description}</div>
                    </div>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>{act.time_ago}</span>
                  </div>
                ))}
              </div>
            )}
          </GlassBox>

          {/* Clubs box */}
          <GlassBox title="Clubs" collapsible defaultCollapsed={false} rightAction={<span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', letterSpacing: 0, textTransform: 'none' }}>{user_clubs.length}</span>}>
            {user_clubs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.35)', fontSize: '13px' }}>No clubs yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '168px', overflowY: 'auto' }}>
                {user_clubs.map(club => (
                  <div key={club.id} onClick={() => navigate(`/clubs/${club.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'var(--t-primary-30)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: club.image_url ? `url(${club.image_url}) center/cover` : clubGradient(club.name), border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                      {!club.image_url && <Users style={{ width: '16px', color: 'rgba(255,255,255,0.5)' }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{club.name}</div>
                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '1px' }}>{club.member_count} members</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassBox>
        </div>

        {/* ===== RIGHT COLUMN ===== */}
       <div style={{ flex: '1 1 320px', minWidth: 0, maxWidth: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>

          {/* Reviews */}
          <GlassBox title={`Reviews · ${reviews.length}`} collapsible defaultCollapsed={false}>
            {reviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>No reviews yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                {reviews.map(r => {
                  const mediaType = r.media_type === 'show' || r.media_type === 'tv' ? 'tv' : 'movie';
                  const targetId = r.tmdb_id || r.id;

                  return (
                    <div 
                      key={r.id} 
                      onClick={() => setSearchParams({ mediaModal: 'true', id: String(targetId), type: mediaType, tab: 'reviews' })}
                      style={{ display: 'flex', gap: '12px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                    >
                      {r.poster_url
                        ? <img src={r.poster_url} alt="" style={{ width: '40px', height: '60px', borderRadius: '5px', objectFit: 'cover', flexShrink: 0 }} />
                        : <div style={{ width: '40px', height: '60px', borderRadius: '5px', background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />
                      }
                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                        {r.rating !== null && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} style={{ width: '12px', height: '12px', color: (r.rating ?? 0) >= s ? '#ffd700' : 'rgba(255,255,255,0.18)', fill: (r.rating ?? 0) >= s ? '#ffd700' : 'none' }} />
                            ))}
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginLeft: '3px' }}>{r.rating}/5</span>
                          </div>
                        )}
                        {r.content && (
                          <div 
                            style={{ 
                              fontSize: '12px', 
                              color: 'rgba(255,255,255,0.55)', 
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              overflowWrap: 'break-word',
                              wordBreak: 'normal'
                            }}
                          >
                            <ReviewContentRenderer text={r.content} themeColor={themeColor} />
                          </div>
                        )}
                        <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)' }}>{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      </div>
                    </div>
                  );
                  
                })}
              </div>
            )}
</GlassBox>

          <h2 style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '2px', textTransform: 'uppercase', margin: 0 }}>Lists · {user_lists.length}</h2>

          {user_lists.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'rgba(255,255,255,0.3)', fontSize: '13px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '12px' }}>No lists yet</div>
          ) : (
            user_lists.map(list => {
              const allItems = [...(list.movies || []), ...(list.shows || [])];
              return (
                <GlassBox
                  key={list.id}
                  collapsible
                  defaultCollapsed={false}
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <span>{list.name}</span>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', background: 'rgba(0,0,0,0.15)', padding: '2px 8px', borderRadius: '8px', letterSpacing: 0, textTransform: 'none', fontWeight: 400 }}>
                        {(list.movie_count || 0) + (list.show_count || 0)} titles
                      </span>
                    </div>
                  }
                >
                  {allItems.length > 0 ? (
                    <div onClick={() => navigate(`/lists/${list.id}`, { state: { fromUser: username } })} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: '6px' }}>
                        {allItems.map(item => (
                          <div key={item.id} style={{ minWidth: 0 }}>
                            <Poster poster_url={item.poster_url} style={{ borderRadius: '6px' }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Empty list</div>
                  )}
                </GlassBox>
              );
            })
          )}

        </div>
      </div>
          {selectedItem && selectedItem.media_type === 'tv' ? (
      <ShowDetailModal item={selectedItem} onClose={closeModal} />
      ) : selectedItem ? (
        <MediaDetailModal item={selectedItem} onClose={closeModal} />
      ) : null}
    </div>
  );
}
