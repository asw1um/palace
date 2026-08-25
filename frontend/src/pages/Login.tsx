import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ArrowRight, Clapperboard, Sparkles, Users, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/data/AuthContext';
import { isDemo } from '@/data/client';
import { gsap, reducedMotion, shake } from '@/lib/motion';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Chip } from '@/components/ui/Bits';

export default function Login() {
  const { isAuthenticated, login, register, loading } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

  /*
   * Intro animation.
   *
   * Deliberately fromTo, never `from`: `from` tweens towards whatever value the
   * element currently has, so if the tween is interrupted at opacity 0 (which
   * StrictMode's double-invoked effect does in development) the next one
   * animates 0 → 0 and the page stays blank for good. fromTo always ends at 1,
   * and the cleanup restores visibility no matter when it runs.
   */
  useEffect(() => {
    // Wait until the real markup is on screen — during `loading` the refs are
    // still empty because a placeholder is rendered instead.
    if (loading) return;
    const hero = heroRef.current;
    const card = cardRef.current;
    if (!hero || !card) return;

    const targets = [...hero.children, card];
    if (reducedMotion()) {
      gsap.set(targets, { opacity: 1, y: 0, scale: 1 });
      return;
    }

    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo(
      hero.children,
      { opacity: 0, y: 26 },
      { opacity: 1, y: 0, duration: 0.7, stagger: 0.08, clearProps: 'transform' },
    ).fromTo(
      card,
      { opacity: 0, y: 30, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: 0.6, clearProps: 'transform' },
      '-=0.45',
    );

    return () => {
      tl.kill();
      gsap.set(targets, { opacity: 1, clearProps: 'transform' });
    };
  }, [loading]);

  if (loading) {
    return (
      <div className="stack center" style={{ height: '100dvh' }}>
        <span className="faint">Starting Palace…</span>
      </div>
    );
  }
  if (isAuthenticated) return <Navigate to="/" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      shake(cardRef.current);
      toast.error('Username and password are required');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') await login(username.trim(), password);
      else await register(username.trim(), password, nickname.trim() || undefined);
    } catch {
      shake(cardRef.current);
    } finally {
      setBusy(false);
    }
  };

  const enterDemo = async () => {
    setBusy(true);
    try {
      await login('you', 'demo');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'relative',
        zIndex: 1,
        minHeight: '100dvh',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
        alignItems: 'center',
        gap: 'var(--sp-8)',
        padding: 'clamp(24px, 5vw, 72px)',
        overflowY: 'auto',
      }}
      className="login-grid"
    >
      <div ref={heroRef} className="stack gap-5" style={{ maxWidth: 620 }}>
        <div className="row gap-3">
          <div className="brand__mark" style={{ width: 44, height: 44 }}>
            <svg width="24" height="24" viewBox="0 0 64 64">
              <path d="M14 44V26l9 7 9-13 9 13 9-7v18a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3Z" fill="currentColor" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 'var(--fs-22)', fontWeight: 800, letterSpacing: '-0.02em' }}>Palace</div>
            <div className="eyebrow">Track · Collect · Share</div>
          </div>
        </div>

        <h1 style={{ fontSize: 'clamp(2rem, 5vw, 3.2rem)', lineHeight: 1.05 }}>
          Everything you have watched,
          <br />
          <span
            style={{
              background: 'linear-gradient(100deg, var(--accent), var(--accent-2))',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
            }}
          >
            finally in one place.
          </span>
        </h1>

        <p className="muted" style={{ fontSize: 'var(--fs-16)', maxWidth: '52ch' }}>
          Lists that behave themselves, episode tracking that keeps up with you, reviews worth
          reading, and clubs for the people you argue with about films.
        </p>

        <div className="row gap-4 wrap">
          {[
            [<Clapperboard key="i" size={16} />, 'Films and series in one library'],
            [<Users key="i2" size={16} />, 'Clubs, shared lists and friends'],
            [<Wand2 key="i3" size={16} />, 'Themes you actually control'],
          ].map(([icon, label], i) => (
            <div key={i} className="row gap-2 muted" style={{ fontSize: 'var(--fs-13)' }}>
              <span style={{ color: 'var(--accent)' }}>{icon}</span>
              {label}
            </div>
          ))}
        </div>
      </div>

      <div className="panel" ref={cardRef} style={{ padding: 'var(--sp-6)', maxWidth: 420, width: '100%' }}>
        <div className="stack gap-5">
          <div className="row between">
            <h2 style={{ fontSize: 'var(--fs-18)' }}>
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            {isDemo() && <Chip tone="warning">Demo mode</Chip>}
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

          {isDemo() && (
            <>
              <div className="row gap-3 faint" style={{ fontSize: 'var(--fs-12)' }}>
                <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                or
                <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              </div>
              <Button variant="soft" block icon={<Sparkles size={16} />} onClick={enterDemo} disabled={busy}>
                Explore with demo data
              </Button>
              <p className="faint" style={{ fontSize: 'var(--fs-12)' }}>
                The Palace API is not answering on this machine, so Palace is running on a full set of
                sample data stored in your browser. Start the backend and reload to use real data.
              </p>
            </>
          )}

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
