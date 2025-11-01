import Stripe from 'stripe';
import { prisma } from '../../db/prisma.js';
import { env } from '../../config/env.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20'
});

export const createCheckoutSession = async (userId: string): Promise<Stripe.Checkout.Session> => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user == null) {
    const error = new Error('User not found');
    (error as any).status = 404;
    throw error;
  }

  let subscription = await prisma.subscription.findFirst({ where: { userId } });

  if (subscription == null) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || undefined
    });

    subscription = await prisma.subscription.create({
      data: {
        userId,
        stripeCustomer: customer.id,
        plan: env.STRIPE_PRICE_ID,
        status: 'incomplete'
      }
    });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer: subscription.stripeCustomer,
    line_items: [
      {
        price: env.STRIPE_PRICE_ID,
        quantity: 1
      }
    ],
    success_url: `${env.APP_BASE_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_BASE_URL}/billing/cancel`
  });

  return session;
};

export const verifyStripeSignature = (signature: string | string[] | undefined, rawBody: Buffer): Stripe.Event => {
  if (typeof signature !== 'string') {
    const error = new Error('Missing Stripe signature header');
    (error as any).status = 400;
    throw error;
  }

  return stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
};

export const handleStripeEvent = async (event: Stripe.Event): Promise<void> => {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.customer == null || session.subscription == null) {
        return;
      }

      await prisma.subscription.update({
        where: { stripeCustomer: session.customer as string },
        data: {
          stripeSubId: session.subscription as string,
          status: session.status ?? 'active'
        }
      });
      break;
    }
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.customer == null) {
        return;
      }

      await prisma.subscription.update({
        where: { stripeCustomer: invoice.customer as string },
        data: {
          status: invoice.status ?? 'active',
          currentPeriodEnd: invoice.lines.data[0]?.period?.end != null
            ? new Date(invoice.lines.data[0].period.end * 1000)
            : undefined
        }
      });
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      await prisma.subscription.update({
        where: { stripeSubId: subscription.id },
        data: {
          status: subscription.status
        }
      });
      break;
    }
    default:
      break;
  }
};
