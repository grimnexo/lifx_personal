import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth';
import { AppProvider } from './context';
import { AppShell } from './components/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { DevicesPage } from './pages/DevicesPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppProvider>
              <AppShell />
            </AppProvider>
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
