export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
}

export interface InvoiceItemPayload {
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRatePercent: number;
}

export interface InvoicePayload {
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  currency: string;
  notes?: string;
  isSmallBusiness: boolean;
  customer: {
    id?: string;
    name: string;
    email?: string;
    company?: string;
    street?: string;
    postalCode?: string;
    city?: string;
    country?: string;
  };
  items: InvoiceItemPayload[];
}

export interface AuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  vatId?: string;
  taxNumber?: string;
  isSmallBiz: boolean;
  createdAt: string;
}
