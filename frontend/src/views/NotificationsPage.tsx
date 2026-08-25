import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, Check, CheckCheck, Trash2 } from '@/lib/icons';
import { toast } from 'sonner';
import { notifications as notificationsApi } from '@/data/api';
import type { Notification } from '@/data/types';
import { Button } from '@/components/ui/Button';
import { Chip, Empty, Panel, Skeleton, Tabs } from '@/components/ui/Bits';
import { emit } from '@/lib/bus';
import { timeAgo } from '@/lib/format';
type Tab = 'all' | 'unread';

export default function NotificationsPage() {
  const [rows, setRows] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');

  const load = () => {
    setLoading(true);
    notificationsApi
      .all()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const unread = rows.filter((r) => !r.is_read);
  const shown = useMemo(() => (tab === 'unread' ? unread : rows), [tab, rows, unread]);

  const setRead = async (n: Notification, read: boolean) => {
    await notificationsApi.setRead(n.id, read);
    setRows((prev) => prev.map((r) => (r.id === n.id ? { ...r, is_read: read } : r)));
    emit('notifications');
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Notifications</h1>
          <p className="page-head__sub">
            {unread.length ? `${unread.length} unread` : 'You are all caught up.'}
          </p>
        </div>
        <div className="page-head__actions">
          <Button
            icon={<CheckCheck size={15} />}
            disabled={!unread.length}
            onClick={async () => {
              await notificationsApi.readAll();
              setRows((prev) => prev.map((r) => ({ ...r, is_read: true })));
              emit('notifications');
              toast.success('All marked as read');
            }}
          >
            Mark all read
          </Button>
        </div>
      </header>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'all', label: 'All', count: rows.length },
          { value: 'unread', label: 'Unread', count: unread.length },
        ]}
      />

      {loading ? (
        <div className="stack gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} h={64} r="var(--r-sm)" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <Empty icon={<BellOff size={22} />} title="Nothing here" >
          New club invites, friend requests and reactions land on this page.
        </Empty>
      ) : (
        <Panel flush>
          <div className="stack gap-1" style={{ padding: 'var(--space-2)' }}>
            {shown.map((n) => (
              <div
                key={n.id}
                className="list-row notif-row"
                style={{
                  background: n.is_read ? undefined : 'var(--accent-soft)',
                  alignItems: 'flex-start',
                }}
              >
                <div className="activity-item__icon" style={{ marginTop: 2 }}>
                  <Bell size={15} />
                </div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="row gap-2">
                    <strong style={{ fontSize: 'var(--text-sm)' }}>{n.title}</strong>
                    {!n.is_read && <Chip tone="accent">New</Chip>}
                    <span className="faint" style={{ fontSize: 'var(--text-xs)' }}>
                      {n.time_ago ?? timeAgo(n.created_at)}
                    </span>
                  </div>
                  <div className="muted" style={{ fontSize: 'var(--text-sm)' }}>
                    {n.message}
                  </div>
                </div>
                <div className="list-row__actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={n.is_read ? 'Mark unread' : 'Mark read'}
                    onClick={() => setRead(n, !n.is_read)}
                  >
                    <Check size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Delete"
                    onClick={async () => {
                      await notificationsApi.remove(n.id);
                      setRows((prev) => prev.filter((r) => r.id !== n.id));
                      emit('notifications');
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}
