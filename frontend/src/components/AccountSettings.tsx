import { useState } from 'react';
import { toast } from 'sonner';
import { Download, Lock, Trash2 } from '@/lib/icons';
import { auth as authApi } from '@/data/api';
import { useAuth } from '@/data/AuthContext';
import { Button } from './ui/Button';
import { Field, Input } from './ui/Field';
import { Panel } from './ui/Bits';
import { Modal } from './ui/Modal';

/** Change password. Succeeding signs every other device out. */
export function PasswordPanel() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);

  const mismatch = again.length > 0 && next !== again;
  const ready = current && next.length >= 6 && next === again;

  const submit = async () => {
    setBusy(true);
    try {
      await authApi.changePassword(current, next);
      setCurrent('');
      setNext('');
      setAgain('');
      toast.success('Password changed. Other devices have been signed out.');
    } catch {
      /* the request layer already showed why */
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Password" icon={<Lock size={16} />}>
      <div className="stack gap-4" style={{ maxWidth: 420 }}>
        <Field label="Current password">
          <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <Field label="New password" hint="At least 6 characters.">
          <Input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </Field>
        <Field label="New password again" hint={mismatch ? 'The two new passwords don’t match.' : undefined}>
          <Input
            type="password"
            autoComplete="new-password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && ready && submit()}
          />
        </Field>
        <div>
          <Button variant="primary" disabled={!ready || busy} onClick={submit}>
            Change password
          </Button>
        </div>
      </div>
    </Panel>
  );
}

/** Download everything Palace holds about the account as one JSON file. */
export function ExportPanel() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const data = await authApi.exportData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `palace-${user?.username ?? 'export'}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="Your data" icon={<Download size={16} />}>
      <div className="row gap-3 wrap between">
        <p className="muted" style={{ fontSize: 'var(--text-sm)', maxWidth: '60ch' }}>
          Download your lists, ratings and reviews, watch progress and custom runtimes as a single
          JSON file. Your password is never included.
        </p>
        <Button icon={<Download size={15} />} disabled={busy} onClick={download}>
          {busy ? 'Preparing…' : 'Export my data'}
        </Button>
      </div>
    </Panel>
  );
}

/** Delete the account for good, behind a password prompt. */
export function DeleteAccountPanel() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await authApi.deleteAccount(password);
      toast.success('Account deleted');
      logout();
      window.location.assign('/login');
    } catch {
      setBusy(false);
    }
  };

  return (
    <Panel title="Delete account" icon={<Trash2 size={16} />}>
      <div className="row gap-3 wrap between">
        <p className="muted" style={{ fontSize: 'var(--text-sm)', maxWidth: '60ch' }}>
          Removes your profile, lists, reviews, comments and watch history. Clubs you run pass to a
          mod or another member, and are removed if you are the only one in them. This cannot be
          undone.
        </p>
        <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => { setPassword(''); setOpen(true); }}>
          Delete my account
        </Button>
      </div>

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Delete your account?"
        width={440}
        footer={
          <>
            <Button disabled={busy} onClick={() => setOpen(false)}>Keep my account</Button>
            <Button variant="danger" disabled={!password || busy} onClick={submit}>
              {busy ? 'Deleting…' : 'Delete forever'}
            </Button>
          </>
        }
      >
        <div className="stack gap-4">
          <p className="muted">
            Everything tied to <strong>@{user?.username}</strong> will be removed and can’t be
            recovered. Export your data first if you want a copy.
          </p>
          <Field label="Type your password to confirm">
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && password && submit()}
            />
          </Field>
        </div>
      </Modal>
    </Panel>
  );
}
