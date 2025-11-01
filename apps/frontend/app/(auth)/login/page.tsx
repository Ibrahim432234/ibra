'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import type { ApiResponse, AuthUser } from '@autoinvoice/shared';

export default function LoginPage(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { data } = await api.post<ApiResponse<{ token: string; user: AuthUser }>>('/auth/login', { email, password });
      const token = data.data?.token;
      if (token != null) {
        localStorage.setItem('autoinvoice_token', token);
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Login fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Login</h1>
        <p className="text-sm text-slate-300">Melde dich an, um Rechnungen zu erstellen und Abos zu verwalten.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset className="grid gap-2">
          <label className="text-sm text-slate-300" htmlFor="email">E-Mail</label>
          <input
            id="email"
            type="email"
            required
            className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </fieldset>

        <fieldset className="grid gap-2">
          <label className="text-sm text-slate-300" htmlFor="password">Passwort</label>
          <input
            id="password"
            type="password"
            required
            className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </fieldset>

        {error != null && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? 'Login...' : 'Anmelden'}
        </button>
      </form>
    </div>
  );
}
