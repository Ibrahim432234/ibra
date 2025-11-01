import { z } from 'zod';

export const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive().default(1),
  unitPriceCents: z.number().int().nonnegative(),
  taxRatePercent: z.number().min(0).max(100).default(19)
});

export const invoiceSchema = z.object({
  invoiceNumber: z.string().min(1),
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date().optional(),
  currency: z.string().length(3).default('EUR'),
  customer: z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    email: z.string().email().optional(),
    company: z.string().optional(),
    street: z.string().optional(),
    postalCode: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional()
  }),
  items: z.array(invoiceItemSchema).min(1),
  notes: z.string().optional(),
  isSmallBusiness: z.boolean().default(false)
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type InvoiceItemInput = z.infer<typeof invoiceItemSchema>;
