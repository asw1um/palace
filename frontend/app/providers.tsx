'use client';

import type { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { AuthProvider } from '@/data/AuthContext';
import { ConfirmProvider } from '@/components/ui/Modal';
import { Backdrop } from '@/components/Backdrop';

/** Shell chrome that sits inside the theme context. */
function Chrome() {
  return (
    <>
      <Backdrop />
      <Toaster
        position="bottom-right"
        theme="dark"
        richColors
        closeButton
        toastOptions={{ style: { borderRadius: 'var(--r-md)', fontFamily: 'var(--font-sans)' } }}
      />
    </>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <Chrome />
      <AuthProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
