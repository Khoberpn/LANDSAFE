import React, { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Redirect, Route, Switch, Router as WouterRouter } from 'wouter';
import { AuthProvider } from './contexts/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { RoleGuard } from './components/layout/RoleGuard';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { PageLoader } from './components/common/PageLoader';

// Code-split all pages to keep initial bundle ultra-light and fast
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const LiveMap = lazy(() => import('./pages/LiveMap'));
const DigitalTwin = lazy(() => import('./pages/DigitalTwin'));
const SensorAnalytics = lazy(() => import('./pages/SensorAnalytics'));
const AiRisk = lazy(() => import('./pages/AiRisk'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Devices = lazy(() => import('./pages/Devices'));
const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const Users = lazy(() => import('./pages/Users'));
const Audit = lazy(() => import('./pages/Audit'));
const RiskAssessment = lazy(() => import('./pages/RiskAssessment'));
const ScenarioAnalysis = lazy(() => import('./pages/ScenarioAnalysis'));
const DataHub = lazy(() => import('./pages/DataHub'));
const MitigationPlanning = lazy(() => import('./pages/MitigationPlanning'));
const PublicMitigation = lazy(() => import('./pages/PublicMitigation'));
const PublicEvacuation = lazy(() => import('./pages/PublicEvacuation'));
const EvacuationManagement = lazy(() => import('./pages/EvacuationManagement'));
const Incidents = lazy(() => import('./pages/Incidents'));
const FieldReports = lazy(() => import('./pages/FieldReports'));
const Resources = lazy(() => import('./pages/Resources'));
const Shelters = lazy(() => import('./pages/Shelters'));
const ContingencyPlans = lazy(() => import('./pages/ContingencyPlans'));
const Exercises = lazy(() => import('./pages/Exercises'));
const NotFound = lazy(() => import('@/pages/not-found'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * Public routes render for anonymous visitors (treated as the `public` role).
 * Operator/admin routes render an inline sign-in prompt instead of forcing a
 * redirect, so the site remains fully browsable without an account.
 */
function AppRoutes() {
  return (
    <AppShell>
      <ErrorBoundary fallbackTitle="Terjadi Kesalahan Pada Halaman">
        <Suspense fallback={<PageLoader />}>
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
              <RoleGuard allowedRoles={['public', 'operator', 'admin']}><Alerts /></RoleGuard>
            </Route>
            <Route path="/devices">
              <RoleGuard allowedRoles={['operator', 'admin']}><Devices /></RoleGuard>
            </Route>
            <Route path="/reports">
              <RoleGuard allowedRoles={['operator', 'admin']}><Reports /></RoleGuard>
            </Route>
            <Route path="/risk-assessment">
              <RoleGuard allowedRoles={['operator', 'admin']}><RiskAssessment /></RoleGuard>
            </Route>
            <Route path="/scenario-analysis">
              <RoleGuard allowedRoles={['operator', 'admin']}><ScenarioAnalysis /></RoleGuard>
            </Route>
            <Route path="/data-hub">
              <RoleGuard allowedRoles={['operator', 'admin']}><DataHub /></RoleGuard>
            </Route>
            <Route path="/mitigation">
              <RoleGuard allowedRoles={['operator', 'admin']}><MitigationPlanning /></RoleGuard>
            </Route>
            <Route path="/contingency-plans">
              <RoleGuard allowedRoles={['operator', 'admin']}><ContingencyPlans /></RoleGuard>
            </Route>
            <Route path="/exercises">
              <RoleGuard allowedRoles={['operator', 'admin']}><Exercises /></RoleGuard>
            </Route>
            <Route path="/incidents">
              <RoleGuard allowedRoles={['operator', 'admin']}><Incidents /></RoleGuard>
            </Route>
            <Route path="/field-reports">
              <RoleGuard allowedRoles={['operator', 'admin']}><FieldReports /></RoleGuard>
            </Route>
            <Route path="/resources">
              <RoleGuard allowedRoles={['operator', 'admin']}><Resources /></RoleGuard>
            </Route>
            <Route path="/shelters">
              <RoleGuard allowedRoles={['operator', 'admin']}><Shelters /></RoleGuard>
            </Route>
            <Route path="/evacuation-routes">
              <RoleGuard allowedRoles={['operator', 'admin']}><EvacuationManagement /></RoleGuard>
            </Route>
            <Route path="/evacuation-route">
              <Redirect to="/public/evacuation" />
            </Route>
            <Route path="/public/mitigation">
              <RoleGuard allowedRoles={['public', 'operator', 'admin']}><PublicMitigation /></RoleGuard>
            </Route>
            <Route path="/public/evacuation">
              <RoleGuard allowedRoles={['public', 'operator', 'admin']}><PublicEvacuation /></RoleGuard>
            </Route>
            <Route path="/evacuation">
              <RoleGuard allowedRoles={['public', 'operator', 'admin']}><PublicEvacuation /></RoleGuard>
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
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}

function App() {
  return (
    <ErrorBoundary fallbackTitle="Aplikasi LANDSAFE Mengalami Kendala">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <Suspense fallback={<PageLoader />}>
                <Switch>
                  <Route path="/login" component={Login} />
                  <Route path="/" component={() => <Redirect to="/live-map" />} />
                  <Route>
                    <AppRoutes />
                  </Route>
                </Switch>
              </Suspense>
            </WouterRouter>
          </AuthProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
