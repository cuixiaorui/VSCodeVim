import { BaseCommand } from '../../base';
import { Mode } from '../../../mode/mode';
import { Position } from 'vscode';
import { VimState } from '../../../state/vimState';
import { RegisterAction } from '../../base';
import { configuration } from '../../../configuration/configuration';
import {
  appendSearchString,
  resetFlash,
  flash,
  deleteSearchString,
  recordPreviousMode,
} from './flash';
import { createSearchMatches } from './flashMatch';
import {
  cleanAllFlashMarkerDecorations,
  findMarkerDecorationByLabel,
  createMarkerLabels,
  createMarkerDecorations,
} from './flashMarker';
@RegisterAction
class FlashCommand extends BaseCommand {
  modes = [Mode.Normal, Mode.Visual, Mode.VisualLine, Mode.VisualBlock];
  keys = ['s'];
  override isJump = true;

  public override doesActionApply(vimState: VimState, keysPressed: string[]) {
    return (
      super.doesActionApply(vimState, keysPressed) &&
      configuration.flash.enable &&
      !vimState.isMultiCursor
    );
  }

  public override async exec(position: Position, vimState: VimState): Promise<void> {
    if (!configuration.flash.enable) return;

    resetFlash();
    recordPreviousMode(vimState.currentMode);
    await vimState.setCurrentMode(Mode.FlashSearchInProgressMode);
  }
}

@RegisterAction
class FlashSearchInProgressCommand extends BaseCommand {
  modes = [Mode.FlashSearchInProgressMode];
  keys = ['<character>'];

  public override async exec(position: Position, vimState: VimState): Promise<void> {
    const chat = this.keysPressed[0];

    findMarkerDecorationByLabel(chat)
      ? this.handleJump(chat, vimState)
      : this.handleSearch(chat, vimState);
  }

  private handleSearch(chat: string, vimState: VimState) {
    if (this.isBackSpace(chat)) {
      deleteSearchString();
    } else {
      appendSearchString(chat);
    }

    cleanAllFlashMarkerDecorations();

    const matches = createSearchMatches(vimState.document);
    const labels = createMarkerLabels(matches, vimState);
    createMarkerDecorations(matches, labels, vimState.editor);
  }

  private async handleJump(key: string, vimState: VimState) {
    const markerDecoration = findMarkerDecorationByLabel(key);
    vimState.cursorStopPosition = markerDecoration!.getJumpPosition();
    await vimState.setCurrentMode(flash.previousMode!);
    resetFlash();
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
    await vimState.setCurrentMode(flash.previousMode!);
    resetFlash();
  }
}
