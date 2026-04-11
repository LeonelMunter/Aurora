'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { apiClient } from '@/lib/axios';
import { persistAuthSession } from '@/lib/auth';
import { useAppStore } from '@/store/useAppStore';
import type { AuthResponse } from '@/types/app';

const schema = z.object({
  email: z.string().email('Ingrese un email válido.'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
});

type LoginForm = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAppStore((state) => state.setUser);
  const setToken = useAppStore((state) => state.setToken);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (values: LoginForm) => {
      const { data } = await apiClient.post<AuthResponse>('/auth/login', values);
      return data;
    },
    onSuccess: (data) => {
      setUser(data.user);
      setToken(data.accessToken);
      persistAuthSession(data.accessToken, data.refreshToken);
      const redirect = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('redirect') : null;
      router.push(redirect || '/');
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-[2rem] border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40">
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">Aurora</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-slate-400">Conecta tu cuenta y retomo el seguimiento de tu portfolio.</p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit((values) => loginMutation.mutate(values))}>
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Email</span>
            <input
              {...register('email')}
              type="email"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
              placeholder="vos@email.com"
            />
            {errors.email ? <p className="text-xs text-rose-300">{errors.email.message}</p> : null}
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Contraseña</span>
            <input
              {...register('password')}
              type="password"
              className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
              placeholder="••••••••"
            />
            {errors.password ? <p className="text-xs text-rose-300">{errors.password.message}</p> : null}
          </label>

          {loginMutation.isError ? <ErrorMessage message="Credenciales incorrectas o sesión no disponible." /> : null}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full rounded-2xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loginMutation.isPending ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-400">
          ¿No tenés cuenta?{' '}
          <Link href="/register" className="font-medium text-cyan-300 transition hover:text-cyan-200">
            Registrate
          </Link>
        </p>
      </div>
    </div>
  );
}
