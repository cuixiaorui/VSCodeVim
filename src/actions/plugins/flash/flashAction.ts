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
  cleanAllFlashMarkerDecorations,
  findMarkerDecorationByLabel,
  createMarkerLabels,
  createMarkerDecorations,
  getEnterJumpMarker,
  MarkerDecoration,
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

    findMarkerDecorationByLabel(chat)
      ? this.handleJump(chat, vimState)
      : this.handleSearch(chat, vimState);
  }

  private isTriggerLastSearch(chat: string, vimState: VimState) {
    return this.isPressEnter(chat) && vimState.flash.searchString === '';
  }

  private async handleLastSearch(vimState: VimState) {
    if (vimState.flash.previousSearchString.length === 0) {
      StatusBar.displayError(vimState, VimError.fromCode(ErrorCode.PatternNotFound));
      await vimState.setCurrentMode(vimState.flash.previousMode!);
      return;
    }
    this.handleSearch(vimState.flash.previousSearchString, vimState);
  }

  private isPressEnter(chat: string) {
    return chat === '\n';
  }

  private async handleEnterJump(vimState: VimState) {
    const firstMarker = getEnterJumpMarker(vimState);
    if (firstMarker) {
      this.changeCursorPosition(firstMarker, vimState);
    }
  }

  private handleSearch(chat: string, vimState: VimState) {
    if (this.isBackSpace(chat)) {
      vimState.flash.deleteSearchString();
    } else {
      vimState.flash.appendSearchString(chat);
    }

    cleanAllFlashMarkerDecorations();

    const matches = createSearchMatches(vimState.flash, vimState.document, vimState);
    if (matches.length === 0) return;

    const labels = createMarkerLabels(matches, vimState);
    createMarkerDecorations(matches, labels, vimState.editor);
    getEnterJumpMarker(vimState).markEnterJump();
  }

  private async handleJump(key: string, vimState: VimState) {
    const markerDecoration = findMarkerDecorationByLabel(key);
    if (markerDecoration) {
      this.changeCursorPosition(markerDecoration, vimState);
      vimState.flash.recordSearchString();
    }
  }

  private async changeCursorPosition(marker: MarkerDecoration, vimState: VimState) {
    const recordedState = vimState.recordedState;
    if (recordedState.operator) {
      vimState.cursorStopPosition = marker.getOperatorPosition();
    } else {
      vimState.cursorStopPosition = marker.getJumpPosition();
    }
    await vimState.setCurrentMode(vimState.flash.previousMode!);
    vimState.flash.clean();
  }

  private isBackSpace(key: string) {
    return key === '<BS>' || key === '<S-BS>';
  }
}

@RegisterAction
class CommandEscFlashSearchInProgressMode extends BaseCommand {
  modes = [Mode.FlashSearchInProgressMode];
  keys = ['<Esc>'];

  public override async exec(position: Position, vimState: VimState): Promise<void> {
    await vimState.setCurrentMode(vimState.flash.previousMode!);
    vimState.flash.clean();
  }
}
