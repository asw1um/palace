import type { ReactNode } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/data/AuthContext';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { AppDataProvider } from '@/components/AppData';
import { AppShell } from '@/components/AppShell';
import { Backdrop } from '@/components/Backdrop';
import { ConfirmProvider } from '@/components/ui/Modal';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Discover from '@/pages/Discover';
import Lists from '@/pages/Lists';
import ListDetail from '@/pages/ListDetail';
import Clubs from '@/pages/Clubs';
import ClubDetail from '@/pages/ClubDetail';
import People from '@/pages/People';
import Profile from '@/pages/Profile';
import ActivityPage from '@/pages/ActivityPage';
import NotificationsPage from '@/pages/NotificationsPage';
import Settings from '@/pages/Settings';

function Protected({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) {
    return (
      <div className="stack center gap-3" style={{ height: '100dvh', position: 'relative', zIndex: 1 }}>
        <div className="brand__mark" style={{ width: 40, height: 40 }}>
          <svg width="22" height="22" viewBox="0 0 64 64">
            <path d="M14 44V26l9 7 9-13 9 13 9-7v18a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3Z" fill="currentColor" />
          </svg>
        </div>
        <span className="faint">Loading Palace…</span>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Chrome() {
  const { mode } = useTheme();
  return (
    <>
      <Backdrop />
      <Toaster
        position="bottom-right"
        theme={mode}
        richColors
        closeButton
        toastOptions={{ style: { borderRadius: 'var(--r-md)', fontFamily: 'var(--font-sans)' } }}
      />
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <Chrome />
      <HashRouter>
        <AuthProvider>
          <ConfirmProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                element={
                  <Protected>
                    <AppDataProvider>
                      <AppShell />
                    </AppDataProvider>
                  </Protected>
                }
              >
                <Route path="/" element={<Dashboard />} />
                <Route path="/discover" element={<Discover />} />
                <Route path="/lists" element={<Lists />} />
                <Route path="/lists/:id" element={<ListDetail />} />
                <Route path="/clubs" element={<Clubs />} />
                <Route path="/clubs/:id" element={<ClubDetail />} />
                <Route path="/people" element={<People />} />
                <Route path="/profile/:username" element={<Profile />} />
                <Route path="/activity" element={<ActivityPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ConfirmProvider>
        </AuthProvider>
      </HashRouter>
    </ThemeProvider>
  );
}
