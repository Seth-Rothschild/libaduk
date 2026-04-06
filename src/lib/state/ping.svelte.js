import { browser } from '$app/environment';
import { getMe } from './user.svelte.js';
import { getGuestId } from './guestId.js';

class PingState {
  ping = $state(null);
  lobbyStats = $state({ playersOnline: 0, gamesInPlay: 0 });

  get lagRating() {
    if (!this.ping) return 0;
    if (this.ping < 150) return 4;
    if (this.ping < 300) return 3;
    if (this.ping < 500) return 2;
    return 1;
  }

  #ws = null;
  #interval = null;
  #sentAt = null;

  start() {
    if (!browser || this.#ws) return;
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${protocol}://${location.host}/ws`;
    this.#ws = new WebSocket(url);

    this.#ws.addEventListener('open', () => {
      this.#sendPing();
      this.#interval = setInterval(() => this.#sendPing(), 5000);
    });

    this.#ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'pong' && this.#sentAt != null) {
        this.ping = Date.now() - this.#sentAt;
        if (msg.playersOnline !== undefined) {
          this.lobbyStats = { playersOnline: msg.playersOnline, gamesInPlay: msg.gamesInPlay };
        }
      }
    });

    this.#ws.addEventListener('close', () => {
      clearInterval(this.#interval);
      this.#ws = null;
      this.ping = null;
    });
  }

  stop() {
    clearInterval(this.#interval);
    this.#ws?.close();
    this.#ws = null;
  }

  #sendPing() {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#sentAt = Date.now();
      const me = getMe();
      const name = me?.username || getGuestId();
      const isAuth = !!me;
      this.#ws.send(JSON.stringify({ type: 'ping', name, isAuth }));
    }
  }
}

export const pingState = new PingState();
