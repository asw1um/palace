import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, CheckCheck, Trash2, UserPlus, Users, Star, ArrowRight } from 'lucide-react';
import { notifications as notificationsApi } from '@/data/api';
import type { Notification } from '@/data/types';
import { emit } from '@/lib/bus';
import { timeAgo } from '@/lib/format';
import { Menu, type MenuPoint } from './ui/Menu';
import { Button } from './ui/Button';
import { Chip } from './ui/Bits';

const ICONS: Record<string, ReactNode> = {
  friend: <UserPlus size={15} />,
  club: <Users size={15} />,
  review: <Star size={15} />,
};

/**
 * Quick-look notifications panel hung off the top bar bell. The full page is
 * still there behind "View all" — this is just the fast path.
 */
export function NotificationsMenu({
  open, at, onClose, rows, onChanged,
}: {
  open: boolean;
  at: MenuPoint | null;
  onClose: () => void;
  rows: Notification[];
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const unread = rows.filter((n) => !n.is_read);
  const shown = [...rows]
    .sort((a, b) => Number(a.is_read) - Number(b.is_read) || +new Date(b.created_at) - +new Date(a.created_at))
    .slice(0, 6);

  const markRead = async (n: Notification) => {
    if (n.is_read) return;
    await notificationsApi.setRead(n.id, true);
    emit('notifications');
    onChanged();
  };

  return (
    <Menu open={open} at={at} onClose={onClose} width={382} align="end">
      <div className="notif-menu">
        <header className="notif-menu__head">
          <div className="row gap-2">
            <strong style={{ fontSize: 'var(--fs-13)' }}>Notifications</strong>
            {unread.length > 0 && <Chip tone="accent">{unread.length} new</Chip>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            disabled={!unread.length}
            icon={<CheckCheck size={14} />}
            onClick={async () => {
              await notificationsApi.readAll();
              emit('notifications');
              onChanged();
            }}
          >
            Read all
          </Button>
        </header>

        <div className="notif-menu__list">
          {shown.length === 0 ? (
            <div className="empty" style={{ padding: 'var(--sp-6) var(--sp-4)' }}>
              <div className="empty__icon" style={{ width: 40, height: 40 }}>
                <BellOff size={18} />
              </div>
              <p style={{ fontSize: 'var(--fs-12)' }}>You are all caught up.</p>
            </div>
          ) : (
            shown.map((n) => (
              <div key={n.id} className="notif-row" data-unread={!n.is_read}>
                <button className="notif-row__main" onClick={() => markRead(n)}>
                  <span className="activity-item__icon">{ICONS[n.type] ?? <Bell size={15} />}</span>
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="row gap-2">
                      <strong className="truncate" style={{ fontSize: 'var(--fs-12)' }}>
                        {n.title}
                      </strong>
                      {!n.is_read && <span className="dot" style={{ color: 'var(--accent)' }} />}
                    </span>
                    <span className="notif-row__msg clamp-2">{n.message}</span>
                    <span className="faint" style={{ fontSize: 'var(--fs-11)' }}>
                      {n.time_ago ?? timeAgo(n.created_at)}
                    </span>
                  </span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Dismiss"
                  onClick={async () => {
                    await notificationsApi.remove(n.id);
                    emit('notifications');
                    onChanged();
                  }}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))
          )}
        </div>

        <footer className="notif-menu__foot">
          <Button
            variant="ghost"
            size="sm"
            block
            onClick={() => {
              onClose();
              navigate('/notifications');
            }}
          >
            View all notifications
            <ArrowRight size={14} />
          </Button>
        </footer>
      </div>
    </Menu>
  );
}
