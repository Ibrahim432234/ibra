import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AutoInvoice ? Rechtssichere Rechnungen in Sekunden',
  description: 'Erstelle rechtssichere Rechnungen f?r Deutschland mit AutoInvoice. PDF-Export, DSGVO-konform, Stripe-Abrechnung.'
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="de">
      <body>
        <div className="min-h-screen bg-slate-900 text-slate-100">
          <main className="mx-auto max-w-5xl px-6 py-12">{children}</main>
        </div>
      </body>
    </html>
  );
}
