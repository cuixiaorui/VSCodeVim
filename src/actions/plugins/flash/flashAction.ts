import { BaseCommand } from '../../base';
import { Mode } from '../../../mode/mode';
import { Position } from 'vscode';
import { VimState } from '../../../state/vimState';
import { RegisterAction } from '../../base';
import { configuration } from '../../../configuration/configuration';
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

  public override doesActionApply(vimState: VimState, keysPressed: string[]) {
    return (
      super.doesActionApply(vimState, keysPressed) &&
      configuration.flash.enable &&
      !vimState.isMultiCursor
    );
  }

  public override async exec(position: Position, vimState: VimState): Promise<void> {
    if (!configuration.flash.enable) return;

    vimState.flash.reset();
    vimState.flash.recordPreviousMode(vimState.currentMode);
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

    findMarkerDecorationByLabel(chat)
      ? this.handleJump(chat, vimState)
      : this.handleSearch(chat, vimState);
  }

  private handleSearch(chat: string, vimState: VimState) {
    if (this.isBackSpace(chat)) {
      vimState.flash.deleteSearchString();
    } else {
      vimState.flash.appendSearchString(chat);
    }

    cleanAllFlashMarkerDecorations();

    const matches = createSearchMatches(vimState.flash, vimState.document);
    const labels = createMarkerLabels(matches, vimState);
    createMarkerDecorations(matches, labels, vimState.editor);
  }

  private async handleJump(key: string, vimState: VimState) {
    const markerDecoration = findMarkerDecorationByLabel(key);
    vimState.cursorStopPosition = markerDecoration!.getJumpPosition();
    await vimState.setCurrentMode(vimState.flash.previousMode!);
    vimState.flash.reset();
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
    vimState.flash.reset();
  }
}
