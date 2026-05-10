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
  moves = $state([]);
  result = $state(null);

  onGameStart = null;
  onGameEnd = null;

  #ws = null;
  #pingInterval = null;
  #msgId = 1;
  #drift = 0;
  #latency = 0;
  #gameId = null;
  #moveCount = 0;
  #firstColor = 1;
  #endedFired = false;

  async start(gameId = null) {
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
      if (gameId) {
        this.#gameId = gameId;
        this.#send('game/connect', { game_id: gameId, chat: false });
      } else {
        this.#send('gamelist/query', {
          list: 'live',
          sort_by: 'rank',
          where: { hide_bot_games: true },
          from: 0,
          limit: 1,
          channel: ''
        });
      }
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

      if (name === `${prefix}phase`) {
        if (data === 'finished') this.#fireGameEnd();
        return;
      }

      if (name === `${prefix}removed_stones_accepted`) {
        if (data.phase === 'finished') {
          this.result = this.#computeResultFromData(data);
          this.#fireGameEnd();
        }
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
    this.lastMove = null;
    this.animatedVertex = null;
    this.moves = [];
    this.result = null;
    this.#gameId = null;
    this.#moveCount = 0;
    this.#firstColor = 1;
    this.#endedFired = false;
  }

  #handleAck(data) {
    if (!data?.results?.length) return;
    const topGame = data.results[0];
    this.game = topGame;
    this.#gameId = topGame.id;
    this.#send('game/connect', { game_id: this.#gameId, chat: false });
    if (typeof this.onGameStart === 'function') this.onGameStart(topGame);
  }

  #fireGameEnd() {
    if (this.#endedFired) return;
    this.#endedFired = true;
    if (typeof this.onGameEnd === 'function') this.onGameEnd(this.#gameId);
  }

  #handleGamedata(data) {
    if (!this.game) {
      this.game = {
        id: this.#gameId,
        width: data.width,
        black: data.players?.black,
        white: data.players?.white
      };
    }
    this.#firstColor = data.initial_player === 'white' ? -1 : 1;
    const size = data.width;
    let board = GoBoardLib.fromDimensions(size);
    let shifts = emptyShiftMap(size);

    const moves = data.moves || [];
    const recordedMoves = [];
    for (let i = 0; i < moves.length; i++) {
      const x = moves[i][0];
      const y = moves[i][1];
      const color = i % 2 === 0 ? this.#firstColor : -this.#firstColor;
      if (x >= 0 && y >= 0) {
        try {
          const result = applyMoveWithShifts(board, shifts, color, x, y);
          board = result.board;
          shifts = result.shiftMap;
        } catch {
          const signMap = board.signMap.map((row) => [...row]);
          signMap[y][x] = color;
          board = new GoBoardLib(signMap);
        }
        recordedMoves.push({ x, y, color });
      } else {
        recordedMoves.push({ x: -1, y: -1, color });
      }
    }

    this.moves = recordedMoves;
    this.board = board;
    this.shiftMap = shifts;
    this.#moveCount = moves.length;

    const lastOgsMove = moves.length > 0 ? moves[moves.length - 1] : null;
    if (lastOgsMove && lastOgsMove[0] >= 0 && lastOgsMove[1] >= 0) {
      this.lastMove = [lastOgsMove[0], lastOgsMove[1]];
    }
    this.animatedVertex = null;

    this.#handleClock(data.clock);

    if (data.phase === 'finished') {
      this.result = this.#computeResultFromData(data);
      this.#fireGameEnd();
      if (!this.onGameEnd)
        setTimeout(() => {
          this.stop();
          this.start(null);
        }, 0);
    }
  }

  #computeResultFromData(data) {
    if (data.winner == null || data.outcome == null) return null;
    const blackId = this.game?.black?.id ?? data.players?.black?.id;
    const winnerColor = data.winner === blackId ? 'black' : 'white';
    const margin = String(data.outcome).replace(' points', '');
    const prefix = winnerColor === 'black' ? 'B' : 'W';
    return { winner: winnerColor, result: `${prefix}+${margin}` };
  }

  #handleMove(data) {
    if (!this.board || !this.shiftMap) return;
    const x = data.move[0];
    const y = data.move[1];
    const color = this.#moveCount % 2 === 0 ? this.#firstColor : -this.#firstColor;
    this.#moveCount++;
    if (x >= 0 && y >= 0) {
      const result = applyMoveWithShifts(this.board, this.shiftMap, color, x, y);
      this.board = result.board;
      this.shiftMap = result.shiftMap;
      this.lastMove = [x, y];
      this.animatedVertex = [x, y];
      this.moves = [...this.moves, { x, y, color }];
    } else {
      this.moves = [...this.moves, { x: -1, y: -1, color }];
    }
  }

  #handleClock(data) {
    if (!data) return;
    const activeColor = data.current_player === this.game?.black?.id ? 'black' : 'white';
    this.clock = {
      black: this.#parseTime(data.black_time),
      white: this.#parseTime(data.white_time),
      activeColor,
      turnStartedAt: Date.now()
    };
  }

  #parseTime(t) {
    if (!t) return null;
    const mainMs = t.thinking_time * 1000;
    const periodMs = t.period_time * 1000;
    return {
      mainMs,
      byoMs: t.period_time * 1000,
      byoPeriods: t.periods,
      inByoYomi: mainMs <= 0,
      periodMs
    };
  }

  #send(command, payload) {
    if (this.#ws?.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify([command, payload, this.#msgId++]));
    }
  }
}

export const ogsLiveGame = new OgsLiveGame();
