import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Project } from 'ts-morph';
import { describe, expect, it } from 'vitest';
import { loadChangelog } from '../src/changelog/loader.js';
import { scanUsage } from '../src/detector/scanUsage.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('scanUsage', () => {
  it('finds the deprecated stripe.charges.create call site in sample-repo', () => {
    const change = loadChangelog(
      path.resolve(__dirname, '../fixtures/changelogs/stripe-2025-06-30.json'),
    );
    const project = new Project();
    const sourceFile = project.addSourceFileAtPath(
      path.resolve(__dirname, '../sample-repo/src/checkout.ts'),
    );

    const matches = scanUsage(sourceFile, change);

    expect(matches).toHaveLength(1);
    expect(matches[0].text).toContain('stripe.charges.create');
    expect(matches[0].filePath).toContain('checkout.ts');
  });
});
