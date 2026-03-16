import { browser } from '$app/environment';

class BoardState {
  showCoords = $state(false);

  init() {
    if (!browser) return;
    const stored = localStorage.getItem('go-showCoords');
    if (stored !== null) this.showCoords = stored === 'true';
  }

  toggleCoords() {
    this.showCoords = !this.showCoords;
    localStorage.setItem('go-showCoords', String(this.showCoords));
  }
}

export const boardState = new BoardState();
