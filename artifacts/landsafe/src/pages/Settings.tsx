import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { KeyRound, Shield, Cpu, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Settings() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const canManage = user?.role === 'operator' || user?.role === 'admin';
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');
    if (newPassword !== confirmation) { setError('Konfirmasi kata sandi tidak cocok.'); return; }
    if (new TextEncoder().encode(newPassword).length < 12 || new TextEncoder().encode(newPassword).length > 72) {
      setError('Kata sandi baru harus 12–72 byte.'); return;
    }
    const token = localStorage.getItem('landsafe_token');
    if (!token) { setError('Sesi berakhir. Masuk kembali.'); return; }
    setBusy(true);
    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!response.ok) {
        setError(response.status === 401 ? 'Kata sandi saat ini salah atau sesi berakhir.' : 'Gagal mengubah kata sandi.');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmation('');
      setMessage('Kata sandi berhasil diubah. Silakan masuk kembali.');
      await logout();
      navigate('/login');
    } catch {
      setError('Tidak dapat menghubungi server.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-4 sm:space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold"><Shield className="h-5 w-5 text-primary" /> Akun saya</h2>
        {user ? (
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground">{user.name} · {user.email} · <span className="uppercase font-semibold text-foreground">{user.role}</span></p>
        ) : (
          <div className="mt-2 space-y-3">
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Anda mengakses LANDSAFE sebagai tamu. Pengaturan akun hanya tersedia setelah masuk sebagai personel.
            </p>
            <Link href="/login">
              <button type="button" className="min-h-11 inline-flex items-center gap-2 rounded-md bg-primary px-4 text-xs sm:text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                <LogIn className="h-4 w-4" /> Masuk sebagai personel
              </button>
            </Link>
          </div>
        )}
      </div>
      {user && (
        <form onSubmit={submit} className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold"><KeyRound className="h-5 w-5 text-primary" /> Ubah kata sandi</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">Perubahan akan mengakhiri seluruh sesi aktif akun ini.</p>
          <label className="block text-xs sm:text-sm font-medium">Kata sandi saat ini
            <input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 sm:py-3 text-base sm:text-sm" />
          </label>
          <label className="block text-xs sm:text-sm font-medium">Kata sandi baru
            <input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={12} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 sm:py-3 text-base sm:text-sm" />
          </label>
          <label className="block text-xs sm:text-sm font-medium">Ulangi kata sandi baru
            <input type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} required className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 sm:py-3 text-base sm:text-sm" />
          </label>
          {error && <p role="alert" className="text-xs sm:text-sm text-destructive">{error}</p>}
          {message && <p role="status" className="text-xs sm:text-sm text-success font-medium">{message}</p>}
          <button type="submit" disabled={busy} className="min-h-11 w-full sm:w-auto rounded-md bg-primary px-5 text-xs sm:text-sm font-medium text-primary-foreground disabled:opacity-50 cursor-pointer">{busy ? 'Menyimpan...' : 'Simpan kata sandi'}</button>
        </form>
      )}
      {canManage && (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-sm">
          <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold"><Cpu className="h-5 w-5 text-primary" /> Sensor monitoring</h2>
          <p className="mt-2 text-xs sm:text-sm text-muted-foreground">Lihat kondisi setiap sensor dan data pengukuran terbaru.</p>
          <button type="button" onClick={() => navigate('/sensor-analytics')} className="mt-4 min-h-11 rounded-md border border-border px-4 text-xs sm:text-sm hover:bg-secondary cursor-pointer">Buka monitoring sensor</button>
        </div>
      )}
    </div>
  );
}
