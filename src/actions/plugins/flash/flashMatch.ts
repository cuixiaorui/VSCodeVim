import * as vscode from 'vscode';
import { configuration } from './../../../configuration/configuration';
import { Flash } from './flash';

export interface Match {
  range: vscode.Range;
  text: string;
}

export function createSearchMatches(flash: Flash,document: vscode.TextDocument): Match[] {
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

  return matches;
}
