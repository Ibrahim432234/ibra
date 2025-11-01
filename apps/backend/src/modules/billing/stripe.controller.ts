import type { Request, Response } from 'express';
import type { AuthenticatedRequest } from '../../middleware/authenticated.js';
import { createCheckoutSession, handleStripeEvent, verifyStripeSignature } from './stripe.service.js';

export const createCheckoutSessionHandler = async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
  if (req.user == null) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const session = await createCheckoutSession(req.user.id);
  return res.status(200).json({ success: true, data: session });
};

export const stripeWebhookHandler = async (req: Request, res: Response): Promise<Response> => {
  const signature = req.headers['stripe-signature'];

  const rawBody = ((req as any).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}))) as Buffer;
  const event = verifyStripeSignature(signature, rawBody);
  await handleStripeEvent(event);

  return res.status(200).json({ received: true });
};
