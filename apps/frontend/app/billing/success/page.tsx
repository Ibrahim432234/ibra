export default function BillingSuccess(): JSX.Element {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Zahlung erfolgreich</h1>
      <p className="text-sm text-slate-300">
        Danke! Deine Stripe-Zahlung wurde best?tigt. Dein AutoInvoice-Abo ist aktiv. Du kannst das Fenster schlie?en.
      </p>
    </div>
  );
}
