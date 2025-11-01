import { Router } from 'express';
import { authenticated } from '../middleware/authenticated.js';
import {
  createInvoiceHandler,
  deleteInvoiceHandler,
  downloadInvoicePdfHandler,
  getInvoiceHandler,
  listInvoicesHandler,
  updateInvoiceHandler
} from '../modules/invoice/invoice.controller.js';

const router = Router();

router.use(authenticated);

router.get('/', (req, res, next) => {
  listInvoicesHandler(req, res).catch(next);
});

router.post('/', (req, res, next) => {
  createInvoiceHandler(req, res).catch(next);
});

router.get('/:id/pdf', (req, res, next) => {
  downloadInvoicePdfHandler(req, res).catch(next);
});

router.get('/:id', (req, res, next) => {
  getInvoiceHandler(req, res).catch(next);
});

router.put('/:id', (req, res, next) => {
  updateInvoiceHandler(req, res).catch(next);
});

router.delete('/:id', (req, res, next) => {
  deleteInvoiceHandler(req, res).catch(next);
});

export const invoiceRouter = router;
