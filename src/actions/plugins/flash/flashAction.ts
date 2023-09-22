import { BaseCommand } from '../../base';
import { Mode } from '../../../mode/mode';
import { Position } from 'vscode';
import { VimState } from '../../../state/vimState';
import { VimError, ErrorCode } from '../../../error';
import { RegisterAction } from '../../base';
import { StatusBar } from '../../../statusBar';
import { configuration } from '../../../configuration/configuration';
import { createSearchMatches } from './flashMatch';
import {
  findMarkerByLabel,
  createMarkerLabels,
  createMarkers,
  getNextMatchMarker,
  Marker,
  cacheMarker,
  getCacheMarker,
  updateMarkersRangeToForward,
  showMarkers,
  updateMarkerLabel,
  getMatchedMarkers,
  updateMarkersRangeToBackward,
  hideNoMatchedMarkers,
  getPreMarkers,
  updateNextMatchMarker,
  updateViewMarkers,
} from './flashMarker';
import { createFlash } from './flash';
@RegisterAction
class FlashCommand extends BaseCommand {
  modes = [Mode.Normal, Mode.Visual, Mode.VisualLine, Mode.VisualBlock];
  keys = ['f'];
  override actionType = 'motion' as const;

  public override doesActionApply(vimState: VimState, keysPressed: string[]) {
    return (
      super.doesActionApply(vimState, keysPressed) &&
      configuration.flash.enable &&
      !vimState.isMultiCursor
    );
  }

  public override async exec(position: Position, vimState: VimState): Promise<void> {
    if (!configuration.flash.enable) return;

    vimState.flash = createFlash(vimState);
    await vimState.setCurrentMode(Mode.FlashSearchInProgressMode);
  }
}

@RegisterAction
class FlashSearchInProgressCommand extends BaseCommand {
  modes = [Mode.FlashSearchInProgressMode];
  keys = ['<character>'];
  override isJump = true;

  public override async exec(position: Position, vimState: VimState): Promise<void> {
    const chat = this.keysPressed[0];

    if (this.isTriggerLastSearch(chat, vimState)) {
      this.handleLastSearch(vimState);
      return;
    }

    if (this.isPressEnter(chat)) {
      this.handleEnterJump(vimState);
      return;
    }

    findMarkerByLabel(getCacheMarker(vimState.flash.searchString), chat)
      ? this.handleJump(chat, vimState)
      : this.handleSearch(chat, vimState);
  }
  private isTriggerLastSearch(chat: string, vimState: VimState) {
    return this.isPressEnter(chat) && vimState.flash.searchString === '';
  }

  private async handleLastSearch(vimState: VimState) {
    if (vimState.flash.previousSearchString.length === 0) {
      StatusBar.displayError(vimState, VimError.fromCode(ErrorCode.NoLastSearch));
      await vimState.setCurrentMode(vimState.flash.previousMode!);
      return;
    }
    this.handleSearch(vimState.flash.previousSearchString, vimState, true);
  }

  private isPressEnter(chat: string) {
    return chat === '\n';
  }

  private async handleEnterJump(vimState: VimState) {
    const firstMarker = getNextMatchMarker(
      vimState.flash.searchString,
      vimState.cursorStopPosition,
    );

    if (firstMarker) {
      this.changeCursorPosition(firstMarker, vimState);
    }
  }

  private async handleSearch(chat: string, vimState: VimState, isLastSearch: boolean = false) {
    if (this.isBackSpace(chat)) {
      const markers = getCacheMarker(vimState.flash.searchString);
      updateMarkersRangeToForward(markers);

      vimState.flash.deleteSearchString();

      if (vimState.flash.searchString.length === 0) {
        exitFlashMode(vimState);
      } else {
        this.deleteSearchString(vimState);
      }
    } else {
      vimState.flash.appendSearchString(chat);

      if (vimState.flash.searchString.length === 1 || isLastSearch) {
        vimState.flash.firstSearchChat = chat;
        this.handleFirstSearchString(vimState);
      } else {
        this.handleAppendSearchString(chat, vimState);
      }
    }
  }

  private async deleteSearchString(vimState: VimState) {
    const markers = getCacheMarker(vimState.flash.searchString);
    showMarkers(markers);
    updateMarkerLabel(markers, vimState);
    updateNextMatchMarker(markers, vimState.cursorStopPosition);
  }

  private async handleFirstSearchString(vimState: VimState) {
    const matches = createSearchMatches(vimState.flash.searchString, vimState.document, vimState);
    if (matches.length === 0) return;
    const labels = createMarkerLabels(matches, vimState);
    const markers = createMarkers(matches, labels, vimState.editor);
    cacheMarker(vimState.flash.searchString, markers);
    updateNextMatchMarker(markers, vimState.cursorStopPosition);
    showMarkers(markers);
  }

  private async handleAppendSearchString(chat: string, vimState: VimState) {
    const preMarkers = getPreMarkers(vimState.flash.searchString);
    let matchedMarkers = getCacheMarker(vimState.flash.searchString);
    if (!matchedMarkers) {
      matchedMarkers = getMatchedMarkers(preMarkers, chat, vimState);
      cacheMarker(vimState.flash.searchString, matchedMarkers);
    }
    hideNoMatchedMarkers(preMarkers, matchedMarkers);
    updateMarkersRangeToBackward(matchedMarkers);
    updateMarkerLabel(matchedMarkers, vimState);
    updateNextMatchMarker(matchedMarkers, vimState.cursorStopPosition);
    updateViewMarkers(matchedMarkers);
  }

  private async handleJump(key: string, vimState: VimState) {
    const markerDecoration = findMarkerByLabel(getCacheMarker(vimState.flash.searchString), key);
    if (markerDecoration) {
      this.changeCursorPosition(markerDecoration, vimState);
    }
  }

  private async changeCursorPosition(marker: Marker, vimState: VimState) {
    const operator = vimState.recordedState.operator;
    if (operator) {
      vimState.cursorStopPosition = marker.getOperatorPosition();
    } else {
      vimState.cursorStopPosition = marker.getJumpPosition();
    }

    exitFlashMode(vimState);
    vimState.flash.recordSearchString();
  }

  private isBackSpace(key: string) {
    return key === '<BS>' || key === '<S-BS>';
  }
}
@RegisterAction
class CommandEscFlashSearchInProgressMode extends BaseCommand {
  modes = [Mode.FlashSearchInProgressMode];
  keys = [['<Esc>'], ['<C-c>'], ['<C-[>']];

  public override async exec(position: Position, vimState: VimState): Promise<void> {
    exitFlashMode(vimState);
  }
}

async function exitFlashMode(vimState: VimState) {
  await vimState.setCurrentMode(vimState.flash.previousMode!);
  vimState.flash.clean();
}
