import { VimState } from '../../../state/vimState';
import { SearchDecorations } from 'src/util/decorationUtils';
import { createSearchMatches } from './flashMatch';
import * as vscode from 'vscode';

export function createFlashDecorations(vimState: VimState): SearchDecorations | undefined {
  const matches = createSearchMatches(vimState.document);
  const searchMatch: vscode.Range[] = matches.map(({ range }) => {
    return range;
  });

  return {
    searchMatch,
  };
}