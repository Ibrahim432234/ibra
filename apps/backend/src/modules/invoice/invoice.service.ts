import type { Invoice, InvoiceItem, Customer, Prisma } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type { InvoiceInput, InvoiceItemInput } from './invoice.schema.js';
import { generateInvoicePdf, type InvoicePdfItem } from '../../utils/pdf.js';
import { uploadPdfBuffer } from '../../utils/storage.js';

interface InvoiceWithRelations extends Invoice {
  items: InvoiceItem[];
  customer: Customer | null;
}

export const listInvoices = async (userId: string): Promise<InvoiceWithRelations[]> => {
  return await prisma.invoice.findMany({
    where: { userId },
    include: { items: true, customer: true },
    orderBy: { issueDate: 'desc' }
  });
};

export const getInvoiceById = async (userId: string, invoiceId: string): Promise<InvoiceWithRelations | null> => {
  return await prisma.invoice.findFirst({
    where: { id: invoiceId, userId },
    include: { items: true, customer: true }
  });
};

export const createInvoice = async (userId: string, payload: InvoiceInput): Promise<InvoiceWithRelations> => {
  const { totals, prismaItems, pdfItems } = calculateTotals(payload.items);

  const customer = await upsertCustomer(userId, payload.customer);

  const invoice = await prisma.invoice.create({
    data: {
      userId,
      customerId: customer?.id,
      invoiceNumber: payload.invoiceNumber,
      issueDate: payload.issueDate,
      dueDate: payload.dueDate,
      currency: payload.currency,
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      taxRatePercent: totals.taxRatePercent,
      isSmallBusiness: payload.isSmallBusiness,
      notes: payload.notes,
      items: {
        createMany: {
          data: prismaItems
        }
      }
    },
    include: { items: true, customer: true }
  });

  const pdfBuffer = await generateInvoicePdf(invoice, customer, pdfItems);
  const storagePath = await uploadPdfBuffer(userId, invoice.invoiceNumber, pdfBuffer);

  return await prisma.invoice.update({
    where: { id: invoice.id },
    data: { pdfStoragePath: storagePath },
    include: { items: true, customer: true }
  });
};

export const updateInvoice = async (userId: string, invoiceId: string, payload: InvoiceInput): Promise<InvoiceWithRelations> => {
  const existing = await getInvoiceById(userId, invoiceId);
  if (existing == null) {
    const error = new Error('Invoice not found');
    (error as any).status = 404;
    throw error;
  }

  const { totals, prismaItems, pdfItems } = calculateTotals(payload.items);
  const customer = await upsertCustomer(userId, payload.customer);

  await prisma.invoiceItem.deleteMany({ where: { invoiceId } });

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      customerId: customer?.id,
      invoiceNumber: payload.invoiceNumber,
      issueDate: payload.issueDate,
      dueDate: payload.dueDate,
      currency: payload.currency,
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      totalCents: totals.totalCents,
      taxRatePercent: totals.taxRatePercent,
      isSmallBusiness: payload.isSmallBusiness,
      notes: payload.notes,
      items: {
        createMany: {
          data: prismaItems
        }
      }
    },
    include: { items: true, customer: true }
  });

  const pdfBuffer = await generateInvoicePdf(updated, customer, pdfItems);
  const storagePath = await uploadPdfBuffer(userId, updated.invoiceNumber, pdfBuffer);

  return await prisma.invoice.update({
    where: { id: updated.id },
    data: { pdfStoragePath: storagePath },
    include: { items: true, customer: true }
  });
};

export const deleteInvoice = async (userId: string, invoiceId: string): Promise<void> => {
  const existing = await getInvoiceById(userId, invoiceId);
  if (existing == null) {
    const error = new Error('Invoice not found');
    (error as any).status = 404;
    throw error;
  }

  await prisma.invoice.delete({ where: { id: invoiceId } });
};

const calculateTotals = (items: InvoiceItemInput[]): {
  totals: { subtotalCents: number; taxCents: number; totalCents: number; taxRatePercent: number };
  prismaItems: Prisma.InvoiceItemCreateManyInvoiceInput[];
  pdfItems: InvoicePdfItem[];
} => {
  let subtotalCents = 0;
  let taxCents = 0;
  let taxRatePercent = 0;

  const prismaItems: Prisma.InvoiceItemCreateManyInvoiceInput[] = [];
  const pdfItems: InvoicePdfItem[] = [];

  items.forEach((item) => {
    const lineSubtotal = Math.round(item.quantity * item.unitPriceCents);
    const lineTax = Math.round(lineSubtotal * (item.taxRatePercent / 100));
    const lineTotal = lineSubtotal + lineTax;
    subtotalCents += lineSubtotal;
    taxCents += lineTax;
    taxRatePercent = item.taxRatePercent;

    prismaItems.push({
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalCents: lineTotal,
      taxRatePercent: item.taxRatePercent
    });

    pdfItems.push({
      description: item.description,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalCents: lineTotal
    });
  });

  return {
    totals: {
      subtotalCents,
      taxCents,
      totalCents: subtotalCents + taxCents,
      taxRatePercent
    },
    prismaItems,
    pdfItems
  };
};

const upsertCustomer = async (
  userId: string,
  customer: InvoiceInput['customer']
): Promise<Customer | null> => {
  if (customer.id != null) {
    const existing = await prisma.customer.findFirst({ where: { id: customer.id, userId } });
    if (existing == null) {
      const error = new Error('Customer not found');
      (error as any).status = 404;
      throw error;
    }

    return await prisma.customer.update({
      where: { id: customer.id },
      data: {
        name: customer.name,
        email: customer.email,
        company: customer.company,
        street: customer.street,
        postalCode: customer.postalCode,
        city: customer.city,
        country: customer.country
      }
    });
  }

  return await prisma.customer.create({
    data: {
      userId,
      name: customer.name,
      email: customer.email,
      company: customer.company,
      street: customer.street,
      postalCode: customer.postalCode,
      city: customer.city,
      country: customer.country
    }
  });
};
