import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { invoiceRouter } from './invoice.routes.js';
import { stripeRouter } from './stripe.routes.js';

export const routes = Router();

routes.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

routes.use('/auth', authRouter);
routes.use('/invoices', invoiceRouter);
routes.use('/stripe', stripeRouter);
