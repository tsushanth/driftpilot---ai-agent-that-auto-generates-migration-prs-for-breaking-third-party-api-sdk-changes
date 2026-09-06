#!/usr/bin/env node
import path from 'node:path';
import { Command } from 'commander';
import { Project } from 'ts-morph';
import { loadChangelog } from './changelog/loader.js';
import { scanUsage } from './detector/scanUsage.js';
import { createLocalPr } from './git/localPr.js';

const program = new Command();

program
  .name('driftpilot')
  .description('Detect and auto-fix breaking third-party API/SDK changes')
  .version('0.1.0');

program
  .command('scan')
  .description('Scan a repo for usage matching a changelog breaking-change entry')
  .requiredOption('--repo <path>', 'path to the repo to scan')
  .requiredOption('--changelog <path>', 'path to a changelog fixture JSON')
  .action((opts: { repo: string; changelog: string }) => {
    const change = loadChangelog(path.resolve(opts.changelog));
    const project = new Project();
    project.addSourceFilesAtPaths(path.join(path.resolve(opts.repo), '**/*.ts'));

    let total = 0;
    for (const sourceFile of project.getSourceFiles()) {
      for (const match of scanUsage(sourceFile, change)) {
        total += 1;
        console.log(`${path.relative(process.cwd(), match.filePath)}:${match.line}:${match.column}`);
        console.log(`  ${match.text.split('\n')[0]}`);
        console.log(
          `  deprecated: ${change.detect.objectPath}.${change.detect.method} -> ` +
            `${change.replacement.objectPath}.${change.replacement.method} (sunset ${change.sunsetDate})`,
        );
      }
    }

    if (total === 0) {
      console.log('No deprecated usage found.');
    } else {
      console.log(`\nFound ${total} usage(s) of a deprecated API scheduled for removal on ${change.sunsetDate}.`);
    }
  });

program
  .command('fix')
  .description('Generate a local migration branch/commit/PR description for a breaking change')
  .requiredOption('--repo <path>', 'path to the repo to fix')
  .requiredOption('--changelog <path>', 'path to a changelog fixture JSON')
  .action(async (opts: { repo: string; changelog: string }) => {
    const change = loadChangelog(path.resolve(opts.changelog));
    const result = await createLocalPr(path.resolve(opts.repo), change);

    console.log(`Scratch repo: ${result.scratchDir}`);
    console.log(`Branch: ${result.branchName}`);
    console.log(`Base commit: ${result.baseCommitHash}`);
    console.log(`Fix commit: ${result.fixCommitHash}`);
    console.log('\nDiff:\n');
    console.log(result.diff);
    console.log(`Title: ${result.prTitle}`);
    console.log(`PR description written to: ${result.prDescriptionPath}`);
  });

program.parseAsync(process.argv);
