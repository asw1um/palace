import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from '@/lib/icons';
import { toast } from 'sonner';
import { useAuth } from '@/data/AuthContext';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';

export default function Login() {
  const { isAuthenticated, login, register, loading } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) router.replace('/');
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="stack center" style={{ height: '100dvh' }}>
        <span className="faint">Starting Palace…</span>
      </div>
    );
  }
  if (isAuthenticated) return null; // redirecting to / via effect

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast.error('Username and password are required');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') await login(username.trim(), password);
      else await register(username.trim(), password, nickname.trim() || undefined);
    } catch {
      /* errors surfaced by auth context */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-5)',
        background: 'var(--bg)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div
          className="stack gap-5"
          style={{
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)',
            padding: 'var(--space-6)',
          }}
        >
          <div className="row gap-3">
            <div className="brand__mark">
              <svg width="16" height="16" viewBox="0 0 64 64">
                <path d="M14 44V26l9 7 9-13 9 13 9-7v18a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3Z" fill="currentColor" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-md)' }}>Palace</div>
              <div className="faint" style={{ fontSize: 'var(--text-xs)' }}>Track · Collect · Share</div>
            </div>
          </div>

          <div className="row gap-3 between">
            <h1 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
          </div>

          <form className="stack gap-4" onSubmit={submit}>
            <Field label="Username">
              <Input
                value={username}
                autoComplete="username"
                placeholder="you"
                onChange={(e) => setUsername(e.target.value)}
              />
            </Field>

            {mode === 'signup' && (
              <Field label="Display name" hint="Optional — what other members see.">
                <Input value={nickname} onChange={(e) => setNickname(e.target.value)} />
              </Field>
            )}

            <Field label="Password">
              <Input
                type="password"
                value={password}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            <Button type="submit" variant="primary" size="lg" block disabled={busy}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
              <ArrowRight size={16} />
            </Button>
          </form>

          <button
            className="btn btn--ghost"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
          >
            {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
