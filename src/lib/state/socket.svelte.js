import { GobanSocket } from '$lib/goban.js';

class GameSocket {
  status = $state('disconnected');

  #socket = null;
  #joinData = null;

  join(gameId, color = null, ogsToken = null, name = null) {
    this.#joinData = { gameId, color, name, ogsToken };
    if (!this.#socket) {
      this.#open();
    } else if (this.#socket.connected) {
      this.#sendJoin();
    }
  }

  #open() {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new GobanSocket(`${protocol}://${location.host}/ws`);
    this.#socket = socket;
    socket.on('connect', () => {
      this.status = 'connected';
      this.#sendJoin();
    });
    socket.on('disconnect', () => {
      if (this.#socket === socket) this.status = 'reconnecting';
    });
  }

  #sendJoin() {
    if (this.#joinData) this.#socket.send('room/join', this.#joinData);
  }

  on(event, handler) {
    this.#socket?.on(event, handler);
  }

  send(command, data = {}) {
    this.#socket?.send(command, data);
  }

  leave() {
    const socket = this.#socket;
    this.#socket = null;
    this.#joinData = null;
    this.status = 'disconnected';
    if (socket) {
      socket.removeAllListeners();
      socket.disconnect();
    }
  }
}

export const gameSocket = new GameSocket();
