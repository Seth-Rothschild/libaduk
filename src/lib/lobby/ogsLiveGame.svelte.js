import { browser } from '$app/environment';
import GoBoardLib from '@sabaki/go-board';
import { applyMoveWithShifts } from '$lib/game/board';
import { emptyShiftMap } from '$lib/game/board/helpers.js';

class OgsLiveGame {
  game = $state(null);
  board = $state(null);
  shiftMap = $state(null);
  clock = $state(null);
  lastMove = $state(null);
  animatedVertex = $state(null);

  #ws = null;
  #pingInterval = null;
  #tickInterval = null;
  #msgId = 1;
  #drift = 0;
  #latency = 0;
  #gameId = null;
  #moveCount = 0;

  async start() {
    if (!browser || this.#ws) return;

    const configRes = await fetch('https://online-go.com/api/v1/ui/config/');
    if (!configRes.ok) return;
    const config = await configRes.json();
    const jwt = config.user_jwt;
    if (!jwt) return;

    const ws = new WebSocket('wss://wsp.online-go.com/');
    this.#ws = ws;

    ws.onopen = () => {
      this.#send('authenticate', { jwt });
      this.#send('gamelist/query', {
        list: 'live',
        sort_by: 'rank',
        where: {},
        from: 0,
        limit: 1,
        channel: ''
      });
      this.#pingInterval = setInterval(() => {
        this.#send('net/ping', { client: Date.now(), drift: this.#drift, latency: this.#latency });
      }, 10000);
    };

    ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }

      const name = msg[0];
      const data = msg[1];

      if (typeof name === 'number') {
        this.#handleAck(data);
        return;
      }

      if (name === 'net/pong') {
        const now = Date.now();
        this.#latency = now - data.client;
        this.#drift = now - this.#latency / 2 - data.server;
        return;
      }

      if (!this.#gameId) return;
      const prefix = `game/${this.#gameId}/`;

      if (name === `${prefix}gamedata`) {
        this.#handleGamedata(data);
        return;
      }

      if (name === `${prefix}move`) {
        this.#handleMove(data);
        return;
      }

      if (name === `${prefix}clock`) {
        this.#handleClock(data);
        return;
      }
    };

    ws.onclose = () => {
      clearInterval(this.#pingInterval);
      this.#pingInterval = null;
      this.#ws = null;
    };
  }

  stop() {
    clearInterval(this.#pingInterval);
    clearInterval(this.#tickInterval);
    if (this.#ws) {
      if (this.#gameId) {
        this.#send('game/disconnect', { game_id: this.#gameId });
      }
      this.#ws.close();
      this.#ws = null;
    }
    this.game = null;
    this.board = null;
    this.shiftMap = null;
    this.clock = null;
    this.#gameId = null;
    this.#moveCount = 0;
  }

  #handleAck(data) {
    if (!data?.results?.length) return;
    const topGame = data.results[0];
    this.game = topGame;
    this.#gameId = topGame.id;
    this.#send('game/connect', { game_id: this.#gameId, chat: false });
  }

  #handleGamedata(data) {
    const size = data.width;
    let board = GoBoardLib.fromDimensions(size);
    let shifts = emptyShiftMap(size);

    const moves = data.moves || [];
    for (let i = 0; i < moves.length; i++) {
      const x = moves[i][0];
      const y = moves[i][1];
      const color = i % 2 === 0 ? 1 : -1;
      if (x >= 0 && y >= 0) {
        const result = applyMoveWithShifts(board, shifts, color, x, y);
        board = result.board;
        shifts = result.shiftMap;
      }
    }

    this.board = board;
    this.shiftMap = shifts;
    this.#moveCount = moves.length;

    const lastOgsMove = moves.length > 0 ? moves[moves.length - 1] : null;
    if (lastOgsMove && lastOgsMove[0] >= 0 && lastOgsMove[1] >= 0) {
      this.lastMove = [lastOgsMove[0], lastOgsMove[1]];
    }
    this.animatedVertex = null;

    this.#handleClock(data.clock);
  }

  #handleMove(data) {
    if (!this.board || !this.shiftMap) return;
    const x = data.move[0];
    const y = data.move[1];
    const color = this.#moveCount % 2 === 0 ? 1 : -1;
    this.#moveCount++;
    if (x >= 0 && y >= 0) {
      const result = applyMoveWithShifts(this.board, this.shiftMap, color, x, y);
      this.board = result.board;
      this.shiftMap = result.shiftMap;
      this.lastMove = [x, y];
      this.animatedVertex = [x, y];
    }
  }

  #handleClock(data) {
    if (!data) return;
    const activeColor = data.current_player === this.game?.black?.id ? 'black' : 'white';
    this.clock = {
      black: this.#parseTime(data.black_time),
      white: this.#parseTime(data.white_time),
      activeColor
    };
    this.#startTick();
  }

  #startTick() {
    clearInterval(this.#tickInterval);
    this.#tickInterval = setInterval(() => {
      if (!this.clock) return;
      const side = this.clock[this.clock.activeColor];
      if (!side) return;
      if (side.inByoYomi) {
        side.byoMs = Math.max(0, side.byoMs - 1000);
      } else {
        side.mainMs = Math.max(0, side.mainMs - 1000);
        if (side.mainMs <= 0) side.inByoYomi = true;
      }
      this.clock = { ...this.clock };
    }, 1000);
  }

  #parseTime(t) {
    if (!t) return null;
    const mainMs = t.thinking_time * 1000;
    return {
      mainMs,
      byoMs: t.period_time * 1000,
      byoPeriods: t.periods,
      inByoYomi: mainMs <= 0
    };
  }

  #send(command, payload) {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify([command, payload, this.#msgId++]));
    }
  }
}

export const ogsLiveGame = new OgsLiveGame();
