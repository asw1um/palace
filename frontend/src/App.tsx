import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/data/ThemeContext';
import { ConfirmProvider } from '@/components/ConfirmDialog';
import Layout from '@/components/Layout';
import LoginSignup from '@/pages/LoginSignup';
import Dashboard from '@/pages/Dashboard';
import Notifications from '@/pages/Notifications';
import MyLists from '@/pages/MyLists';
import ListDetail from '@/pages/ListDetail';
import Clubs from '@/pages/Clubs';
import ClubDetail from '@/pages/ClubDetail';
import Discover from '@/pages/Discover';
import Users from '@/pages/Users';
import UserProfile from '@/pages/UserProfile';
import Settings from '@/pages/Settings';
import ActivityPage from '@/pages/Activity';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#fff', background: '#0a0e1a' }}>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function LoginRoute() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <LoginSignup />;
}

export default function App() {
  return (
    <HashRouter>
      <ThemeProvider>
        <AuthProvider>
          <ConfirmProvider>
            <Routes>
              <Route path="/login" element={<LoginRoute />} />
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/lists" element={<MyLists />} />
                <Route path="/lists/:id" element={<ListDetail />} />
                <Route path="/clubs" element={<Clubs />} />
                <Route path="/clubs/:id" element={<ClubDetail />} />
                <Route path="/discover" element={<Discover />} />
                <Route path="/users" element={<Users />} />
                <Route path="/profile/:username" element={<UserProfile />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/activity" element={<ActivityPage />} />
              </Route>
            </Routes>
          </ConfirmProvider>
        </AuthProvider>
      </ThemeProvider>
    </HashRouter>
  );
}
