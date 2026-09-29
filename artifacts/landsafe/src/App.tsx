import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AuthProvider } from './contexts/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { RoleGuard } from './components/layout/RoleGuard';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LiveMap from './pages/LiveMap';
import DigitalTwin from './pages/DigitalTwin';
import SensorAnalytics from './pages/SensorAnalytics';
import AiRisk from './pages/AiRisk';
import Alerts from './pages/Alerts';
import Devices from './pages/Devices';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Users from './pages/Users';
import Audit from './pages/Audit';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();

function ProtectedRoutes() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/dashboard">
          <RoleGuard allowedRoles={['operator', 'admin']}><Dashboard /></RoleGuard>
        </Route>
        <Route path="/live-map">
          <RoleGuard allowedRoles={['public', 'operator', 'admin']}><LiveMap /></RoleGuard>
        </Route>
        <Route path="/digital-twin">
          <RoleGuard allowedRoles={['operator', 'admin']}><DigitalTwin /></RoleGuard>
        </Route>
        <Route path="/sensor-analytics">
          <RoleGuard allowedRoles={['operator', 'admin']}><SensorAnalytics /></RoleGuard>
        </Route>
        <Route path="/ai-risk">
          <RoleGuard allowedRoles={['public', 'operator', 'admin']}><AiRisk /></RoleGuard>
        </Route>
        <Route path="/alerts">
          <RoleGuard allowedRoles={['operator', 'admin']}><Alerts /></RoleGuard>
        </Route>
        <Route path="/devices">
          <RoleGuard allowedRoles={['operator', 'admin']}><Devices /></RoleGuard>
        </Route>
        <Route path="/reports">
          <RoleGuard allowedRoles={['operator', 'admin']}><Reports /></RoleGuard>
        </Route>
        <Route path="/settings">
          <RoleGuard allowedRoles={['public', 'operator', 'admin']}><Settings /></RoleGuard>
        </Route>
        <Route path="/users">
          <RoleGuard allowedRoles={['admin']}><Users /></RoleGuard>
        </Route>
        <Route path="/audit">
          <RoleGuard allowedRoles={['admin']}><Audit /></RoleGuard>
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <Switch>
              <Route path="/login" component={Login} />
              <Route path="/" component={() => {
                window.location.href = '/dashboard';
                return null;
              }} />
              <Route path="/:rest*">
                <ProtectedRoutes />
              </Route>
            </Switch>
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
