import useSWR from 'swr';
import api from '../lib/api';
import type { ApiResponse } from '@autoinvoice/shared';

export interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  status: string;
  totalCents: number;
  currency: string;
  issueDate: string;
  pdfStoragePath?: string | null;
}

const fetcher = async (url: string): Promise<InvoiceListItem[]> => {
  const { data } = await api.get<ApiResponse<InvoiceListItem[]>>(url);
  return data.data ?? [];
};

export const useInvoices = () => {
  const { data, error, mutate } = useSWR('/invoices', fetcher);

  return {
    invoices: data ?? [],
    loading: data === undefined && error === undefined,
    error,
    mutate
  };
};
