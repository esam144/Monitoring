import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import SidebarLayout from './components/layout/SidebarLayout';
import DashboardLayout from './components/layout/DashboardLayout';
import SitesPage from './components/layout/SitesPage';
import ConfigPage from './components/layout/ConfigPage';
import UsersPage from './components/layout/UsersPage';
import Login from './pages/Login';
import ProtectedRoute from './components/auth/ProtectedRoute';

function AppShell() {
  return (
    <SidebarLayout>
      <Outlet />
    </SidebarLayout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardLayout />} />
          <Route path="/sites" element={<SitesPage />} />
          <Route path="/config" element={<ConfigPage />} />
          <Route path="/users" element={<UsersPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
