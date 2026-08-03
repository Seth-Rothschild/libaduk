// @ts-check
import { GobanSocket } from '$lib/goban.js';

/**
 * @typedef {import('$lib/protocol').LibadukClientToServer} ClientToServer
 * @typedef {import('$lib/protocol').LibadukGameSocketEvents} SocketEvents
 * @typedef {import('goban-engine').GobanSocket<ClientToServer>} LibadukSocket
 */

class GameSocket {
  status = $state('disconnected');

  /** @type {LibadukSocket | null} */
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
    /** @type {LibadukSocket} */
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

  /**
   * @template {keyof SocketEvents} E
   * @param {E} event
   * @param {SocketEvents[E]} handler
   */
  on(event, handler) {
    const emitter = /** @type {import('eventemitter3').EventEmitter<SocketEvents>} */ (
      /** @type {unknown} */ (this.#socket)
    );
    emitter?.on(event, /** @type {any} */ (handler));
  }

  /**
   * @template {keyof ClientToServer} C
   * @param {C} command
   * @param {import('goban-engine').DataArgument<ClientToServer[C]>} data
   */
  send(command, data) {
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
