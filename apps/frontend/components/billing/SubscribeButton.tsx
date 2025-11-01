'use client';

import { useState } from 'react';
import api from '../../lib/api';
import type { ApiResponse } from '@autoinvoice/shared';

interface CheckoutSession {
  url?: string | null;
}

export default function SubscribeButton(): JSX.Element {
  const [loading, setLoading] = useState(false);

  const startCheckout = async () => {
    setLoading(true);
    try {
      const { data } = await api.post<ApiResponse<CheckoutSession>>('/stripe/checkout-session');
      const url = data.data?.url;
      if (url != null) {
        window.location.href = url;
      }
    } catch {
      alert('Stripe Checkout konnte nicht gestartet werden.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={startCheckout}
      disabled={loading}
      className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
    >
      {loading ? 'Weiterleitung?' : 'Abo aktivieren'}
    </button>
  );
}
