'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { apiClient } from '@/lib/axios';

const schema = z
  .object({
    name: z.string().min(2, 'Ingresa tu nombre.'),
    email: z.string().email('Ingresa un email válido.'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres.'),
    confirmPassword: z.string().min(6, 'Confirma tu contraseña.'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Las contraseñas no coinciden.',
  });

type RegisterForm = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(schema),
  });

  const registerMutation = useMutation({
    mutationFn: async (values: RegisterForm) => {
      const payload = {
        name: values.name,
        email: values.email,
        password: values.password,
      };
      const { data } = await apiClient.post('/auth/register', payload);
      return data;
    },
    onSuccess: () => {
      router.push('/login');
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg rounded-[2rem] border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-slate-950/40">
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">Aurora</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Crear cuenta</h1>
        <p className="mt-2 text-sm text-slate-400">Arma tu espacio de trabajo y conecta tu portfolio al backend.</p>

        <form className="mt-8 grid gap-5" onSubmit={handleSubmit((values) => registerMutation.mutate(values))}>
          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Nombre</span>
            <input {...register('name')} className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-500" />
            {errors.name ? <p className="text-xs text-rose-300">{errors.name.message}</p> : null}
          </label>

          <label className="block space-y-2">
            <span className="text-sm text-slate-300">Email</span>
            <input {...register('email')} type="email" className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-500" />
            {errors.email ? <p className="text-xs text-rose-300">{errors.email.message}</p> : null}
          </label>

          <div className="grid gap-5 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Contraseña</span>
              <input {...register('password')} type="password" className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-500" />
              {errors.password ? <p className="text-xs text-rose-300">{errors.password.message}</p> : null}
            </label>

            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Confirmar contraseña</span>
              <input {...register('confirmPassword')} type="password" className="w-full rounded-2xl border border-slate-700 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-cyan-500" />
              {errors.confirmPassword ? <p className="text-xs text-rose-300">{errors.confirmPassword.message}</p> : null}
            </label>
          </div>

          {registerMutation.isError ? <ErrorMessage message="No pudimos registrar la cuenta. Revisa los datos e intenta de nuevo." /> : null}

          <button type="submit" disabled={registerMutation.isPending} className="rounded-2xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60">
            {registerMutation.isPending ? 'Creando cuenta...' : 'Registrarme'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-400">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="font-medium text-cyan-300 transition hover:text-cyan-200">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
