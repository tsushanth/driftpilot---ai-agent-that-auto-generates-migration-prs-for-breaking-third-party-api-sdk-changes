import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2024-04-10',
});

export interface ChargeCustomerInput {
  amount: number;
  currency: string;
  customerId: string;
  paymentSource: string;
}

export async function chargeCustomer(input: ChargeCustomerInput) {
  const { amount, currency, customerId, paymentSource } = input;

  const charge = await stripe.charges.create({
    amount,
    currency,
    customer: customerId,
    source: paymentSource,
    description: 'DriftPilot demo checkout',
  });

  return charge;
}
