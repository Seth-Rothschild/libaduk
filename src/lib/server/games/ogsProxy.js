import { WebSocket } from 'ws';
import { GobanSocket } from '../../goban.js';
import * as db from '../db.js';

if (!globalThis.WebSocket) {
  globalThis.WebSocket = WebSocket;
}

const RELAYED_EVENTS = [
  'gamedata',
  'move',
  'clock',
  'phase',
  'chat',
  'removed_stones',
  'removed_stones_accepted',
  'undo_requested',
  'undo_accepted',
  'undo_canceled'
];

async function fetchOgsJwt(ogsToken) {
  const headers = ogsToken ? { Authorization: `Bearer ${ogsToken}` } : {};
  const res = await fetch('https://online-go.com/api/v1/ui/config/', { headers });
  if (!res.ok) return null;
  const config = await res.json();
  return config.user_jwt ?? null;
}

function phaseToStatus(phase) {
  return phase === 'finished' ? 'finished' : 'playing';
}

export class OgsGame {
  #gameId;
  #ogsGameId;
  #ogsToken;
  #emit;
  #socket = null;
  #seenChatIds = new Set();

  constructor(gameId, ogsGameId, ogsToken, emit) {
    this.#gameId = gameId;
    this.#ogsGameId = ogsGameId;
    this.#ogsToken = ogsToken;
    this.#emit = emit;
  }

  async connect() {
    const existingChat = await db.getChat(this.#gameId);
    for (const line of existingChat) {
      if (line.chat_id) this.#seenChatIds.add(line.chat_id);
    }

    const jwt = await fetchOgsJwt(this.#ogsToken);
    if (!jwt) {
      console.error('[OgsGame] failed to get OGS JWT for game', this.#gameId);
      return;
    }

    const socket = new GobanSocket('wss://wsp.online-go.com/');
    this.#socket = socket;
    socket.authenticate({ jwt });

    for (const suffix of RELAYED_EVENTS) {
      socket.on(`game/${this.#ogsGameId}/${suffix}`, (data) => {
        this.#persist(suffix, data).catch((err) => {
          console.error('[OgsGame] persist failed:', err.message);
        });
        this.#emit(`game/${this.#gameId}/${suffix}`, data);
      });
    }

    socket.on('connect', () => {
      socket.send('game/connect', { game_id: this.#ogsGameId, chat: true });
    });
  }

  async sendState(send) {
    const game = await db.getGame(this.#gameId);
    if (!game?.gamedata) return;
    send(`game/${this.#gameId}/gamedata`, game.gamedata);
    if (game.gamedata.clock) {
      send(`game/${this.#gameId}/clock`, game.gamedata.clock);
    }
  }

  async #persist(suffix, data) {
    if (suffix === 'gamedata') {
      const patch = { gamedata: data, status: phaseToStatus(data.phase) };
      if (data.phase === 'finished') {
        Object.assign(patch, this.#finishPatch(data));
      }
      await db.updateGame(this.#gameId, patch);
      return;
    }
    if (suffix === 'move') {
      const packedMove = [data.move[0], data.move[1]];
      await db.appendGamedataMove(this.#gameId, packedMove);
      return;
    }
    if (suffix === 'clock') {
      await db.updateGame(this.#gameId, { 'gamedata.clock': data });
      return;
    }
    if (suffix === 'phase') {
      const patch = { 'gamedata.phase': data, status: phaseToStatus(data) };
      if (data === 'finished') patch.endedAt = Date.now();
      await db.updateGame(this.#gameId, patch);
      return;
    }
    if (suffix === 'chat') {
      const line = data.line ?? data;
      if (!line.chat_id || this.#seenChatIds.has(line.chat_id)) return;
      this.#seenChatIds.add(line.chat_id);
      const body = typeof line.body === 'string' ? line.body : JSON.stringify(line.body);
      await db.appendChat(this.#gameId, { ...line, body });
      return;
    }
    if (suffix === 'removed_stones') {
      if (data.all_removed !== undefined) {
        await db.updateGame(this.#gameId, { 'gamedata.removed': data.all_removed });
      }
      return;
    }
    if (suffix === 'removed_stones_accepted') {
      if (data.phase !== 'finished') return;
      const game = await db.getGame(this.#gameId);
      const players = game?.gamedata?.players;
      if (!players) return;
      const winnerColor = data.winner === players.black.id ? 'black' : 'white';
      const margin = String(data.outcome).replace(' points', '');
      await db.updateGame(this.#gameId, {
        status: 'finished',
        winner: winnerColor,
        result: `${winnerColor === 'black' ? 'B' : 'W'}+${margin}`,
        endedAt: Date.now(),
        'gamedata.phase': 'finished',
        'gamedata.winner': data.winner,
        'gamedata.outcome': data.outcome,
        'gamedata.removed': data.stones ?? ''
      });
    }
  }

  #finishPatch(gamedata) {
    const winnerColor = gamedata.winner === gamedata.players.black.id ? 'black' : 'white';
    const margin = String(gamedata.outcome ?? '').replace(' points', '');
    return {
      winner: winnerColor,
      result: margin ? `${winnerColor === 'black' ? 'B' : 'W'}+${margin}` : null,
      endedAt: Date.now()
    };
  }

  move(moveString) {
    this.#socket?.send('game/move', { game_id: this.#ogsGameId, move: moveString });
  }

  resign() {
    this.#socket?.send('game/resign', { game_id: this.#ogsGameId });
  }

  cancel() {
    this.#socket?.send('game/cancel', { game_id: this.#ogsGameId });
  }

  timedOut() {
    this.#socket?.send('game/timed_out', { game_id: this.#ogsGameId });
  }

  setRemoved(stones, removed) {
    this.#socket?.send('game/removed_stones/set', {
      game_id: this.#ogsGameId,
      removed,
      stones
    });
  }

  acceptRemoval(stones) {
    this.#socket?.send('game/removed_stones/accept', {
      game_id: this.#ogsGameId,
      stones,
      strict_seki_mode: false
    });
  }

  rejectRemoval() {
    this.#socket?.send('game/removed_stones/reject', { game_id: this.#ogsGameId });
  }

  chat(body, moveNumber) {
    this.#socket?.send('game/chat', {
      game_id: this.#ogsGameId,
      type: 'main',
      move_number: moveNumber ?? 0,
      body
    });
  }

  destroy() {
    this.#socket?.disconnect();
    this.#socket = null;
  }
}
