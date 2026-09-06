import { cpSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import simpleGit from 'simple-git';
import type { BreakingChange } from '../changelog/types.js';
import { applyFix } from '../fixer/applyFix.js';
import { generatePrDescription } from '../agent/generatePrDescription.js';

export interface LocalPrResult {
  scratchDir: string;
  branchName: string;
  baseCommitHash: string;
  fixCommitHash: string;
  diff: string;
  prDescriptionPath: string;
  prTitle: string;
}

function toKebabCase(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

function branchNameFor(change: BreakingChange): string {
  const from = toKebabCase(change.detect.objectPath);
  const to = toKebabCase(change.replacement.objectPath);
  return `driftpilot/migrate-${change.sdk}-${from}-to-${to}`;
}

/**
 * Copies `repoDir` into a scratch temp directory, applies the fix on a new
 * branch, and writes a PR_DESCRIPTION.md — a local stand-in for "opened a PR".
 * The checked-in repoDir is never mutated.
 */
export async function createLocalPr(repoDir: string, change: BreakingChange): Promise<LocalPrResult> {
  const scratchDir = mkdtempSync(path.join(tmpdir(), 'driftpilot-'));
  cpSync(repoDir, scratchDir, { recursive: true });

  const git = simpleGit(scratchDir);
  await git.init();
  await git.addConfig('user.email', 'driftpilot@example.com');
  await git.addConfig('user.name', 'DriftPilot');
  await git.add('.');
  await git.commit('chore: snapshot of sample-repo (pre-migration)');
  const baseCommitHash = (await git.revparse(['HEAD'])).trim();

  const branchName = branchNameFor(change);
  await git.checkoutLocalBranch(branchName);

  const { matches } = applyFix(scratchDir, change);
  if (matches.length === 0) {
    throw new Error('No deprecated usage found to fix.');
  }

  await git.add('.');
  const diff = await git.diff(['HEAD']);

  const relativeMatches = matches.map((m) => ({ ...m, filePath: path.relative(scratchDir, m.filePath) }));
  const description = await generatePrDescription({ change, matches: relativeMatches, branchName, diff });
  await git.commit(description.title);
  const fixCommitHash = (await git.revparse(['HEAD'])).trim();

  const prDescriptionPath = path.join(scratchDir, 'PR_DESCRIPTION.md');
  writeFileSync(prDescriptionPath, `# ${description.title}\n\n${description.body}\n`);

  return {
    scratchDir,
    branchName,
    baseCommitHash,
    fixCommitHash,
    diff,
    prDescriptionPath,
    prTitle: description.title,
  };
}
