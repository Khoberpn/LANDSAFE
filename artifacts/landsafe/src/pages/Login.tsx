import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useLocation } from 'wouter';
import { Shield, KeyRound, Mail, AlertCircle, MapPin, Clock, ArrowLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLogin } from '@workspace/api-client-react';

const loginSchema = z.object({
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(1, 'Kata sandi wajib diisi'),
  rememberMe: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { user, login: setAuthContext } = useAuth();
  const [time, setTime] = React.useState(new Date());

  const loginMutation = useLogin();

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Already signed in: skip the form entirely.
  React.useEffect(() => {
    if (user) setLocation(user.role === 'public' ? '/live-map' : '/dashboard');
  }, [user, setLocation]);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  const onSubmit = (data: LoginForm) => {
    loginMutation.mutate({ data }, {
      onSuccess: (res) => {
        setAuthContext(res.token, res.user);
        setLocation(res.user.role === 'public' ? '/live-map' : '/dashboard');
      },
      onError: (err) => {
        console.error(err);
      }
    });
  };

  const formattedTime = time.toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta'
  }) + ' WIB';

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-x-hidden overflow-y-auto bg-background p-4 py-12">
      {/* Soft topographic backdrop */}
      <div
        className="absolute inset-0 pointer-events-none opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(20,83,45,0.06), transparent 40%), radial-gradient(circle at 80% 70%, rgba(202,138,4,0.06), transparent 40%)',
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundSize: '48px 48px',
          backgroundImage:
            'linear-gradient(to right, rgba(20,83,45,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(20,83,45,0.05) 1px, transparent 1px)',
        }}
      />

      <div className="hidden md:flex absolute top-6 right-6 items-center gap-3 z-10">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-primary/10 shadow-sm">
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
          </div>
          <span className="text-xs font-semibold text-primary uppercase tracking-wide">Sistem Operasional</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-primary/10 shadow-sm">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-bold text-primary tabular-nums">{formattedTime}</span>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-md p-5 sm:p-8 rounded-2xl sm:rounded-3xl bg-white border border-primary/5 shadow-[0_20px_50px_-12px_rgba(20,83,45,0.15)] my-auto">
        <div className="flex flex-col items-center mb-6 sm:mb-8">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-primary flex items-center justify-center mb-3 sm:mb-4 shadow-lg shadow-primary/25">
            <Shield className="w-7 h-7 sm:w-8 sm:h-8 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-primary mb-1">LANDSAFE</h1>
          <p className="text-[10px] sm:text-xs font-semibold text-primary/60 text-center uppercase tracking-wider">Badan Penanggulangan Bencana Daerah</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mb-6">
          {loginMutation.isError && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm font-medium text-destructive">Autentikasi gagal. Periksa kembali email dan kata sandi Anda.</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-primary/70">Operator ID (Email)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-primary/40" />
              </div>
              <input
                {...form.register('email')}
                type="email"
                className="w-full bg-background border border-primary/15 rounded-full py-2.5 sm:py-3 pl-10 sm:pl-11 pr-4 text-base sm:text-sm text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                placeholder="operator@landsafe.gov.id"
              />
            </div>
            {form.formState.errors.email && <p className="text-xs font-medium text-destructive pl-2">{form.formState.errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-primary/70">Kata Sandi</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                <KeyRound className="h-4 w-4 text-primary/40" />
              </div>
              <input
                {...form.register('password')}
                type="password"
                className="w-full bg-background border border-primary/15 rounded-full py-2.5 sm:py-3 pl-10 sm:pl-11 pr-4 text-base sm:text-sm text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                placeholder="••••••••"
              />
            </div>
            {form.formState.errors.password && <p className="text-xs font-medium text-destructive pl-2">{form.formState.errors.password.message}</p>}
          </div>

          <div className="flex items-center pl-2 pt-1">
            <input
              {...form.register('rememberMe')}
              type="checkbox"
              id="remember"
              className="h-4 w-4 rounded border-primary/20 bg-background text-primary focus:ring-primary"
            />
            <label htmlFor="remember" className="ml-2 block text-xs sm:text-sm font-medium text-muted-foreground cursor-pointer">
              Pertahankan sesi aman
            </label>
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full min-h-11 py-2.5 sm:py-3 px-4 rounded-full bg-primary text-primary-foreground font-bold text-xs sm:text-sm shadow-md shadow-primary/25 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30 active:translate-y-0 active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60 disabled:hover:translate-y-0 flex items-center justify-center gap-2 cursor-pointer"
          >
            {loginMutation.isPending ? 'Mengautentikasi…' : 'Masuk ke Sistem'}
          </button>

          <button
            type="button"
            onClick={() => setLocation('/live-map')}
            className="w-full min-h-10 py-2 sm:py-2.5 px-4 rounded-full border border-primary/15 text-primary/80 font-semibold text-xs sm:text-sm hover:bg-background hover:text-primary transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Lanjutkan sebagai tamu
          </button>
        </form>

        <p className="text-[10px] sm:text-[11px] font-semibold text-primary/50 text-center uppercase tracking-wider flex items-center justify-center gap-1.5 pt-2 border-t border-border">
          <MapPin className="w-3 h-3 text-primary/60 shrink-0" /> Khusus Personel Berwenang • BPBD Jawa Tengah
        </p>
      </div>
    </div>
  );
}
