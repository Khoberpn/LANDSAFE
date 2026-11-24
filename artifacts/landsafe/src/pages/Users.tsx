import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateUser, useGetUsers, useUpdateUser, type User, type UserInputRole } from '@workspace/api-client-react';
import { useAuth } from '../contexts/AuthContext';
import { UserCircle, Shield, Mail } from 'lucide-react';

type Editor = { id?: number; name: string; email: string; role: UserInputRole; isActive: boolean; password: string };
const blank: Editor = { name: '', email: '', role: 'operator', isActive: true, password: '' };

export default function Users() {
  const queryClient = useQueryClient();
  const { user: self } = useAuth();
  const { data: users, isLoading, isError } = useGetUsers();
  const create = useCreateUser();
  const update = useUpdateUser();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const busy = create.isPending || update.isPending;

  const edit = (user: User) => {
    setError('');
    setNotice('');
    setEditor({ id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive ?? true, password: '' });
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    setError('');
    setNotice('');
    if ((!editor.id || editor.password) && (new TextEncoder().encode(editor.password).length < 12 || new TextEncoder().encode(editor.password).length > 72)) {
      setError('Kata sandi harus 12-72 karakter.'); return;
    }
    if (editor.id === self?.id && (!editor.isActive || editor.role !== 'admin')) {
      setError('Akun admin sendiri tidak dapat dinonaktifkan atau diturunkan perannya.'); return;
    }
    try {
      if (editor.id) {
        await update.mutateAsync({ id: editor.id, data: {
          name: editor.name.trim(), email: editor.email.trim(), role: editor.role,
          isActive: editor.isActive, ...(editor.password ? { password: editor.password } : {}),
        } });
      } else {
        await create.mutateAsync({ data: {
          name: editor.name.trim(), email: editor.email.trim(), role: editor.role, password: editor.password,
        } });
      }
      await queryClient.invalidateQueries();
      setEditor(null);
      setNotice('Data pengguna berhasil disimpan.');
    } catch {
      setError('Gagal menyimpan pengguna. Periksa data atau kemungkinan email sudah digunakan.');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs sm:text-sm text-muted-foreground">Kelola akun dan hak akses pengguna LANDSAFE.</p>
        <button 
          type="button"
          onClick={() => { setEditor({ ...blank }); setError(''); setNotice(''); }} 
          className="min-h-11 w-full sm:w-auto rounded-md bg-primary px-4 text-xs sm:text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
        >
          Tambah pengguna
        </button>
      </div>
      {notice && <p role="status" className="text-xs sm:text-sm text-success font-medium">{notice}</p>}
      {editor && (
        <form onSubmit={save} className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4 shadow-sm">
          <h2 className="text-base sm:text-lg font-semibold">{editor.id ? 'Ubah data pengguna' : 'Tambah pengguna baru'}</h2>
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            <label className="text-xs sm:text-sm font-medium">Nama Lengkap
              <input required maxLength={120} value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 sm:py-3 text-base sm:text-sm" />
            </label>
            <label className="text-xs sm:text-sm font-medium">Email
              <input required type="email" maxLength={254} value={editor.email} onChange={e => setEditor({ ...editor, email: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 sm:py-3 text-base sm:text-sm" />
            </label>
            <label className="text-xs sm:text-sm font-medium">Peran
              <select value={editor.role} onChange={e => setEditor({ ...editor, role: e.target.value as UserInputRole })} disabled={editor.id === self?.id} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 sm:py-3 text-base sm:text-sm">
                <option value="public">Public (Masyarakat)</option><option value="operator">Operator (BPBD)</option><option value="admin">Admin (Administrator)</option>
              </select>
            </label>
            <label className="text-xs sm:text-sm font-medium">{editor.id === self?.id ? 'Gunakan halaman Settings untuk kata sandi sendiri' : editor.id ? 'Reset kata sandi (kosongkan jika tidak berubah)' : 'Kata sandi awal'}
              <input type="password" autoComplete="new-password" required={!editor.id} disabled={editor.id === self?.id} value={editor.password} onChange={e => setEditor({ ...editor, password: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2.5 sm:py-3 text-base sm:text-sm" />
            </label>
          </div>
          {editor.id && (
            <label className="flex items-center gap-3 text-xs sm:text-sm font-medium cursor-pointer">
              <input type="checkbox" checked={editor.isActive} disabled={editor.id === self?.id} onChange={e => setEditor({ ...editor, isActive: e.target.checked })} className="h-4 w-4 rounded accent-primary" />
              <span>Akun aktif dan diizinkan masuk</span>
            </label>
          )}
          {error && <p role="alert" className="text-xs sm:text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2.5 sm:gap-3 pt-2">
            <button type="submit" disabled={busy} className="min-h-11 flex-1 sm:flex-initial rounded-md bg-primary px-5 text-xs sm:text-sm text-primary-foreground disabled:opacity-50 cursor-pointer font-medium">{busy ? 'Menyimpan...' : 'Simpan'}</button>
            <button type="button" onClick={() => setEditor(null)} className="min-h-11 rounded-md border border-border px-4 text-xs sm:text-sm hover:bg-secondary cursor-pointer">Batal</button>
          </div>
        </form>
      )}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-secondary/30 text-xs uppercase text-muted-foreground font-mono">
            <tr>
              <th className="px-4 sm:px-6 py-3 sm:py-4">Pengguna</th>
              <th className="px-4 sm:px-6 py-3 sm:py-4">Peran</th>
              <th className="px-4 sm:px-6 py-3 sm:py-4">Status</th>
              <th className="px-4 sm:px-6 py-3 sm:py-4">Login terakhir</th>
              <th className="px-4 sm:px-6 py-3 sm:py-4">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={5} className="p-8 text-center text-xs sm:text-sm text-muted-foreground">Memuat data pengguna...</td></tr>}
            {isError && <tr><td colSpan={5} className="p-8 text-center text-xs sm:text-sm text-destructive">Gagal memuat pengguna.</td></tr>}
            {users?.map(user => (
              <tr key={user.id} className="hover:bg-secondary/20 transition-colors">
                <td className="px-4 sm:px-6 py-3 sm:py-4">
                  <span className="flex items-center gap-2 font-medium text-foreground"><UserCircle className="h-5 w-5 text-primary" />{user.name}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{user.email}</span>
                </td>
                <td className="px-4 sm:px-6 py-3 sm:py-4">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-secondary text-foreground">
                    <Shield className="h-3.5 w-3.5" />{user.role}
                  </span>
                </td>
                <td className="px-4 sm:px-6 py-3 sm:py-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${user.isActive ? 'bg-success/15 text-success' : 'bg-muted text-muted-foreground'}`}>
                    {user.isActive ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td className="px-4 sm:px-6 py-3 sm:py-4 font-mono text-xs text-muted-foreground">
                  {user.lastLogin ? new Date(user.lastLogin).toLocaleString('id-ID') : 'Belum pernah'}
                </td>
                <td className="px-4 sm:px-6 py-3 sm:py-4">
                  <button 
                    type="button"
                    onClick={() => edit(user)} 
                    className="min-h-9 rounded-md border border-border px-3 text-xs hover:bg-secondary cursor-pointer font-medium"
                  >
                    Ubah
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
