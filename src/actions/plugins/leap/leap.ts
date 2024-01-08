import { Mode } from '../../../mode/mode';
import { Match } from './match';
import { Marker, createMarker, generateMarkerNames } from './Marker';
import { VimState } from '../../../state/vimState';
import { LeapAction } from './LeapAction';
import { Position } from 'vscode';
import { configuration } from '../../../configuration/configuration';
import * as vscode from 'vscode';

export enum LeapSearchDirection {
  Forward = -1,
  Backward = 1,
  Bidirectional = 2,
}

export class Leap {
  vimState: VimState;
  previousMode: Mode;
  markers: Marker[] = [];
  searchMode: string = '';
  isRepeatLastSearch: boolean = false;
  direction?: LeapSearchDirection;
  leapAction?: LeapAction;
  firstSearchString?: string;
  dimmingZone = vscode.window.createTextEditorDecorationType({
    // to prevent empty string of dimColor
    color: configuration.leap.dimColor || '#777777',
  });

  constructor(vimState: VimState) {
    this.vimState = vimState;
    this.previousMode = vimState.currentMode;
  }

  public createMarkers(matches: Match[]) {
    this.markers = matches.map((match) => {
      return createMarker(match, this.vimState.editor);
    });

    this.setMarkersName();

    return this.markers;
  }

  public setDimmingZones() {
    if (!configuration.leap.dim) return;
    const dimmingZones: vscode.DecorationOptions[] = [];
    const dimmingRenderOptions: vscode.ThemableDecorationRenderOptions = {
      // we update the color here again in case the configuration has changed
      color: configuration.leap.dimColor || '#777777',
    };
    dimmingZones.push({
      // fill the whole document
      range: new vscode.Range(0, 0, this.vimState.editor.document.lineCount, 0),
      renderOptions: dimmingRenderOptions,
    });
    this.vimState.editor.setDecorations(this.dimmingZone, dimmingZones);
  }

  private setMarkersName() {
    const map: Map<string, Marker[]> = new Map();

    this.markers.forEach((marker) => {
      const key = marker.searchString;
      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key)?.push(marker);
    });

    map.forEach((markers) => {
      if (configuration.leap.bidirectionalSearch) markers = this.reorder(markers);

      const markerNames = generateMarkerNames(markers.length);

      markers.forEach((marker, index) => {
        marker.label = markerNames[index];
      });
    });
  }

  private reorder(group: Marker[]) {
    let result: Marker[] = [];

    const backwardMatches = group.filter((m) => m.direction === LeapSearchDirection.Backward);
    const forwardMatches = group.filter((m) => m.direction === LeapSearchDirection.Forward);

    let i = 0;
    let backwardMatchesLen = backwardMatches.length;
    let forwardMatchesLen = forwardMatches.length;

    while (i < backwardMatchesLen && i < forwardMatchesLen) {
      result.push(backwardMatches[i]);
      result.push(forwardMatches[i]);
      i++;
    }

    if (backwardMatchesLen > forwardMatchesLen) {
      while (i < backwardMatchesLen) {
        result.push(backwardMatches[i]);
        i++;
      }
    } else if (forwardMatchesLen > backwardMatchesLen) {
      while (i < forwardMatchesLen) {
        result.push(forwardMatches[i]);
        i++;
      }
    }

    return result;
  }

  public findMarkerByName(name: string) {
    return this.markers.find((marker: Marker) => {
      return marker.label === name;
    });
  }

  public findMarkersBySearchString(searchString: string) {
    return this.markers.filter((marker) => {
      return marker.searchString === searchString;
    });
  }

  public keepMarkersByPrefix(prefix: string) {
    this.markers = this.markers
      .map((marker) => {
        if (marker.prefix !== prefix) marker.dispose();
        return marker;
      })
      .filter((marker) => {
        return marker.prefix === prefix;
      });
  }

  public keepMarkersBySearchString(searchString: string) {
    this.markers = this.markers
      .map((marker) => {
        if (marker.searchString !== searchString) marker.dispose();
        return marker;
      })
      .filter((marker) => {
        return marker.searchString === searchString;
      });
  }

  public deletePrefixOfMarkers() {
    this.markers.forEach((marker: Marker) => {
      marker.deletePrefix();
      marker.update();
    });
  }

  public isPrefixOfMarker(character: string) {
    return this.markers.some((marker) => {
      return marker.prefix === character;
    });
  }

  public cleanupMarkers() {
    if (this.markers.length === 0) return;
    this.markers.forEach((marker) => {
      marker.dispose();
    });

    this.markers = [];
  }

  public cleanupDimmingZones() {
    if (!configuration.leap.dim) return;
    this.vimState.editor.setDecorations(this.dimmingZone, []);
  }

  public showMarkers() {
    this.markers.forEach((marker) => {
      marker.show();
    });
  }

  public changeCursorStopPosition(position: Position) {
    const leap = getLeapInstance();

    const isVisualModel =
      leap.previousMode === Mode.Visual ||
      leap.previousMode === Mode.VisualLine ||
      leap.previousMode === Mode.VisualBlock;

    if (isVisualModel) {
      if (configuration.leap.bidirectionalSearch) {
        if (this.searchMode === 's') {
          if (isBackward(position, this.vimState.cursorStopPosition)) {
            this.containMarkerBackwardJump(position);
          } else {
            this.containMarkerForwardJump(position);
          }
        } else if (this.searchMode === 'x') {
          if (isBackward(position, this.vimState.cursorStopPosition)) {
            this.excludeMarkerBackwardJump(position);
          } else {
            this.excludeMarkerForwardJump(position);
          }
        }
      } else {
        if (this.searchMode === 'x') {
          this.excludeMarkerBackwardJump(position);
        } else if (this.searchMode === 'X') {
          this.excludeMarkerForwardJump(position);
        } else if (this.searchMode === 's') {
          this.containMarkerBackwardJump(position);
        }
      }
    } else {
      this.vimState.cursorStopPosition = position;
    }
  }
  private containMarkerBackwardJump(position: Position) {
    let maxCharacter = this.vimState.editor.document.lineAt(position.line).range.end.character - 1;

    this.vimState.cursorStopPosition = new Position(
      position.line,
      Math.min(position.character + 1, maxCharacter)
    );
  }
  private containMarkerForwardJump(position: Position) {
    this.vimState.cursorStopPosition = position;
  }

  private excludeMarkerBackwardJump(position: Position) {
    let line;
    let character;
    const isFirstCharacter = position.character === 0;
    if (isFirstCharacter) {
      line = position.line - 1;
      character = this.vimState.editor.document.lineAt(position.line - 1).range.end.character;
    } else {
      line = position.line;
      character = position.character - 1;
    }
    this.vimState.cursorStopPosition = new Position(line, character);
  }
  private excludeMarkerForwardJump(position: Position) {
    this.vimState.cursorStopPosition = new Position(position.line, position.character + 2);
  }
}

export function isBackward(positionA: Position, positionB: Position) {
  if (positionA.line !== positionB.line) {
    return positionA.line > positionB.line;
  } else {
    return positionA.character > positionB.character;
  }
}

let leap: Leap;
export function initLeap(vimState: VimState) {
  leap = new Leap(vimState);
}
export function getLeapInstance(): Leap {
  return leap;
}

export function disposeLeap() {
  leap?.cleanupMarkers();
  leap?.cleanupDimmingZones();
}
