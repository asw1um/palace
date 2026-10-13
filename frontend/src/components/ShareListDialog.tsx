import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, ExternalLink, Share2 } from '@/lib/icons';
import { lists as listsApi } from '@/data/api';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Field';

/** Turn a public read-only link for a list on or off, and copy it. */
export function ShareListDialog({
  open, listId, token, onClose, onChanged,
}: {
  open: boolean;
  listId: number;
  /** The current share token, or null when the list is private. */
  token: string | null;
  onClose: () => void;
  onChanged: (token: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const url = token && typeof window !== 'undefined' ? `${window.location.origin}/s/${token}` : '';

  const start = async () => {
    setBusy(true);
    try {
      onChanged(await listsApi.share(listId));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      await listsApi.unshare(listId);
      onChanged(null);
      toast.success('Link turned off');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Couldn’t copy. Select the link and copy it yourself.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share this list"
      width={480}
      footer={
        token ? (
          <>
            <Button variant="danger" disabled={busy} onClick={stop}>
              Stop sharing
            </Button>
            <div className="grow" />
            <Button onClick={onClose}>Done</Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" icon={<Share2 size={15} />} disabled={busy} onClick={start}>
              Create link
            </Button>
          </>
        )
      }
    >
      {token ? (
        <div className="stack gap-3">
          <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
            Anyone with this link can see the list, without an account. They can’t change it, and
            they only see the list’s name, your display name and the titles.
          </p>
          <div className="row gap-2">
            <Input readOnly value={url} aria-label="Share link" onFocus={(e) => e.target.select()} />
            <Button icon={<Copy size={15} />} onClick={copy}>
              Copy
            </Button>
            <Button variant="ghost" aria-label="Open the link" onClick={() => window.open(url, '_blank', 'noopener')}>
              <ExternalLink size={15} />
            </Button>
          </div>
        </div>
      ) : (
        <p className="muted" style={{ fontSize: 'var(--text-sm)' }}>
          This list is private. Create a link to let anyone view it without an account. You can turn
          the link off again at any time.
        </p>
      )}
    </Modal>
  );
}
