'use client';

import { useState } from 'react';
import api from '../../lib/api';
import type { InvoiceListItem } from '../../hooks/useInvoices';

interface Props {
  invoices: InvoiceListItem[];
}

const formatCurrency = (amount: number, currency: string) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount / 100);

export default function InvoiceList({ invoices }: Props): JSX.Element {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (invoices.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-6 text-sm text-slate-300">
        Noch keine Rechnungen erstellt.
      </div>
    );
  }

  const handleDownload = async (invoiceId: string, invoiceNumber: string) => {
    setDownloadingId(invoiceId);
    try {
      const response = await api.get(`/invoices/${invoiceId}/pdf`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${invoiceNumber}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('PDF konnte nicht geladen werden.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800">
      <table className="min-w-full divide-y divide-slate-800">
        <thead className="bg-slate-900/70 text-left text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3">Rechnungsnummer</th>
            <th className="px-4 py-3">Datum</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3 text-right">Aktionen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 text-sm">
          {invoices.map((invoice) => (
            <tr key={invoice.id} className="bg-slate-950/40">
              <td className="px-4 py-3 font-mono text-slate-200">{invoice.invoiceNumber}</td>
              <td className="px-4 py-3 text-slate-300">{new Date(invoice.issueDate).toLocaleDateString('de-DE')}</td>
              <td className="px-4 py-3 text-slate-300">{invoice.status}</td>
              <td className="px-4 py-3 text-right text-slate-100">
                {formatCurrency(invoice.totalCents, invoice.currency)}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  className="text-sm text-accent hover:text-blue-400 disabled:opacity-50"
                  disabled={downloadingId === invoice.id || invoice.pdfStoragePath == null}
                  onClick={() => handleDownload(invoice.id, invoice.invoiceNumber)}
                >
                  {invoice.pdfStoragePath == null
                    ? 'PDF in Erstellung'
                    : downloadingId === invoice.id
                    ? 'Laedt...'
                    : 'PDF herunterladen'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
