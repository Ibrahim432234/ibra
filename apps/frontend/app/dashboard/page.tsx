'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { useInvoices } from '../../hooks/useInvoices';
import InvoiceForm from '../../components/invoices/InvoiceForm';
import InvoiceList from '../../components/invoices/InvoiceList';
import SubscribeButton from '../../components/billing/SubscribeButton';

export default function DashboardPage(): JSX.Element {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { invoices, loading: invoicesLoading, mutate } = useInvoices();

  useEffect(() => {
    if (!authLoading && user == null) {
      router.push('/login');
    }
  }, [authLoading, user, router]);

  if (authLoading || user == null) {
    return <p className="text-slate-300">Lade Dashboard...</p>;
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-sm text-slate-300">
            Willkommen zurueck, {user.firstName ?? user.email}. Hier verwaltest du Rechnungen, Abonnements und PDF-Exporte.
          </p>
        </div>
        <SubscribeButton />
      </header>

      <InvoiceForm onCreated={() => mutate()} />

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Rechnungsuebersicht</h2>
          <button
            onClick={() => mutate()}
            className="rounded-md border border-slate-700 px-3 py-1 text-sm text-slate-200 hover:bg-slate-800"
          >
            Aktualisieren
          </button>
        </div>
        {invoicesLoading ? <p className="text-slate-300">Lade Rechnungen...</p> : <InvoiceList invoices={invoices} />}
      </section>

      <section className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-300">
        <h2 className="text-lg font-semibold text-slate-100">DSGVO & Compliance</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Schliesse Auftragsverarbeitungsvertraege mit Hoster, Stripe und Mail-Provider.</li>
          <li>Fuehre ein Verzeichnis der Verarbeitungstaetigkeiten und pruefe regelmaessig Sicherheitsmassnahmen.</li>
          <li>Bei Anwendung der Kleinunternehmerregelung fuege den Hinweis "Gemaess ? 19 UStG wird keine Umsatzsteuer berechnet." jeder Rechnung hinzu.</li>
          <li>Aktiviere HSTS und sichere deine Domains mit TLS-Zertifikaten (z. B. Lets Encrypt).</li>
        </ul>
      </section>
    </div>
  );
}
