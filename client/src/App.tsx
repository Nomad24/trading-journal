import { Route, Routes, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { TradesPage } from './pages/TradesPage';
import { TradeDetailsPage } from './pages/TradeDetailsPage';
import { AccountsPage } from './pages/AccountsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { useAuthStore } from './store/authStore';

function PrivateAppRoutes() {
  return (
    <ProtectedRoute>
      <Layout>
        <Routes>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/trades" element={<TradesPage />} />
          <Route path="/trades/:id" element={<TradeDetailsPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  const accessToken = useAuthStore((state) => state.accessToken);

  return (
    <Routes>
      <Route
        path="/login"
        element={accessToken ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/register"
        element={accessToken ? <Navigate to="/dashboard" replace /> : <RegisterPage />}
      />
      <Route path="/*" element={<PrivateAppRoutes />} />
    </Routes>
  );
}

