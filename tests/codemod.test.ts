import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import { loadChangelog } from '../src/changelog/loader.js';
import { scanUsage } from '../src/detector/scanUsage.js';
import { applyStripeChargesToPaymentIntentsCodemod } from '../src/fixer/codemods/stripe-charges-to-payment-intents.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('stripe-charges-to-payment-intents codemod', () => {
  it('rewrites stripe.charges.create to stripe.paymentIntents.create with remapped/added fields', () => {
    const change = loadChangelog(
      path.resolve(__dirname, '../fixtures/changelogs/stripe-2025-06-30.json'),
    );
    const project = new Project();
    const sourceFile = project.createSourceFile(
      'input.ts',
      `
      const charge = await stripe.charges.create({
        amount: 1000,
        currency: 'usd',
        customer: customerId,
        source: paymentSource,
      });
      `,
    );

    const [match] = scanUsage(sourceFile, change);
    applyStripeChargesToPaymentIntentsCodemod(match.node, change);

    const output = sourceFile.getFullText();
    expect(output).toContain('stripe.paymentIntents.create');
    expect(output).not.toContain('stripe.charges.create');
    expect(output).toContain('payment_method: paymentSource');
    expect(output).toContain('confirm: true');
  });
});
