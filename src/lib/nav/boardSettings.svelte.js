import { browser } from '$app/environment';

class BoardSettings {
  showCoords = $state(false);
  fuzzyPlacement = $state(true);
  moveConfirmation = $state('none');
  ctrlClickBehavior = $state('clipboard');

  init() {
    if (!browser) return;
    const stored = localStorage.getItem('go-showCoords');
    if (stored !== null) this.showCoords = stored === 'true';
    const fuzzy = localStorage.getItem('go-fuzzyPlacement');
    if (fuzzy !== null) this.fuzzyPlacement = fuzzy === 'true';
    const confirm = localStorage.getItem('go-moveConfirmation');
    if (confirm !== null) this.moveConfirmation = confirm;
    const ctrlClick = localStorage.getItem('go-ctrlClickBehavior');
    if (ctrlClick !== null) this.ctrlClickBehavior = ctrlClick;
  }

  toggleCoords = () => {
    this.showCoords = !this.showCoords;
    localStorage.setItem('go-showCoords', String(this.showCoords));
  };

  toggleFuzzyPlacement = () => {
    this.fuzzyPlacement = !this.fuzzyPlacement;
    localStorage.setItem('go-fuzzyPlacement', String(this.fuzzyPlacement));
  };

  setMoveConfirmation = (value) => {
    this.moveConfirmation = value;
    localStorage.setItem('go-moveConfirmation', value);
  };

  setCtrlClickBehavior = (value) => {
    this.ctrlClickBehavior = value;
    localStorage.setItem('go-ctrlClickBehavior', value);
  };
}

export const boardSettings = new BoardSettings();
