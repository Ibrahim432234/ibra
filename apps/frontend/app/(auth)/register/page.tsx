'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../../lib/api';
import type { ApiResponse, AuthUser } from '@autoinvoice/shared';

interface RegisterForm {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
  vatId: string;
  taxNumber: string;
  isSmallBiz: boolean;
}

const initialState: RegisterForm = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  companyName: '',
  vatId: '',
  taxNumber: '',
  isSmallBiz: false
};

export default function RegisterPage(): JSX.Element {
  const router = useRouter();
  const [form, setForm] = useState<RegisterForm>(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = (field: keyof RegisterForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...form,
        isSmallBiz: Boolean(form.isSmallBiz)
      };
      const { data } = await api.post<ApiResponse<{ token: string; user: AuthUser }>>('/auth/register', payload);
      const token = data.data?.token;
      if (token != null) {
        localStorage.setItem('autoinvoice_token', token);
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Registrierung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Konto anlegen</h1>
        <p className="text-sm text-slate-300">Starte dein AutoInvoice Konto f?r rechtssichere Rechnungen.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <fieldset className="grid gap-2">
          <label className="text-sm text-slate-300" htmlFor="email">E-Mail Adresse</label>
          <input
            id="email"
            type="email"
            required
            className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
            value={form.email}
            onChange={(event) => updateField('email', event.target.value)}
          />
        </fieldset>

        <fieldset className="grid gap-2">
          <label className="text-sm text-slate-300" htmlFor="password">Passwort (min. 12 Zeichen)</label>
          <input
            id="password"
            type="password"
            minLength={12}
            required
            className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
            value={form.password}
            onChange={(event) => updateField('password', event.target.value)}
          />
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="grid gap-2">
            <label className="text-sm text-slate-300" htmlFor="firstName">Vorname</label>
            <input
              id="firstName"
              required
              className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
              value={form.firstName}
              onChange={(event) => updateField('firstName', event.target.value)}
            />
          </fieldset>
          <fieldset className="grid gap-2">
            <label className="text-sm text-slate-300" htmlFor="lastName">Nachname</label>
            <input
              id="lastName"
              required
              className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
              value={form.lastName}
              onChange={(event) => updateField('lastName', event.target.value)}
            />
          </fieldset>
        </div>

        <fieldset className="grid gap-2">
          <label className="text-sm text-slate-300" htmlFor="companyName">Unternehmen / Freiberuf</label>
          <input
            id="companyName"
            className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
            value={form.companyName}
            onChange={(event) => updateField('companyName', event.target.value)}
          />
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="grid gap-2">
            <label className="text-sm text-slate-300" htmlFor="vatId">USt-ID (optional)</label>
            <input
              id="vatId"
              className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
              value={form.vatId}
              onChange={(event) => updateField('vatId', event.target.value)}
            />
          </fieldset>
          <fieldset className="grid gap-2">
            <label className="text-sm text-slate-300" htmlFor="taxNumber">Steuernummer (optional)</label>
            <input
              id="taxNumber"
              className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-slate-100"
              value={form.taxNumber}
              onChange={(event) => updateField('taxNumber', event.target.value)}
            />
          </fieldset>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={form.isSmallBiz}
            onChange={(event) => updateField('isSmallBiz', event.target.checked)}
          />
          Kleinunternehmerregelung (? 19 UStG) anwenden
        </label>

        {error != null && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-accent px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? 'Registriere...' : 'Jetzt registrieren'}
        </button>
      </form>
    </div>
  );
}
