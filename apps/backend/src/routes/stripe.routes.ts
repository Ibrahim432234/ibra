import { Router } from 'express';
import { authenticated } from '../middleware/authenticated.js';
import { createCheckoutSessionHandler, stripeWebhookHandler } from '../modules/billing/stripe.controller.js';

const router = Router();

router.post('/checkout-session', authenticated, (req, res, next) => {
  createCheckoutSessionHandler(req, res).catch(next);
});

router.post('/webhook', (req, res, next) => {
  stripeWebhookHandler(req, res).catch(next);
});

export const stripeRouter = router;
