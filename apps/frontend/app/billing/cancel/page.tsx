export default function BillingCancelled(): JSX.Element {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Zahlung abgebrochen</h1>
      <p className="text-sm text-slate-300">
        Die Zahlung wurde abgebrochen. Dein Abo wurde nicht ge?ndert. Wenn das ein Versehen war, starte den Checkout erneut.
      </p>
    </div>
  );
}
