import { type CallExpression, Node, type ObjectLiteralExpression } from 'ts-morph';
import type { BreakingChange } from '../../changelog/types.js';

/**
 * Rewrites a matched `stripe.charges.create({...})` call in place to
 * `stripe.paymentIntents.create({...})`, remapping/adding fields per the
 * BreakingChange definition (e.g. `source` -> `payment_method`, `confirm: true`).
 */
export function applyStripeChargesToPaymentIntentsCodemod(
  callExpr: CallExpression,
  change: BreakingChange,
): void {
  const methodAccess = callExpr.getExpression();
  if (!Node.isPropertyAccessExpression(methodAccess)) return;

  const objectAccess = methodAccess.getExpression();
  if (!Node.isPropertyAccessExpression(objectAccess)) return;

  objectAccess.getNameNode().replaceWithText(change.replacement.objectPath);

  const [arg] = callExpr.getArguments();
  if (arg && Node.isObjectLiteralExpression(arg)) {
    remapFields(arg, change);
  }
}

function remapFields(obj: ObjectLiteralExpression, change: BreakingChange): void {
  for (const mapping of change.fieldMapping) {
    if (mapping.from === mapping.to) continue;
    const prop = obj.getProperty(mapping.from);
    if (prop && Node.isPropertyAssignment(prop)) {
      prop.getNameNode().replaceWithText(mapping.to);
    }
  }

  for (const [key, value] of Object.entries(change.addFields ?? {})) {
    if (!obj.getProperty(key)) {
      obj.addPropertyAssignment({ name: key, initializer: JSON.stringify(value) });
    }
  }
}
