import { Mode } from '../../../mode/mode';
import { cleanAllFlashMarkerDecorations } from './flashMarker';
import { escapeCSSIcons } from '../../../util/statusBarTextUtils';

export class Flash {
  public searchString: string = '';
  public previousMode: Mode | undefined = undefined;

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

  reset() {
    this.searchString = '';
    this.previousMode = undefined;
    cleanAllFlashMarkerDecorations();
  }
}
