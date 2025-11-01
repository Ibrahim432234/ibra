import PDFDocument from 'pdfkit';
import type { PDFDocument as PDFDocumentType } from 'pdfkit';
import type { Customer, Invoice } from '@prisma/client';
import { format } from 'date-fns';

export interface InvoicePdfItem {
  description: string;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
}

export const generateInvoicePdf = async (
  invoice: Invoice,
  customer: Customer | null,
  items: InvoicePdfItem[]
): Promise<Buffer> => {
  const doc: PDFDocumentType = new PDFDocument({ size: 'A4', margin: 50 });

  doc.fontSize(20).text('Rechnung', { align: 'right' });
  doc.moveDown();

  doc.fontSize(10).text(`Rechnungsnummer: ${invoice.invoiceNumber}`);
  doc.text(`Datum: ${format(invoice.issueDate, 'dd.MM.yyyy')}`);
  if (invoice.dueDate != null) {
    doc.text(`F?llig am: ${format(invoice.dueDate, 'dd.MM.yyyy')}`);
  }

  doc.moveDown();

  doc.fontSize(12).text('Rechnungsempf?nger');
  if (customer != null) {
    const addressLines = [
      customer.name,
      customer.company,
      customer.street,
      `${customer.postalCode ?? ''} ${customer.city ?? ''}`.trim(),
      customer.country
    ].filter(Boolean) as string[];
    addressLines.forEach((line) => doc.text(line));
  } else {
    doc.text('Nicht angegeben');
  }

  doc.moveDown();

  drawTable(doc, items, invoice.currency);

  doc.moveDown(2);

  const totalsX = 350;
  doc.fontSize(10);
  doc.text('Zwischensumme:', totalsX, doc.y, { continued: true });
  doc.text(formatCurrency(invoice.subtotalCents, invoice.currency), totalsX + 120, doc.y, { align: 'right' });
  doc.moveDown();
  doc.text('MwSt.:', totalsX, doc.y, { continued: true });
  doc.text(formatCurrency(invoice.taxCents, invoice.currency), totalsX + 120, doc.y, { align: 'right' });
  doc.moveDown();
  doc.fontSize(12).text('Gesamt:', totalsX, doc.y, { continued: true });
  doc.text(formatCurrency(invoice.totalCents, invoice.currency), totalsX + 120, doc.y, { align: 'right' });

  doc.moveDown();
  if (invoice.isSmallBusiness) {
    doc.fontSize(9).text('Hinweis: Gem?? ? 19 UStG wird keine Umsatzsteuer berechnet.');
  }

  doc.end();

  return await collectBuffer(doc);
};

const drawTable = (
  doc: PDFDocumentType,
  items: InvoicePdfItem[],
  currency: string
): void => {
  const tableTop = doc.y;
  const itemX = 50;
  const quantityX = 280;
  const unitPriceX = 350;
  const totalX = 450;

  doc.fontSize(10).text('Beschreibung', itemX, tableTop);
  doc.text('Menge', quantityX, tableTop);
  doc.text('Einzelpreis', unitPriceX, tableTop);
  doc.text('Summe', totalX, tableTop);

  let position = tableTop + 20;

  items.forEach((item) => {
    doc.text(item.description, itemX, position, { width: 200 });
    doc.text(item.quantity.toString(), quantityX, position);
    doc.text(formatCurrency(item.unitPriceCents, currency), unitPriceX, position);
    doc.text(formatCurrency(item.totalCents, currency), totalX, position);
    position += 20;
  });
};

const formatCurrency = (value: number, currency: string): string => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency
  }).format(value / 100);
};

const collectBuffer = async (doc: PDFDocumentType): Promise<Buffer> => {
  return await new Promise<Buffer>((resolve) => {
    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
  });
};
