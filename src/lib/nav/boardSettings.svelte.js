import { browser } from '$app/environment';

class BoardSettings {
  showCoords = $state(false);
  fuzzyPlacement = $state(true);

  init() {
    if (!browser) return;
    const stored = localStorage.getItem('go-showCoords');
    if (stored !== null) this.showCoords = stored === 'true';
    const fuzzy = localStorage.getItem('go-fuzzyPlacement');
    if (fuzzy !== null) this.fuzzyPlacement = fuzzy === 'true';
  }

  toggleCoords = () => {
    this.showCoords = !this.showCoords;
    localStorage.setItem('go-showCoords', String(this.showCoords));
  };

  toggleFuzzyPlacement = () => {
    this.fuzzyPlacement = !this.fuzzyPlacement;
    localStorage.setItem('go-fuzzyPlacement', String(this.fuzzyPlacement));
  };
}

export const boardSettings = new BoardSettings();
