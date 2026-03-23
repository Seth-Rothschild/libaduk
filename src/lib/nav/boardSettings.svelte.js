import { browser } from '$app/environment';

class BoardSettings {
  showCoords = $state(false);

  init() {
    if (!browser) return;
    const stored = localStorage.getItem('go-showCoords');
    if (stored !== null) this.showCoords = stored === 'true';
  }

  toggleCoords = () => {
    this.showCoords = !this.showCoords;
    localStorage.setItem('go-showCoords', String(this.showCoords));
  };
}

export const boardSettings = new BoardSettings();
