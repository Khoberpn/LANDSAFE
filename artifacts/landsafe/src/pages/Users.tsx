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
      setError('Kata sandi harus 12–72 byte.'); return;
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Kelola akun dan hak akses LANDSAFE.</p>
        <button onClick={() => { setEditor({ ...blank }); setError(''); setNotice(''); }} className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">Tambah pengguna</button>
      </div>
      {notice && <p role="status" className="text-sm text-success">{notice}</p>}
      {editor && (
        <form onSubmit={save} className="rounded-xl border border-border bg-card p-6 space-y-4">
          <h2 className="text-lg font-semibold">{editor.id ? 'Ubah pengguna' : 'Tambah pengguna'}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">Nama
              <input required maxLength={120} value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-3" />
            </label>
            <label className="text-sm">Email
              <input required type="email" maxLength={254} value={editor.email} onChange={e => setEditor({ ...editor, email: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-3" />
            </label>
            <label className="text-sm">Peran
              <select value={editor.role} onChange={e => setEditor({ ...editor, role: e.target.value as UserInputRole })} disabled={editor.id === self?.id} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-3">
                <option value="public">Public</option><option value="operator">Operator</option><option value="admin">Admin</option>
              </select>
            </label>
            <label className="text-sm">{editor.id === self?.id ? 'Gunakan halaman Settings untuk kata sandi sendiri' : editor.id ? 'Reset kata sandi (kosongkan jika tidak berubah)' : 'Kata sandi awal'}
              <input type="password" autoComplete="new-password" required={!editor.id} disabled={editor.id === self?.id} value={editor.password} onChange={e => setEditor({ ...editor, password: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-3" />
            </label>
          </div>
          {editor.id && <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={editor.isActive} disabled={editor.id === self?.id} onChange={e => setEditor({ ...editor, isActive: e.target.checked })} /> Akun aktif</label>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={busy} className="min-h-11 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">{busy ? 'Menyimpan…' : 'Simpan'}</button>
            <button type="button" onClick={() => setEditor(null)} className="min-h-11 rounded-md border border-border px-4 text-sm">Batal</button>
          </div>
        </form>
      )}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-secondary/30 text-xs uppercase text-muted-foreground"><tr><th className="px-6 py-4">Pengguna</th><th className="px-6 py-4">Peran</th><th className="px-6 py-4">Status</th><th className="px-6 py-4">Login terakhir</th><th className="px-6 py-4">Aksi</th></tr></thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={5} className="p-8 text-center">Memuat pengguna…</td></tr>}
            {isError && <tr><td colSpan={5} className="p-8 text-center text-destructive">Gagal memuat pengguna.</td></tr>}
            {users?.map(user => (
              <tr key={user.id}>
                <td className="px-6 py-4"><span className="flex items-center gap-2"><UserCircle className="h-5 w-5" />{user.name}</span><span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Mail className="h-3 w-3" />{user.email}</span></td>
                <td className="px-6 py-4"><span className="flex items-center gap-1"><Shield className="h-4 w-4" />{user.role}</span></td>
                <td className="px-6 py-4">{user.isActive ? 'Aktif' : 'Nonaktif'}</td>
                <td className="px-6 py-4">{user.lastLogin ? new Date(user.lastLogin).toLocaleString('id-ID') : 'Belum pernah'}</td>
                <td className="px-6 py-4"><button onClick={() => edit(user)} className="min-h-11 rounded-md border border-border px-3 hover:bg-secondary">Ubah</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
