import * as vscode from 'vscode';
import { VimState } from '../../../state/vimState';
import { SearchDecorations } from 'src/util/decorationUtils';
import { Mode } from '../../../mode/mode';

interface Match {
  range: vscode.Range;
  text: string;
}

interface Flash {
  searchString: string;
  markerDecorations: MarkerDecoration[];
  previousMode: Mode | undefined;
}

export const flash: Flash = {
  searchString: '',
  markerDecorations: [],
  previousMode: undefined,
};

export function appendSearchString(str: string) {
  flash.searchString += str;
}

export function deleteSearchString() {
  flash.searchString = flash.searchString.slice(0, -1);
}

export function getSearchMatches(vimState: VimState): Match[] {
  let matches: Match[] = [];
  const text = vimState.document.getText();

  if (!flash.searchString.length) return matches;

  const regex = new RegExp(flash.searchString, 'g');

  // 在文本中搜索匹配的字符串，并记录位置信息
  let match;
  while ((match = regex.exec(text))) {
    const startPosition = vimState.document.positionAt(match.index);
    const endPosition = vimState.document.positionAt(match.index + match[0].length);
    const range = new vscode.Range(startPosition, endPosition);
    const text = vimState.document.getText(range);
    matches.push({
      range,
      text,
    });
  }

  console.log('-------------------');
  console.log(matches);
  return matches;
}

export function generateFlashDecorations(vimState: VimState): SearchDecorations | undefined {
  const matches = getSearchMatches(vimState);
  const searchMatch: vscode.Range[] = matches.map(({ range }) => {
    return range;
  });

  return {
    searchMatch,
  };
}

export function resetFlash() {
  flash.searchString = '';
  flash.previousMode = undefined;
  flash.searchString = '';
  flash.markerDecorations.forEach((marker) => {
    marker.dispose();
  });
  flash.markerDecorations = [];
}

export class MarkerDecoration {
  private textEditorDecorationType: vscode.TextEditorDecorationType;
  private range: vscode.Range;
  private vimState: VimState;
  public label: string;
  constructor(range: vscode.Range, vimState: VimState, label: string) {
    this.textEditorDecorationType = vscode.window.createTextEditorDecorationType({});
    this.range = range;
    this.vimState = vimState;
    this.label = label;
  }

  show() {
    this.vimState.editor.setDecorations(this.textEditorDecorationType, this.getRangesOrOptions());
  }

  dispose() {
    this.vimState.editor.setDecorations(this.textEditorDecorationType, []);
    this.textEditorDecorationType.dispose();
  }

  getJumpPosition() {
    return this.range.start;
  }

  private getRangesOrOptions() {
    const secondCharRenderOptions: vscode.ThemableDecorationInstanceRenderOptions = {
      before: {
        contentText: this.label,
        backgroundColor: '#ccff88',
        color: '#000000',
        margin: `0 -1ch 0 0;
            position: absolute;
            font-weight: normal;`,
        height: '100%',
      },
    };

    return [
      {
        range: this.range!,
        renderOptions: {
          dark: secondCharRenderOptions,
          light: secondCharRenderOptions,
        },
      },
    ];
  }
}

export function findMarkerDecorationByLabel(label: string) {
  return flash.markerDecorations.find((m) => m.label === label);
}

let markerChatIndex = 0;
// TODO 基于 config 来获取到 labels
const markerLabels = 'sklyuiopnm,qwertzxcvbahdgjf;'.split('');
// range position Xchat
export function takeMarkerLabel(range: vscode.Range, vimState: VimState) {
  let char = markerLabels[markerChatIndex];

  const nextChat = getNextChat(range, vimState);
  const isClash = nextChat === char;

  if (isClash) {
    markerChatIndex++;
    char = markerLabels[markerChatIndex];
    markerChatIndex = 0;
  }

  markerLabels.splice(markerChatIndex, 1);

  return char;
}

export function getNextChat(range: vscode.Range, vimState: VimState) {
  const nextRange = new vscode.Range(
    range.end,
    new vscode.Position(range.end.line, range.end.character + 1)
  );
  return vimState.document.getText(nextRange);
}

export function generateMarkerLabels(matches: Match[], vimState: VimState) {
  // 1. 获取到所有的字符 x 列表
  const nextChatList = Array.from(
    new Set(
      matches.map(({ range }) => {
        return getNextChat(range, vimState);
      })
    )
  );

  return 'sklyuiopnm,qwertzxcvbahdgjf;'.split('').filter((s) => {
    return !nextChatList.includes(s);
  });
}
