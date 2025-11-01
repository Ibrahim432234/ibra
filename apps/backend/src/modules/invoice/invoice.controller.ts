import type { Response } from 'express';
import { createReadStream, existsSync } from 'fs';
import { invoiceSchema } from './invoice.schema.js';
import { createInvoice, deleteInvoice, getInvoiceById, listInvoices, updateInvoice } from './invoice.service.js';
import type { AuthenticatedRequest } from '../../middleware/authenticated.js';

export const listInvoicesHandler = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const userId = req.user?.id;
  if (userId == null) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const invoices = await listInvoices(userId);
  return res.status(200).json({ success: true, data: invoices });
};

export const getInvoiceHandler = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const userId = req.user?.id;
  if (userId == null) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const invoice = await getInvoiceById(userId, req.params.id);
  if (invoice == null) {
    return res.status(404).json({ success: false, message: 'Invoice not found' });
  }

  return res.status(200).json({ success: true, data: invoice });
};

export const createInvoiceHandler = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const userId = req.user?.id;
  if (userId == null) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: parsed.error.issues });
  }

  const invoice = await createInvoice(userId, parsed.data);
  return res.status(201).json({ success: true, data: invoice });
};

export const updateInvoiceHandler = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const userId = req.user?.id;
  if (userId == null) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const parsed = invoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors: parsed.error.issues });
  }

  const invoice = await updateInvoice(userId, req.params.id, parsed.data);
  return res.status(200).json({ success: true, data: invoice });
};

export const deleteInvoiceHandler = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  const userId = req.user?.id;
  if (userId == null) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  await deleteInvoice(userId, req.params.id);
  return res.status(204).send();
};

export const downloadInvoicePdfHandler = async (req: AuthenticatedRequest, res: Response): Promise<Response | void> => {
  const userId = req.user?.id;
  if (userId == null) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const invoice = await getInvoiceById(userId, req.params.id);
  if (invoice == null || invoice.pdfStoragePath == null) {
    return res.status(404).json({ success: false, message: 'PDF nicht gefunden' });
  }

  if (!existsSync(invoice.pdfStoragePath)) {
    return res.status(404).json({ success: false, message: 'PDF-Datei nicht vorhanden' });
  }

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.pdf"`);
  const stream = createReadStream(invoice.pdfStoragePath);
  stream.on('error', () => {
    res.status(500).end();
  });
  stream.pipe(res);
};
