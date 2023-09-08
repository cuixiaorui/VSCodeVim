import { BaseCommand } from '../../base';
import { Mode } from '../../../mode/mode';
import { Position } from 'vscode';
import { VimState } from '../../../state/vimState';
import { RegisterAction } from '../../base';
import { configuration } from '../../../configuration/configuration';
import * as vscode from 'vscode';
import {
  appendSearchString,
  resetFlash,
  flash,
  deleteSearchString,
  generateFlashDecorations,
  getSearchMatches,
  MarkerDecoration,
  findMarkerDecorationByLabel,
  takeMarkerLabel,
  generateMarkerLabels,
} from './flash';

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
    if (configuration.flash.enable) {
      resetFlash();
      flash.previousMode = vimState.currentMode;
      await vimState.setCurrentMode(Mode.FlashSearchInProgressMode);
    }
  }
}

@RegisterAction
class FlashSearchInProgressCommand extends BaseCommand {
  modes = [Mode.FlashSearchInProgressMode];
  keys = ['<character>'];
  public searchString: string = '';

  public override async exec(position: Position, vimState: VimState): Promise<void> {
    const key = this.keysPressed[0];

    const markerDecoration = findMarkerDecorationByLabel(key);
    if (markerDecoration) {
      vimState.cursorStopPosition = markerDecoration.getJumpPosition();
      await vimState.setCurrentMode(flash.previousMode!);
      resetFlash();
    } else {
      if (key === '<BS>' || key === '<S-BS>') {
        deleteSearchString();
      } else {
        appendSearchString(key);
      }

      if (flash.markerDecorations) {
        // clean all marker decorations
        flash.markerDecorations.forEach((marker) => {
          marker.dispose();
        });
      }

      const matches = getSearchMatches(vimState);
      const labels = generateMarkerLabels(matches, vimState);
      flash.markerDecorations = matches.map(({ range }, index) => {
        const label = labels[index] || '';
        const markerDecoration = new MarkerDecoration(range, vimState, label);
        markerDecoration.show();
        return markerDecoration;
      });
    }
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
