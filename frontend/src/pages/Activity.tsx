import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { getActivity } from '@/api/activity';
import type { Activity } from '@/types/api';

export default function ActivityPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getActivity(50);
        if (!cancelled) setActivities(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const interval = setInterval(() => {
      getActivity(50).then(data => { if (!cancelled) setActivities(data); }).catch(() => {});
    }, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingRight: '8px' }}>
      <h1 style={{ fontSize: '36px', fontWeight: 700, color: '#fff', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '20px', textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>Activity</h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)' }}>Loading...</div>
      ) : activities.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', gap: '8px' }}>
          <Clock style={{ width: '32px', opacity: 0.3 }} />
          <div style={{ fontSize: '14px', fontWeight: 600 }}>No activity yet</div>
          <div style={{ fontSize: '12px' }}>Start adding movies and shows to see your activity here</div>
        </div>
      ) : (
        <div style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.08) 100%)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '10px', boxShadow: '0 6px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.2)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', background: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 100%)', borderRadius: '10px 10px 0 0', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.06)' }}>
              <Clock style={{ width: '16px', color: 'var(--t-primary)' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '2px', textTransform: 'uppercase' }}>All Activity</span>
            </div>
            {activities.map((act, i) => (
              <div key={act.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: i < activities.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none', transition: 'background 0.1s' }} onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, var(--t-primary-40), var(--t-primary-15))', border: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                  {(act.actor?.nickname ?? 'U').slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.9)' }}>{act.description}</div>
                  {act.data && typeof act.data.club_name === 'string' && (
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '3px' }}>
                      <span style={{ color: 'var(--t-primary)' }}>{act.data.club_name}</span>
                    </div>
                  )}
                </div>
                <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }}>{act.time_ago}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
