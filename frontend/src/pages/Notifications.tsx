import { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, Users, X } from 'lucide-react';
import { getNotifications, markRead, markUnread, deleteNotification, markAllRead, acceptInvite, declineInvite } from '@/api/notifications';
import type { Notification } from '@/types/api';

// create mobile support for notifications page whenever it is done

function NotifIcon({ type }: { type: string }) {
  if (type === 'club_invite') return <Users style={{ width: '16px', color: 'var(--t-primary)' }} />;
  if (type.startsWith('club_')) return <Users style={{ width: '16px', color: 'rgba(255,255,255,0.5)' }} />;
  return <Bell style={{ width: '16px', color: 'rgba(255,255,255,0.5)' }} />;
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await getNotifications();
        if (!cancelled) setNotifications(data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const interval = setInterval(() => {
      getNotifications().then(data => { if (!cancelled) setNotifications(data); }).catch(() => {});
    }, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const handleMarkRead = async (id: number) => {
    await markRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const handleMarkUnread = async (id: number) => {
    await markUnread(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: false } : n));
  };

  const handleDelete = async (id: number) => {
    await deleteNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleAccept = async (id: number) => {
    try {
      await acceptInvite(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch {}
  };

  const handleDecline = async (id: number) => {
    try {
      await declineInvite(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch {}
  };

  return (
    <div style={{ height: '100%', overflowY: 'auto', paddingRight: '8px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '36px', fontWeight: 700, color: '#fff', letterSpacing: '3px', textTransform: 'uppercase', textShadow: '0 2px 12px rgba(0,0,0,0.3)' }}>Notifications</h1>
          {unreadCount > 0 && (
            <div style={{ background: 'var(--t-primary)', color: '#fff', fontSize: '13px', fontWeight: 700, padding: '2px 10px', borderRadius: '12px', boxShadow: '0 2px 8px var(--t-primary-40)' }}>
              {unreadCount}
            </div>
          )}
        </div>
        {notifications.length > 0 && unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}
          >
            <CheckCheck style={{ width: '14px' }} /> Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>Loading...</div>
      ) : notifications.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', gap: '12px' }}>
          <Bell style={{ width: '40px', opacity: 0.25 }} />
          <div style={{ fontSize: '16px', fontWeight: 600 }}>No notifications</div>
          <div style={{ fontSize: '13px' }}>You're all caught up!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {notifications.map(notif => (
            <div
              key={notif.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '14px',
                padding: '14px 16px',
                borderRadius: '10px',
                border: notif.is_read ? '1px solid rgba(255,255,255,0.08)' : '1px solid var(--t-primary-35)',
                background: notif.is_read
                  ? 'rgba(255,255,255,0.04)'
                  : 'linear-gradient(135deg, var(--t-primary-12) 0%, var(--t-primary-08) 100%)',
                transition: 'all 0.15s',
                position: 'relative',
              }}
            >
              {/* Unread dot */}
              {!notif.is_read && (
                <div style={{ position: 'absolute', top: '16px', left: '6px', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--t-primary)', boxShadow: '0 0 6px var(--t-primary)' }} />
              )}

              {/* Icon */}
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: notif.is_read ? 'rgba(255,255,255,0.06)' : 'var(--t-primary-20)', border: `1px solid ${notif.is_read ? 'rgba(255,255,255,0.1)' : 'var(--t-primary-35)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <NotifIcon type={notif.type} />
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: notif.is_read ? 500 : 700, color: '#fff', marginBottom: '3px' }}>{notif.title}</div>
                <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.45 }}>{notif.message}</div>

                {/* Club invite actions */}
                {notif.type === 'club_invite' && (
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button onClick={() => handleAccept(notif.id)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '6px', background: 'linear-gradient(180deg, #5cb85c 0%, #449d44 100%)', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 2px 8px rgba(68,157,68,0.35)' }}>
                      <Check style={{ width: '12px' }} /> Accept
                    </button>
                    <button onClick={() => handleDecline(notif.id)} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '6px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                      <X style={{ width: '12px' }} /> Decline
                    </button>
                  </div>
                )}

                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '6px' }}>{notif.time_ago}</div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                {notif.is_read ? (
                  <button onClick={() => handleMarkUnread(notif.id)} title="Mark unread" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }} onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}>
                    <Bell style={{ width: '14px' }} />
                  </button>
                ) : (
                  <button onClick={() => handleMarkRead(notif.id)} title="Mark read" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }} onMouseEnter={e => e.currentTarget.style.color = 'var(--t-primary)'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}>
                    <Check style={{ width: '14px' }} />
                  </button>
                )}
                <button onClick={() => handleDelete(notif.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.25)', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', transition: 'color 0.15s' }} onMouseEnter={e => e.currentTarget.style.color = '#f56565'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.25)'}>
                  <Trash2 style={{ width: '14px' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
