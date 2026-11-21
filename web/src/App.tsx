import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './auth';
import { AppProvider } from './context';
import { AppShell } from './components/AppShell';
import { DashboardPage } from './pages/DashboardPage';
import { DevicesPage } from './pages/DevicesPage';
import { GroupsPage } from './pages/GroupsPage';
import { LightsPage } from './pages/LightsPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { RoomsPage } from './pages/RoomsPage';
import { SchedulesPage } from './pages/SchedulesPage';
import { SettingsPage } from './pages/SettingsPage';

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
        <Route path="lights" element={<LightsPage />} />
        <Route path="rooms" element={<RoomsPage />} />
        <Route path="groups" element={<GroupsPage />} />
        <Route path="schedules" element={<SchedulesPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
