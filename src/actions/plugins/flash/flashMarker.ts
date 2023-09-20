import { VimState } from '../../../state/vimState';
import { configuration } from './../../../configuration/configuration';
import { Flash } from './flash';
import { Match } from './flashMatch';
import * as vscode from 'vscode';
import { type DecorationOptions } from 'vscode';

let nextMatchMarker: Marker;

export class Marker {
  public range: vscode.Range;
  public label: string;
  private labelShowRange: vscode.Range;
  private textEditorDecorationType: vscode.TextEditorDecorationType;
  private editor: vscode.TextEditor;
  private markerLabelBackgroundColor: string;
  public id: number;
  public isShow: boolean;
  public isNextMatch: boolean;
  constructor(range: vscode.Range, label: string, editor: vscode.TextEditor, id: number) {
    this.id = id;
    this.range = range;
    this.labelShowRange = range;
    this.isShow = false;
    this.editor = editor;
    this.label = label;
    this.isNextMatch = false;
    this.markerLabelBackgroundColor = configuration.flash.marker.backgroundColor;
    this.textEditorDecorationType = vscode.window.createTextEditorDecorationType({});
  }
  show() {
    if (this.isShow) return;

    this.isShow = true;
    this.updateView();
  }

  updateView() {
    this.editor.setDecorations(this.textEditorDecorationType, this.getRangesOrOptions());
  }

  hide() {
    if (!this.isShow) return;

    this.isShow = false;
    this.editor.setDecorations(this.textEditorDecorationType, []);
  }

  dispose() {
    this.editor.setDecorations(this.textEditorDecorationType, []);
    this.textEditorDecorationType.dispose();
  }

  getJumpPosition() {
    return this.labelShowRange.start;
  }

  setMarkerLabelBackgroundColor(backgroundColor: string) {
    this.markerLabelBackgroundColor = backgroundColor;
  }

  setLabel(label: string) {
    this.label = label;
  }

  updateRangeToForward() {
    const forwardRange = new vscode.Range(
      this.range.start,
      new vscode.Position(this.range.end.line, this.range.end.character - 1)
    );
    this.range = forwardRange;
  }

  updateRangeToBackward() {
    const backwardRange = new vscode.Range(
      this.range.start,
      new vscode.Position(this.range.end.line, this.range.end.character + 1)
    );
    this.range = backwardRange;
  }

  markAsNextMatch() {
    this.isNextMatch = true;
    this.setMarkerLabelBackgroundColor(configuration.flash.marker.nextMarkerBackgroundColor);
  }

  recoverNormalMatch() {
    this.isNextMatch = false;
    this.setMarkerLabelBackgroundColor(configuration.flash.marker.backgroundColor);
  }

  private getRangesOrOptions(): DecorationOptions[] {
    const secondCharRenderOptions: vscode.ThemableDecorationInstanceRenderOptions = {
      before: {
        contentText: this.label,
        backgroundColor: this.markerLabelBackgroundColor,
        color: '#000000',
        margin: `0 -1ch 0 0; position: absolute;
            font-weight: normal;`,
        height: '100%',
      },
    };
    return [
      {
        range: this.labelShowRange,
        renderOptions: { dark: secondCharRenderOptions, light: secondCharRenderOptions },
      },
    ];
  }
}

export function cleanFlashMarkers(flash: Flash) {
  const allMarkers = getCacheMarker(flash.firstSearchChat);
  if (!allMarkers) return;

  allMarkers.forEach((marker) => {
    marker.dispose();
  });

  Object.keys(markersMap).forEach((key) => {
    delete markersMap[key];
  });
}

export function findMarkerByLabel(markers: Marker[], label: string) {
  if (!markers) return;
  return markers.find((m) => m.label === label);
}

