import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useLocation } from 'wouter';
import { Shield, KeyRound, Mail, AlertCircle, MapPin, Clock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLogin } from '@workspace/api-client-react';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { login: setAuthContext } = useAuth();
  const [time, setTime] = React.useState(new Date());

  const loginMutation = useLogin();

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background">
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

      <div className="absolute top-6 right-6 flex items-center gap-3 z-10">
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

      <div className="relative z-10 w-full max-w-md p-8 rounded-3xl bg-white border border-primary/5 shadow-[0_20px_50px_-12px_rgba(20,83,45,0.15)]">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/25">
            <Shield className="w-8 h-8 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-primary mb-1">LANDSAFE</h1>
          <p className="text-xs font-semibold text-primary/60 text-center uppercase tracking-wider">Badan Nasional Penanggulangan Bencana</p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mb-8">
          {loginMutation.isError && (
            <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm font-medium text-destructive">Autentikasi gagal. Periksa kembali kredensial Anda.</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-primary/60">Operator ID (Email)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 text-primary/40" />
              </div>
              <input
                {...form.register('email')}
                type="email"
                className="w-full bg-background border border-primary/10 rounded-full py-2.5 pl-11 pr-4 text-sm text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                placeholder="operator@landsafe.gov.id"
              />
            </div>
            {form.formState.errors.email && <p className="text-xs font-medium text-destructive pl-2">{form.formState.errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-primary/60">Clearance Code (Password)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <KeyRound className="h-4 w-4 text-primary/40" />
              </div>
              <input
                {...form.register('password')}
                type="password"
                className="w-full bg-background border border-primary/10 rounded-full py-2.5 pl-11 pr-4 text-sm text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-shadow"
                placeholder="••••••••"
              />
            </div>
            {form.formState.errors.password && <p className="text-xs font-medium text-destructive pl-2">{form.formState.errors.password.message}</p>}
          </div>

          <div className="flex items-center pl-2">
            <input
              {...form.register('rememberMe')}
              type="checkbox"
              id="remember"
              className="h-4 w-4 rounded border-primary/20 bg-background text-primary focus:ring-primary"
            />
            <label htmlFor="remember" className="ml-2 block text-sm font-medium text-muted-foreground">
              Pertahankan sesi aman
            </label>
          </div>

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full py-3 px-4 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-md shadow-primary/25 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/30 active:translate-y-0 active:scale-[0.98] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
          >
            {loginMutation.isPending ? 'Mengautentikasi…' : 'Masuk ke Sistem'}
          </button>
        </form>

      </div>

      <div className="absolute bottom-4 text-center w-full z-10 pointer-events-none">
        <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest flex items-center justify-center gap-1.5">
          <MapPin className="w-3 h-3" /> Khusus Personel Berwenang • BPBD/BNPB Jawa Tengah
        </p>
      </div>
    </div>
  );
}