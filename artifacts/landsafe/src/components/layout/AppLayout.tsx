import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useAuth } from '../../contexts/AuthContext';
import { 
  Shield, 
  Activity, 
  MapPin, 
  Box, 
  LineChart, 
  AlertTriangle, 
  Cpu, 
  BrainCircuit, 
  FileText, 
  Settings, 
  Users, 
  Database,
  LogOut,
  Bell,
  Menu,
  ChevronLeft
} from 'lucide-react';
import { useGetAlerts, getGetAlertsQueryKey } from '@workspace/api-client-react';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user, isLoading, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [time, setTime] = useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: activeAlerts } = useGetAlerts({ status: 'active', limit: 100 }, {
    query: {
      queryKey: getGetAlertsQueryKey({ status: 'active', limit: 100 }),
      enabled: user?.role === 'operator' || user?.role === 'admin',
    }
  });

  const alertCount = activeAlerts?.length || 0;

  React.useEffect(() => {
    if (!isLoading && !user && location !== '/login') setLocation('/login');
  }, [isLoading, user, location, setLocation]);

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Memuat sesi…</div>;
  if (!user) return null;

  const role = user.role;

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: Activity, roles: ['operator', 'admin'] },
    { label: 'Live Map', path: '/live-map', icon: MapPin, roles: ['public', 'operator', 'admin'] },
    { label: 'Digital Twin', path: '/digital-twin', icon: Box, roles: ['operator', 'admin'] },
    { label: 'Sensor Analytics', path: '/sensor-analytics', icon: LineChart, roles: ['operator', 'admin'] },
    { label: 'Alert Center', path: '/alerts', icon: AlertTriangle, roles: ['operator', 'admin'] },
    { label: 'Device Management', path: '/devices', icon: Cpu, roles: ['operator', 'admin'] },
    { label: 'AI Analytics', path: '/ai-risk', icon: BrainCircuit, roles: ['public', 'operator', 'admin'] },
    { label: 'Reports', path: '/reports', icon: FileText, roles: ['operator', 'admin'] },
    { label: 'Settings', path: '/settings', icon: Settings, roles: ['public', 'operator', 'admin'] },
    { label: 'Users', path: '/users', icon: Users, roles: ['admin'] },
    { label: 'Audit Logs', path: '/audit', icon: Database, roles: ['admin'] },
  ].filter(item => item.roles.includes(role));

  const pageTitle = navItems.find(item => item.path === location)?.label || 'Overview';

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <div 
        className={`${isSidebarOpen ? 'w-64' : 'w-20'} flex flex-col border-r border-border bg-sidebar transition-all duration-300 ease-in-out shrink-0`}
      >
        <div className="flex items-center h-16 px-4 border-b border-border shrink-0">
          <Shield className="w-8 h-8 text-primary shrink-0" />
          {isSidebarOpen && (
            <span className="ml-3 font-bold text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-primary to-info">
              LANDSAFE
            </span>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
          <nav className="space-y-1 px-2">
            {navItems.map((item) => (
              <Link key={item.path} href={item.path}>
                <div className={`flex items-center px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                  location === item.path 
                    ? 'bg-primary/20 text-primary border border-primary/30' 
                    : 'text-muted-foreground hover:bg-card hover:text-foreground'
                }`}>
                  <item.icon className="w-5 h-5 shrink-0" />
                  {isSidebarOpen && <span className="ml-3 font-medium text-sm">{item.label}</span>}
                </div>
              </Link>
            ))}
          </nav>
        </div>

        <div className="p-4 border-t border-border shrink-0">
          {isSidebarOpen && (
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">System Normal</span>
              </div>
            </div>
          )}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="w-full flex items-center justify-center p-2 rounded-md hover:bg-card text-muted-foreground hover:text-foreground transition-colors"
          >
            {isSidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-border bg-card shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-foreground tracking-tight">{pageTitle}</h1>
            {user.role === 'public' && (
              <span className="px-2 py-0.5 rounded text-xs font-mono bg-warning/20 text-warning border border-warning/30">
                PUBLIC MODE
              </span>
            )}
            {user.id < 0 && (
              <span className="px-2 py-0.5 rounded text-xs font-mono bg-info/20 text-info border border-info/30">
                DEMO MODE
              </span>
            )}
          </div>

          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded bg-background border border-border">
              <span className="text-sm font-mono text-muted-foreground">UTC+7</span>
              <span className="text-sm font-mono font-medium">{time.toLocaleTimeString('en-US', { hour12: false, timeZone: 'Asia/Jakarta' })}</span>
            </div>

            <Link href="/alerts">
              <div className="relative cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                <Bell className="w-5 h-5" />
                {alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white ring-2 ring-card">
                    {alertCount > 99 ? '99+' : alertCount}
                  </span>
                )}
              </div>
            </Link>

            <div className="h-6 w-px bg-border" />

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium leading-none">{user.name}</div>
                <div className="text-xs text-muted-foreground capitalize">{user.role}</div>
              </div>
              <button 
                onClick={async () => { setIsLoggingOut(true); await logout(); setLocation('/login'); }}
                disabled={isLoggingOut}
                aria-label="Keluar dari LANDSAFE"
                className="p-2 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                title="Keluar"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-background p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
