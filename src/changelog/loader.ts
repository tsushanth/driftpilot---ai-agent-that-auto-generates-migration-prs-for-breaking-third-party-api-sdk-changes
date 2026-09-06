import { readFileSync } from 'node:fs';
import type { BreakingChange } from './types.js';

export function loadChangelog(filePath: string): BreakingChange {
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as BreakingChange;
}
