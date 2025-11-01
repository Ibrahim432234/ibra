import Link from 'next/link';

const features = [
  'Rechnungen in Sekunden als PDF erzeugen',
  'DSGVO-konforme Datenspeicherung in Deutschland',
  'Mehrwertsteuer & Kleinunternehmer-Option integriert',
  'Stripe-Abos & sichere Zahlungsabwicklung',
  'Versionierte Vorlagen, Monitoring & Backups'
];

export default function LandingPage(): JSX.Element {
  return (
    <div className="space-y-12">
      <section className="space-y-6 text-balance">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">AutoInvoice</h1>
        <p className="text-lg text-slate-300 sm:text-xl">
          Das schlanke SaaS f?r Freelancer und Studierende in Deutschland. Erstelle rechtssichere Rechnungen, sichere PDFs, verwalte Kunden und Abos ? mit Hosting in Deutschland und Security-by-Design.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link href="/register" className="rounded-md bg-accent px-6 py-3 font-semibold text-white hover:bg-blue-500">
            Jetzt starten
          </Link>
          <Link href="/login" className="rounded-md border border-slate-700 px-6 py-3 font-semibold text-slate-100 hover:bg-slate-800">
            Login
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold">Was AutoInvoice liefert</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {features.map((feature) => (
            <li key={feature} className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-200">
              {feature}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold">Security & Compliance</h2>
        <p className="text-sm text-slate-300">
          HTTPS + HSTS, CSP, Penetration-Tests, AV-Vertr?ge, DSGVO-Dokumentation und Kleinunternehmer-Hinweise sind von Anfang an drin. AutoInvoice hilft dir, Rechnungen nach UStG zu erstellen und alle Pflichtangaben korrekt auszuweisen.
        </p>
      </section>
    </div>
  );
}
