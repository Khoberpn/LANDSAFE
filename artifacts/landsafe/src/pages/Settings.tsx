import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { KeyRound, Shield, Cpu } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function Settings() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
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
    <div className="max-w-3xl space-y-6">
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><Shield className="h-5 w-5 text-primary" /> Akun saya</h2>
        <p className="mt-2 text-sm text-muted-foreground">{user?.name} · {user?.email} · {user?.role}</p>
      </div>
      <form onSubmit={submit} className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold"><KeyRound className="h-5 w-5 text-primary" /> Ubah kata sandi</h2>
        <p className="text-sm text-muted-foreground">Perubahan akan mengakhiri seluruh sesi aktif akun ini.</p>
        <label className="block text-sm">Kata sandi saat ini
          <input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required className="mt-1 w-full rounded-md border border-border bg-background px-3 py-3" />
        </label>
        <label className="block text-sm">Kata sandi baru
          <input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={12} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-3" />
        </label>
        <label className="block text-sm">Ulangi kata sandi baru
          <input type="password" autoComplete="new-password" value={confirmation} onChange={e => setConfirmation(e.target.value)} required className="mt-1 w-full rounded-md border border-border bg-background px-3 py-3" />
        </label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {message && <p role="status" className="text-sm text-success">{message}</p>}
        <button type="submit" disabled={busy} className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">{busy ? 'Menyimpan…' : 'Simpan kata sandi'}</button>
      </form>
      {(user?.role === 'admin' || user?.role === 'operator') && (
        <div className="rounded-xl border border-border bg-card p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Cpu className="h-5 w-5 text-primary" /> Sensor monitoring</h2>
          <p className="mt-2 text-sm text-muted-foreground">Lihat kondisi setiap sensor dan data pengukuran terbaru.</p>
          <button onClick={() => navigate('/sensor-analytics')} className="mt-4 min-h-11 rounded-md border border-border px-4 text-sm hover:bg-secondary">Buka monitoring sensor</button>
        </div>
      )}
    </div>
  );
}
