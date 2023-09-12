import * as vscode from 'vscode';
import { VimState } from '../../../state/vimState';
import { configuration } from './../../../configuration/configuration';
import { Flash } from './flash';

export interface Match {
  range: vscode.Range;
  text: string;
}

export function createSearchMatches(
  flash: Flash,
  document: vscode.TextDocument,
  vimState: VimState
): Match[] {
  let matches: Match[] = [];
  if (!flash.searchString.length) return matches;
  const documentText = document.getText();
  const flags = configuration.flash.ignorecase ? 'gi' : 'g';
  const regex = new RegExp(flash.searchString, flags);

  let match;
  while ((match = regex.exec(documentText))) {
    const startPosition = document.positionAt(match.index);
    const endPosition = document.positionAt(match.index + match[0].length);
    const range = new vscode.Range(startPosition, endPosition);
    const text = document.getText(range);
    matches.push({
      range,
      text,
    });
  }

  // TODO 如果我们是多个 ranges 的话 应该如何处理呢？
  // 暂时不知道多个 ranges 的时候是什么场景
  const visibleRange = vimState.editor.visibleRanges[0];
  return matches.filter((m) => {
    return m.range.start.line >= visibleRange.start.line;
  });
}
