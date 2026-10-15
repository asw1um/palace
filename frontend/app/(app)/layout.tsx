'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/data/AuthContext';
import { AppDataProvider } from '@/components/AppData';
import { AppShell } from '@/components/AppShell';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace('/login');
  }, [loading, isAuthenticated, router]);

  // A layout must ALWAYS render its `children` slot. Returning a loading tree
  // or null instead of children makes Next's OuterLayoutRouter read `.get` on
  // undefined. So render the shell + children unconditionally and put the
  // loading/auth state as an overlay on top.
  return (
    <AppDataProvider>
      <AppShell>{children}</AppShell>
      {(loading || !isAuthenticated) && (
        <div
          className="stack center gap-3"
          aria-hidden={!loading}
          style={{
            position: 'fixed', inset: 0, zIndex: 60, background: 'var(--bg)',
          }}
        >
          <div className="brand__mark" style={{ width: 40, height: 40 }}>
            <svg width="22" height="22" viewBox="0 0 64 64">
              <path d="M14 44V26l9 7 9-13 9 13 9-7v18a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3Z" fill="currentColor" />
            </svg>
          </div>
          <span className="faint">Loading Palace…</span>
        </div>
      )}
    </AppDataProvider>
  );
}
