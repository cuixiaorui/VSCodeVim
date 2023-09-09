import { Mode } from '../../../mode/mode';
import { cleanAllFlashMarkerDecorations } from './flashMarker';

export interface Flash {
  searchString: string;
  previousMode: Mode | undefined;
}

export const flash: Flash = {
  searchString: '',
  previousMode: undefined,
};

export function appendSearchString(chat: string) {
  flash.searchString += chat;
}
export function deleteSearchString() {
  flash.searchString = flash.searchString.slice(0, -1);
}

export function recordPreviousMode(mode: Mode) {
  flash.previousMode = mode;
}
export function resetFlash() {
  flash.searchString = '';
  flash.previousMode = undefined;
  cleanAllFlashMarkerDecorations();
}
