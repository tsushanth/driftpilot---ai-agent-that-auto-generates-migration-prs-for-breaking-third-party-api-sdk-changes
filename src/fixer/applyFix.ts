import path from 'node:path';
import { Project } from 'ts-morph';
import type { BreakingChange } from '../changelog/types.js';
import { scanUsage, type UsageMatch } from '../detector/scanUsage.js';
import { applyStripeChargesToPaymentIntentsCodemod } from './codemods/stripe-charges-to-payment-intents.js';

export interface ApplyFixResult {
  matches: UsageMatch[];
  changedFiles: string[];
}

type Codemod = (match: UsageMatch, change: BreakingChange) => void;

const CODEMODS: Record<string, Codemod> = {
  'stripe-charges-create-deprecation-2025-06-30': (match, change) =>
    applyStripeChargesToPaymentIntentsCodemod(match.node, change),
};

/**
 * Scans every .ts file under `repoDir` for usage matching `change`, applies the
 * registered codemod to each match, and writes the rewritten files back to disk.
 */
export function applyFix(repoDir: string, change: BreakingChange): ApplyFixResult {
  const codemod = CODEMODS[change.id];
  if (!codemod) {
    throw new Error(`No codemod registered for changelog entry "${change.id}"`);
  }

  const project = new Project();
  project.addSourceFilesAtPaths(path.join(repoDir, '**/*.ts'));

  const allMatches: UsageMatch[] = [];
  const changedFiles = new Set<string>();

  for (const sourceFile of project.getSourceFiles()) {
    const matches = scanUsage(sourceFile, change);
    if (matches.length === 0) continue;

    for (const match of matches) {
      codemod(match, change);
    }
    sourceFile.formatText({ indentSize: 2 });

    allMatches.push(...matches);
    changedFiles.add(sourceFile.getFilePath());
  }

  project.saveSync();

  return { matches: allMatches, changedFiles: [...changedFiles] };
}
