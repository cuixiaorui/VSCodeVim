import { Mode } from '../../../mode/mode';
import { cleanFlashMarkers } from './flashMarker';
import { escapeCSSIcons } from '../../../util/statusBarTextUtils';
import { VimState } from '../../../state/vimState';

export class Flash {
  public searchString: string = '';
  public previousMode: Mode | undefined = undefined;
  public previousSearchString: string = '';
  public firstSearchChat: string = '';

  displayStatusBarText(cursorChar: string) {
    return escapeCSSIcons(`flash:${this.searchString}${cursorChar}`);
  }

  appendSearchString(chat: string) {
    this.searchString += chat;
  }

  deleteSearchString() {
    this.searchString = this.searchString.slice(0, -1);
  }

  recordPreviousMode(mode: Mode) {
    this.previousMode = mode;
  }
  clean() {
    cleanFlashMarkers(this);
  }

  recordSearchString() {
    this.previousSearchString = this.searchString;
  }
}

export function createFlash(vimState: VimState) {
  const flash = new Flash();
  flash.previousSearchString = vimState.flash.previousSearchString;
  flash.previousMode = vimState.currentMode;
  return flash;
}