export function updateNextMatchMarker(markers: Marker[], position: vscode.Position) {
  if (nextMatchMarker) {
    if (nextMatchMarker.isShow) {
      nextMatchMarker.recoverNormalMatch();
      nextMatchMarker.updateView();
    }
  }

  let newNextMatchMarker;
  const len = markers.length;
  for (let i = 0; i < len; i++) {
    const marker = markers[i];
    if (
      (marker.range.start.line === position.line &&
        marker.range.start.character > position.character) ||
      marker.range.start.line > position.line
    ) {
      newNextMatchMarker = marker;
      break;
    }
  }

  if (!newNextMatchMarker) {
    newNextMatchMarker = markers[0];
  }

  nextMatchMarker = newNextMatchMarker;
  nextMatchMarker.markAsNextMatch();
}

export function getNextMatchMarker(searchString: string, position: vscode.Position) {
  const markers = getCacheMarker(searchString);
  const len = markers.length;
  for (let i = 0; i < len; i++) {
    const marker = markers[i];
    if (
      (marker.range.start.line === position.line &&
        marker.range.start.character > position.character) ||
      marker.range.start.line > position.line
    ) {
      return marker;
    }
  }
  return markers[0];
}

let id = 0;
export function createMarkers(matches: Match[], labels: string[], editor: vscode.TextEditor) {
  return matches.map(({ range }, index) => {
    const label = labels[index] || '';
    return new Marker(range, label, editor, id++);
  });
}

export function createMarkerLabels(matchRanges: { range: vscode.Range }[], vimState: VimState) {
  const nextSearchChatList = Array.from(
    new Set(
      matchRanges.map(({ range }) => {
        return getNextSearchChat(range, vimState);
      })
    )
  );

  return configuration.flash.labels.split('').filter((s) => {
    return !nextSearchChatList.includes(s);
  });
}

export function getNextSearchChat(range: vscode.Range, vimState: VimState) {
  const nextRange = new vscode.Range(
    range.end,
    new vscode.Position(range.end.line, range.end.character + 1)
  );
  return vimState.document.getText(nextRange).toLocaleLowerCase();
}

const markersMap: Record<string, Marker[]> = {};

export function cacheMarker(key: string, markers: Marker[]) {
  markersMap[key] = markers;
}

export function getCacheMarker(key: string) {
  return markersMap[key];
}

export function updateMarkersRangeToForward(markers: Marker[]) {
  markers.forEach((marker) => marker.updateRangeToForward());
}
export function updateMarkersRangeToBackward(markers: Marker[]) {
  markers.forEach((marker) => marker.updateRangeToBackward());
}

export function showMarkers(markers: Marker[]) {
  markers.forEach((marker) => marker.show());
}

export function updateMarkerLabel(markers: Marker[], vimState: VimState) {
  // 处理 label
  // 1. 先生成 labels
  const labels = createMarkerLabels(markers, vimState);

  // 2. 重新分配 labels
  // 先检测当前的 label 是否合格
  const checkLegalLabel = (label: string) => labels.includes(label);

  // 有可能它有 label ，但是新赋值 label 的时候 ， labels 不够用了
  markers.forEach((marker) => {
    if (labels.length > 0) {
      if (checkLegalLabel(marker.label)) {
        //合法的话 不处理了 但是需要把当前的 label 从 labels 里面去除掉
        const index = labels.indexOf(marker.label);
        labels.splice(index, 1);
      } else {
        const label = labels.pop();
        marker.setLabel(label!);
      }
    } else {
      marker.hide();
    }
  });
}

export function getMatchedMarkers(markers: Marker[], chat: string, vimState: VimState) {
  return markers.filter((marker) => {
    return getNextSearchChat(marker.range, vimState) === chat;
  });
}
export function hideNoMatchedMarkers(preMarkers: Marker[], matchedMarkers: Marker[]) {
  preMarkers
    .filter((oldMarker) => {
      const isHave = matchedMarkers.some((newMarker) => newMarker.id === oldMarker.id);
      return !isHave;
    })
    .map((marker) => {
      marker.hide();
    });
}

export function getPreMarkers(searchString: string) {
  const preSearchString = searchString.slice(0, searchString.length - 1);
  return getCacheMarker(preSearchString);
}

export function updateViewMarkers(markers: Marker[]) {
  markers.forEach((marker) => {
    marker.updateView();
  });
}
