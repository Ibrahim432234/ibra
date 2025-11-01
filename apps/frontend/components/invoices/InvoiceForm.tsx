'use client';

import { useState } from 'react';
import api from '../../lib/api';
import type { ApiResponse, InvoicePayload } from '@autoinvoice/shared';

const emptyItem = () => ({ description: '', quantity: 1, unitPriceCents: 0, taxRatePercent: 19 });

interface Props {
  onCreated?: () => void;
}

export default function InvoiceForm({ onCreated }: Props): JSX.Element {
  const [invoice, setInvoice] = useState<InvoicePayload>({
    invoiceNumber: `INV-${Date.now()}`,
    issueDate: new Date().toISOString().split('T')[0],
    currency: 'EUR',
    isSmallBusiness: false,
    customer: { name: '' },
    items: [emptyItem()]
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateField = <K extends keyof InvoicePayload>(field: K, value: InvoicePayload[K]) => {
    setInvoice((prev) => ({ ...prev, [field]: value }));
  };

  const updateCustomerField = (field: keyof InvoicePayload['customer'], value: string) => {
    setInvoice((prev) => ({
      ...prev,
      customer: {
        ...prev.customer,
        [field]: value
      }
    }));
  };

  const updateItem = (index: number, field: keyof InvoicePayload['items'][number], value: any) => {
    setInvoice((prev) => ({
      ...prev,
      items: prev.items.map((item, idx) => (idx === index ? { ...item, [field]: value } : item))
    }));
  };

  const addItem = () => {
    setInvoice((prev) => ({
      ...prev,
      items: [...prev.items, emptyItem()]
    }));
  };

  const removeItem = (index: number) => {
    setInvoice((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index)
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload: InvoicePayload = {
        ...invoice,
        issueDate: new Date(invoice.issueDate).toISOString(),
        dueDate: invoice.dueDate != null ? new Date(invoice.dueDate).toISOString() : undefined,
        items: invoice.items.map((item) => ({
          ...item,
          quantity: Number(item.quantity),
          unitPriceCents: Math.round(Number(item.unitPriceCents)),
          taxRatePercent: Number(item.taxRatePercent)
        }))
      };
      await api.post<ApiResponse<any>>('/invoices', payload);
      onCreated?.();
      setInvoice((prev) => ({
        ...prev,
        invoiceNumber: `INV-${Date.now()}`,
        items: [emptyItem()]
      }));
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Rechnung konnte nicht erstellt werden.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-lg border border-slate-800 bg-slate-950/50 p-6">
      <div>
        <h2 className="text-xl font-semibold">Neue Rechnung</h2>
        <p className="text-sm text-slate-400">Pflichtangaben nach ? 14 UStG, inkl. Kleinunternehmerhinweis.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="grid gap-2">
          <label className="text-sm text-slate-300" htmlFor="invoiceNumber">Rechnungsnummer</label>
          <input
            id="invoiceNumber"
            required
            className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
            value={invoice.invoiceNumber}
            onChange={(event) => updateField('invoiceNumber', event.target.value)}
          />
        </fieldset>
        <fieldset className="grid gap-2">
          <label className="text-sm text-slate-300" htmlFor="issueDate">Leistungsdatum</label>
          <input
            id="issueDate"
            type="date"
            required
            className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
            value={invoice.issueDate}
            onChange={(event) => updateField('issueDate', event.target.value)}
          />
        </fieldset>
        <fieldset className="grid gap-2">
          <label className="text-sm text-slate-300" htmlFor="dueDate">F?llig bis</label>
          <input
            id="dueDate"
            type="date"
            className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
            value={invoice.dueDate ?? ''}
            onChange={(event) => updateField('dueDate', event.target.value)}
          />
        </fieldset>
        <fieldset className="grid gap-2">
          <label className="text-sm text-slate-300" htmlFor="currency">W?hrung</label>
          <input
            id="currency"
            className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
            value={invoice.currency}
            onChange={(event) => updateField('currency', event.target.value)}
          />
        </fieldset>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Kundenangaben</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset className="grid gap-2">
            <label className="text-sm text-slate-300" htmlFor="customerName">Name / Unternehmen</label>
            <input
              id="customerName"
              required
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
              value={invoice.customer.name}
              onChange={(event) => updateCustomerField('name', event.target.value)}
            />
          </fieldset>
          <fieldset className="grid gap-2">
            <label className="text-sm text-slate-300" htmlFor="customerEmail">E-Mail</label>
            <input
              id="customerEmail"
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
              value={invoice.customer.email ?? ''}
              onChange={(event) => updateCustomerField('email', event.target.value)}
            />
          </fieldset>
          <fieldset className="grid gap-2 sm:col-span-2">
            <label className="text-sm text-slate-300" htmlFor="customerStreet">Adresse</label>
            <input
              id="customerStreet"
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
              value={invoice.customer.street ?? ''}
              onChange={(event) => updateCustomerField('street', event.target.value)}
            />
          </fieldset>
          <fieldset className="grid gap-2">
            <label className="text-sm text-slate-300" htmlFor="customerPostalCode">PLZ</label>
            <input
              id="customerPostalCode"
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
              value={invoice.customer.postalCode ?? ''}
              onChange={(event) => updateCustomerField('postalCode', event.target.value)}
            />
          </fieldset>
          <fieldset className="grid gap-2">
            <label className="text-sm text-slate-300" htmlFor="customerCity">Ort</label>
            <input
              id="customerCity"
              className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
              value={invoice.customer.city ?? ''}
              onChange={(event) => updateCustomerField('city', event.target.value)}
            />
          </fieldset>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Leistungspositionen</h3>
        {invoice.items.map((item, index) => (
          <div key={index} className="rounded-md border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <fieldset className="grid gap-2">
              <label className="text-sm text-slate-300">Beschreibung</label>
              <input
                required
                className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
                value={item.description}
                onChange={(event) => updateItem(index, 'description', event.target.value)}
              />
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-3">
              <fieldset className="grid gap-2">
                <label className="text-sm text-slate-300">Menge</label>
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
                  value={item.quantity}
                  onChange={(event) => updateItem(index, 'quantity', Number(event.target.value))}
                />
              </fieldset>
              <fieldset className="grid gap-2">
                <label className="text-sm text-slate-300">Einzelpreis (Cent)</label>
                <input
                  type="number"
                  min={0}
                  className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
                  value={item.unitPriceCents}
                  onChange={(event) => updateItem(index, 'unitPriceCents', Number(event.target.value))}
                />
              </fieldset>
              <fieldset className="grid gap-2">
                <label className="text-sm text-slate-300">MwSt. (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-slate-100"
                  value={item.taxRatePercent}
                  onChange={(event) => updateItem(index, 'taxRatePercent', Number(event.target.value))}
                />
              </fieldset>
            </div>
            {invoice.items.length > 1 && (
              <button type="button" onClick={() => removeItem(index)} className="text-sm text-red-400 hover:text-red-300">
                Position entfernen
              </button>
            )}
          </div>
        ))}

        <button type="button" onClick={addItem} className="text-sm text-accent hover:text-blue-400">
          + Position hinzuf?gen
        </button>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={invoice.isSmallBusiness}
          onChange={(event) => updateField('isSmallBusiness', event.target.checked)}
        />
        Kleinunternehmerregelung (? 19 UStG)
      </label>

      {error != null && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md bg-accent px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {loading ? 'Speichere...' : 'Rechnung erstellen'}
      </button>
    </form>
  );
}
