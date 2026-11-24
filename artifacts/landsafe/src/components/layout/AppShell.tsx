import React, { useState, useEffect } from 'react';
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
  ChevronLeft,
  ShieldAlert,
  GitCompare,
  DatabaseZap,
  ClipboardList,
  ExternalLink,
  Compass,
  Route,
  X,
  AlertOctagon,
  ClipboardCheck,
  Truck,
  Home,
  Layers,
} from 'lucide-react';
import { useGetAlerts, getGetAlertsQueryKey } from '@workspace/api-client-react';
import { LiaPanel } from '../lia/LiaPanel';

type NavItem = {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
};

type NavGroup = { title: string; items: NavItem[] };

export function AppShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user, isLoading, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close mobile drawer when location changes
  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [location]);

  // Close mobile drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isMobileDrawerOpen) {
        setIsMobileDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileDrawerOpen]);

  const { data: activeAlerts } = useGetAlerts(
    { status: 'active', limit: 100 },
    {
      query: {
        queryKey: getGetAlertsQueryKey({ status: 'active', limit: 100 }),
        enabled: user?.role === 'operator' || user?.role === 'admin',
      },
    }
  );

  const alertCount = activeAlerts?.length || 0;

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>Memuat sesi LANDSAFE…</span>
        </div>
      </div>
    );
  }

  // Anonymous visitors are treated as the public role so the portal stays browsable
  const role = user?.role ?? 'public';
  const all = ['public', 'operator', 'admin'];
  const staff = ['operator', 'admin'];

  const groups: NavGroup[] = [
    {
      title: '01. Overview',
      items: [
        { label: 'Dashboard', path: '/dashboard', icon: Activity, roles: staff },
      ],
    },
    {
      title: '02. Situational Awareness',
      items: [
        { label: 'Peta Langsung', path: '/live-map', icon: MapPin, roles: all },
        { label: 'Pusat Peringatan', path: '/alerts', icon: AlertTriangle, roles: staff },
        { label: 'Analitik Sensor', path: '/sensor-analytics', icon: LineChart, roles: staff },
      ],
    },
    {
      title: '03. Risk & Intelligence',
      items: [
        { label: 'Kajian Risiko', path: '/risk-assessment', icon: ShieldAlert, roles: staff },
        { label: 'Analisis Skenario', path: '/scenario-analysis', icon: GitCompare, roles: staff },
        { label: 'Digital Twin', path: '/digital-twin', icon: Box, roles: staff },
        { label: 'AI Analytics', path: '/ai-risk', icon: BrainCircuit, roles: all },
      ],
    },
    {
      title: '04. Preparedness & Mitigation',
      items: [
        { label: 'Perencanaan Mitigasi', path: '/mitigation', icon: ClipboardList, roles: staff },
        { label: 'Rencana Kontingensi', path: '/contingency-plans', icon: FileText, roles: staff },
        { label: 'Simulasi / Tabletop', path: '/exercises', icon: Layers, roles: staff },
      ],
    },
    {
      title: '05. Emergency Operations',
      items: [
        { label: 'Manajemen Insiden & Operasi', path: '/incidents', icon: AlertOctagon, roles: staff },
        { label: 'Kaji Cepat & Lapangan', path: '/field-reports', icon: ClipboardCheck, roles: staff },
        { label: 'Sumber Daya & Logistik', path: '/resources', icon: Truck, roles: staff },
        { label: 'Peta Rute Evakuasi', path: '/public/evacuation', icon: Compass, roles: all },
        { label: 'Manajemen Rute Evakuasi', path: '/evacuation-routes', icon: Route, roles: staff },
        { label: 'Manajemen Shelter', path: '/shelters', icon: Home, roles: staff },
      ],
    },
    {
      title: '06. Data & Infrastructure',
      items: [
        { label: 'Hub Integrasi Data', path: '/data-hub', icon: DatabaseZap, roles: staff },
        { label: 'Manajemen Perangkat IoT', path: '/devices', icon: Cpu, roles: staff },
      ],
    },
    {
      title: '07. Reporting & Administration',
      items: [
        { label: 'Laporan', path: '/reports', icon: FileText, roles: staff },
        { label: 'Pengguna & Hak Akses', path: '/users', icon: Users, roles: ['admin'] },
        { label: 'Log Audit', path: '/audit', icon: Database, roles: ['admin'] },
        { label: 'Pengaturan', path: '/settings', icon: Settings, roles: all },
      ],
    },
  ]
    .map((group) => ({ ...group, items: group.items.filter((item) => item.roles.includes(role)) }))
    .filter((group) => group.items.length > 0);

  const publicPortal: NavItem = {
    label: 'Portal Mitigasi Publik',
    path: '/public/mitigation',
    icon: ExternalLink,
    roles: all,
  };

  const flatItems = [...groups.flatMap((group) => group.items), publicPortal];
  const current = flatItems.find((item) => item.path === location);
  const pageTitle = current?.label || 'Ringkasan';
  const pageGroup = groups.find((group) => group.items.some((item) => item.path === location))?.title;

  const renderNavLinks = (isExpanded: boolean, onNavClick?: () => void) => (
    <nav className="space-y-5 px-2">
      {groups.map((group) => (
        <div key={group.title}>
          {isExpanded && (
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
              {group.title}
            </div>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const isActive = location === item.path;
              return (
                <Link key={item.path} href={item.path} onClick={onNavClick}>
                  <div
                    className={`group relative flex items-center rounded-md px-3 py-2 text-sm transition-colors cursor-pointer select-none ${
                      isActive
                        ? 'bg-white/12 text-white font-medium'
                        : 'text-white/65 hover:bg-white/6 hover:text-white'
                    }`}
                    title={item.label}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-r bg-[hsl(var(--accent))]" />
                    )}
                    <item.icon
                      className={`h-[18px] w-[18px] shrink-0 ${
                        isActive ? 'text-white' : 'text-white/55 group-hover:text-white/85'
                      }`}
                    />
                    {isExpanded && <span className="ml-3 truncate font-medium">{item.label}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground antialiased">
      {/* Mobile Backdrop Overlay */}
      {isMobileDrawerOpen && (
        <div
          role="presentation"
          onClick={() => setIsMobileDrawerOpen(false)}
          className="fixed inset-0 z-[1200] bg-black/60 backdrop-blur-sm transition-opacity duration-200 lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Mobile Off-Canvas Drawer (Slide-out) */}
      <div
        className={`fixed inset-y-0 left-0 z-[1250] flex w-[18rem] max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigasi Menu Utama"
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4 shrink-0">
          <div className="flex items-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/15 shrink-0">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div className="ml-3 min-w-0">
              <div className="text-[15px] font-semibold tracking-[0.14em] text-white leading-none">LANDSAFE</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/45">Disaster Intelligence</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-label="Tutup navigasi"
            className="rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
          {renderNavLinks(true, () => setIsMobileDrawerOpen(false))}
        </div>

        <div className="border-t border-sidebar-border p-3 shrink-0 space-y-2">
          <Link href="/public/evacuation" onClick={() => setIsMobileDrawerOpen(false)}>
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 transition-colors hover:bg-emerald-500/20">
              <div className="flex items-center gap-2 text-white">
                <Compass className="h-4 w-4 shrink-0 text-emerald-400" />
                <div className="min-w-0">
                  <div className="text-[12px] font-bold leading-tight text-emerald-300">Rute Evakuasi Warga</div>
                  <div className="text-[10px] text-white/60 leading-tight">Peta jalur aman publik</div>
                </div>
              </div>
            </div>
          </Link>
          <Link href={publicPortal.path} onClick={() => setIsMobileDrawerOpen(false)}>
            <div className="rounded-md border border-white/12 bg-white/[0.06] p-2.5 transition-colors hover:bg-white/10">
              <div className="flex items-center gap-2 text-white">
                <ExternalLink className="h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold leading-tight">Portal Mitigasi</div>
                  <div className="text-[10px] text-white/55 leading-tight">Informasi mitigasi terbuka</div>
                </div>
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2 px-1 pt-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />
            <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">Sistem operasional</span>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar — deep navy institutional rail */}
      <aside
        className={`hidden lg:flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-[width] duration-200 ease-out shrink-0 ${
          isSidebarOpen ? 'w-[17rem]' : 'w-[4.5rem]'
        }`}
      >
        <div className="flex items-center h-16 px-4 border-b border-sidebar-border shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/15 shrink-0">
            <Shield className="h-5 w-5 text-white" />
          </div>
          {isSidebarOpen && (
            <div className="ml-3 min-w-0">
              <div className="text-[15px] font-semibold tracking-[0.14em] text-white leading-none">LANDSAFE</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/45">Disaster Intelligence</div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-4 scrollbar-hide">
          {renderNavLinks(isSidebarOpen)}
        </div>

        <div className="border-t border-sidebar-border p-3 shrink-0">
          <Link href="/public/evacuation">
            <div
              className={`mb-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 transition-colors hover:bg-emerald-500/20 ${
                isSidebarOpen ? '' : 'flex justify-center'
              }`}
            >
              <div className="flex items-center gap-2 text-white">
                <Compass className="h-4 w-4 shrink-0 text-emerald-400" />
                {isSidebarOpen && (
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold leading-tight text-emerald-300">Rute Evakuasi Warga</div>
                    <div className="text-[10px] text-white/60 leading-tight">Peta jalur aman publik</div>
                  </div>
                )}
              </div>
            </div>
          </Link>
          <Link href={publicPortal.path}>
            <div
              className={`mb-3 rounded-md border border-white/12 bg-white/[0.06] p-2.5 transition-colors hover:bg-white/10 ${
                isSidebarOpen ? '' : 'flex justify-center'
              }`}
            >
              <div className="flex items-center gap-2 text-white">
                <ExternalLink className="h-4 w-4 shrink-0" />
                {isSidebarOpen && (
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold leading-tight">Portal Mitigasi</div>
                    <div className="text-[10px] text-white/55 leading-tight">Informasi mitigasi terbuka</div>
                  </div>
                )}
              </div>
            </div>
          </Link>
          {isSidebarOpen && (
            <div className="mb-3 flex items-center gap-2 px-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" />
              <span className="text-[10px] uppercase tracking-[0.14em] text-white/45">Sistem normal</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="flex w-full items-center justify-center rounded-md p-2 text-white/55 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-1 focus:ring-white/40"
            aria-label={isSidebarOpen ? 'Ciutkan navigasi' : 'Bentangkan navigasi'}
          >
            {isSidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-3 sm:px-6 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setIsMobileDrawerOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground hover:bg-secondary lg:hidden shrink-0"
              aria-label="Buka menu navigasi"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              {pageGroup && (
                <div className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground truncate">
                  {pageGroup}
                </div>
              )}
              <h1 className="truncate text-base sm:text-[17px] font-semibold tracking-tight text-foreground">
                {pageTitle}
              </h1>
            </div>

            {role === 'public' && (
              <span className="hidden sm:inline-flex items-center rounded border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-warning shrink-0">
                Akses publik
              </span>
            )}
            {!user && (
              <span className="hidden sm:inline-flex items-center rounded border border-border bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground shrink-0">
                Tamu
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-5 shrink-0">
            <div className="hidden items-center gap-2 rounded border border-border bg-background px-3 py-1.5 md:flex">
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">WIB</span>
              <span className="text-sm font-medium tabular text-foreground">
                {time.toLocaleTimeString('en-GB', { hour12: false, timeZone: 'Asia/Jakarta' })}
              </span>
            </div>

            {(role === 'operator' || role === 'admin') && (
              <Link href="/alerts">
                <div
                  className="relative flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
                  title="Pusat peringatan"
                  aria-label={`Pusat peringatan, ${alertCount} aktif`}
                >
                  <Bell className="h-5 w-5" />
                  {alertCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white ring-2 ring-card">
                      {alertCount > 99 ? '99+' : alertCount}
                    </span>
                  )}
                </div>
              </Link>
            )}

            <div className="hidden sm:block h-6 w-px bg-border" />

            {user ? (
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="hidden text-right md:block">
                  <div className="text-sm font-medium leading-none text-foreground">{user.name}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                    {user.role === 'admin' ? 'Administrator' : user.role === 'operator' ? 'Operator BPBD' : 'Publik'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setIsLoggingOut(true);
                    await logout();
                    setLocation('/login');
                  }}
                  disabled={isLoggingOut}
                  aria-label="Keluar dari LANDSAFE"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title="Keluar"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </div>
            ) : (
              <Link href="/login">
                <button
                  type="button"
                  className="min-h-9 rounded-md bg-primary px-3 sm:px-4 text-xs sm:text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  title="Masuk sebagai personel BPBD"
                >
                  Masuk personel
                </button>
              </Link>
            )}
          </div>
        </header>

        {/* Content Container */}
        <main className="flex-1 overflow-auto bg-background p-3 sm:p-4 md:p-6 pb-20 lg:pb-6">
          <div className="mx-auto w-full max-w-[1500px]">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (Phone-Friendly Quick Access) */}
      <nav
        aria-label="Navigasi Bawah Seluler"
        className="fixed bottom-0 inset-x-0 z-[1000] flex h-14 items-center justify-around border-t border-sidebar-border/80 bg-sidebar px-2 text-white shadow-lg backdrop-blur-md lg:hidden"
      >
        {role !== 'public' ? (
          <Link href="/dashboard" className="flex flex-1 flex-col items-center justify-center py-1">
            <div
              className={`flex flex-col items-center gap-0.5 ${
                location === '/dashboard' ? 'text-white' : 'text-white/55 hover:text-white/80'
              }`}
            >
              <Activity className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">Dashboard</span>
            </div>
          </Link>
        ) : null}

        <Link href="/live-map" className="flex flex-1 flex-col items-center justify-center py-1">
          <div
            className={`flex flex-col items-center gap-0.5 ${
              location === '/live-map' ? 'text-white' : 'text-white/55 hover:text-white/80'
            }`}
          >
            <MapPin className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">Peta</span>
          </div>
        </Link>

        <Link href="/public/evacuation" className="flex flex-1 flex-col items-center justify-center py-1">
          <div
            className={`flex flex-col items-center gap-0.5 ${
              location === '/public/evacuation' ? 'text-emerald-400 font-bold' : 'text-white/55 hover:text-white/80'
            }`}
          >
            <Compass className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">Evakuasi</span>
          </div>
        </Link>

        {role !== 'public' ? (
          <Link href="/alerts" className="relative flex flex-1 flex-col items-center justify-center py-1">
            <div
              className={`flex flex-col items-center gap-0.5 ${
                location === '/alerts' ? 'text-white' : 'text-white/55 hover:text-white/80'
              }`}
            >
              <AlertTriangle className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">Peringatan</span>
              {alertCount > 0 && (
                <span className="absolute top-0 right-4 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[8.5px] font-bold text-white">
                  {alertCount > 9 ? '9+' : alertCount}
                </span>
              )}
            </div>
          </Link>
        ) : (
          <Link href="/ai-risk" className="flex flex-1 flex-col items-center justify-center py-1">
            <div
              className={`flex flex-col items-center gap-0.5 ${
                location === '/ai-risk' ? 'text-white' : 'text-white/55 hover:text-white/80'
              }`}
            >
              <BrainCircuit className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none">AI Analitik</span>
            </div>
          </Link>
        )}

        <button
          type="button"
          onClick={() => setIsMobileDrawerOpen(true)}
          className="flex flex-1 flex-col items-center justify-center py-1 text-white/55 hover:text-white/80 focus:outline-none"
          aria-label="Buka menu lengkap"
        >
          <div className="flex flex-col items-center gap-0.5">
            <Menu className="h-5 w-5" />
            <span className="text-[10px] font-medium leading-none">Menu</span>
          </div>
        </button>
      </nav>

      <LiaPanel />
    </div>
  );
}
