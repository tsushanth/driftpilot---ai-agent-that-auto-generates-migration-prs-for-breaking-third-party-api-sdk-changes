import { type CallExpression, Node, type SourceFile } from 'ts-morph';
import type { BreakingChange } from '../changelog/types.js';

export interface UsageMatch {
  filePath: string;
  line: number;
  column: number;
  text: string;
  node: CallExpression;
}

/**
 * Finds call sites in `sourceFile` matching `<expr>.<objectPath>.<method>(...)`,
 * where `objectPath`/`method` come from a BreakingChange's `detect` field.
 */
export function scanUsage(sourceFile: SourceFile, change: BreakingChange): UsageMatch[] {
  const matches: UsageMatch[] = [];
  const { objectPath, method } = change.detect;

  sourceFile.forEachDescendant((node) => {
    if (!Node.isCallExpression(node)) return;

    const methodAccess = node.getExpression();
    if (!Node.isPropertyAccessExpression(methodAccess)) return;
    if (methodAccess.getName() !== method) return;

    const objectAccess = methodAccess.getExpression();
    if (!Node.isPropertyAccessExpression(objectAccess)) return;
    if (objectAccess.getName() !== objectPath) return;

    const { line, column } = sourceFile.getLineAndColumnAtPos(node.getStart());
    matches.push({
      filePath: sourceFile.getFilePath(),
      line,
      column,
      text: node.getText(),
      node,
    });
  });

  return matches;
}
