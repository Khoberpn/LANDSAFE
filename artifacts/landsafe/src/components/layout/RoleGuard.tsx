import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'wouter';
import { UserRole } from '@workspace/api-client-react';

interface GuardProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

/**
 * Route guard with public access support.
 *
 * Anonymous visitors are treated as the `public` role, so routes that allow
 * `public` render without a session. Routes limited to operator/admin show an
 * inline sign-in prompt instead of redirecting (the rest of the app stays
 * browsable without logging in).
 */
export function RoleGuard({ children, allowedRoles }: GuardProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const effectiveRole: UserRole = user?.role ?? 'public';

  if (!allowedRoles || allowedRoles.includes(effectiveRole)) {
    return <>{children}</>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-info/20 flex items-center justify-center text-info">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 11h14v10H5V11z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Perlu Akses Personel</h1>
        <p className="text-muted-foreground max-w-sm">
          Halaman ini hanya tersedia untuk operator dan administrator. Anda tetap dapat menjelajahi peta, analisis risiko AI, dan peringatan tanpa masuk.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link href="/login">
            <button className="min-h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
              Masuk sebagai personel
            </button>
          </Link>
          <Link href="/live-map">
            <button className="min-h-11 rounded-full border border-border px-5 text-sm font-medium hover:bg-secondary transition-colors">
              Kembali ke peta publik
            </button>
          </Link>
        </div>
      </div>
    );
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center text-destructive">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Access Denied</h1>
        <p className="text-muted-foreground max-w-sm">You do not have the required clearance level to access this sector of the system.</p>
      </div>
    );
  }

  return <>{children}</>;
}
