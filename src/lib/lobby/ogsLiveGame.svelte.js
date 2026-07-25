import { browser } from '$app/environment';
import { formatOgsClock } from '$lib/lobby/ogsSeekGraph.svelte.js';
import GoBoardLib from '@sabaki/go-board';
import { applyMoveWithShifts, parseSgfCoords } from '$lib/game/board';
import { emptyShiftMap } from '$lib/game/board/helpers.js';
import { fetchOgsConfig, openOgsSocket } from '$lib/ogs/ogsSocket.js';

class OgsLiveGame {
  game = $state(null);
  board = $state(null);
  handicapStones = [];
  shiftMap = $state(null);

  get initialBoard() {
    if (this.handicapStones.length === 0) return null;
    const size = this.game?.width ?? 19;
    const signMap = GoBoardLib.fromDimensions(size).signMap.map((row) => [...row]);
    for (const [x, y] of this.handicapStones) signMap[y][x] = 1;
    return new GoBoardLib(signMap);
  }
  clock = $state(null);
  lastMove = $state(null);
  animatedVertex = $state(null);
  moves = $state([]);
  result = $state(null);

  onGameStart = null;
  onGameEnd = null;

  #socket = null;
  #gameId = null;
  #listenersAttachedFor = null;
  #moveCount = 0;
  #firstColor = 1;
  #endedFired = false;

  async start(gameId = null) {
    if (!browser || this.#socket) return;

    const config = await fetchOgsConfig();
    const jwt = config?.user_jwt;
    if (!jwt) return;

    const socket = openOgsSocket(jwt);
    this.#socket = socket;

    socket.on('connect', () => {
      if (this.#gameId ?? gameId) {
        this.#gameId = this.#gameId ?? gameId;
        this.#connectToGame(this.#gameId);
      } else {
        this.#queryTopGame();
      }
    });
  }

  #queryTopGame() {
    const query = {
      list: 'live',
      sort_by: 'rank',
      where: { hide_bot_games: true },
      from: 0,
      limit: 1,
      channel: ''
    };
    this.#socket.send('gamelist/query', query, (response) => {
      const topGame = response?.results?.[0];
      if (!topGame) return;
      this.game = topGame;
      this.#gameId = topGame.id;
      this.#connectToGame(topGame.id);
      if (typeof this.onGameStart === 'function') this.onGameStart(topGame);
    });
  }

  #connectToGame(gameId) {
    const socket = this.#socket;
    const prefix = `game/${gameId}/`;

    if (this.#listenersAttachedFor !== gameId) {
      this.#listenersAttachedFor = gameId;
      socket.on(`${prefix}gamedata`, (data) => this.#handleGamedata(data));
      socket.on(`${prefix}move`, (data) => this.#handleMove(data));
      socket.on(`${prefix}clock`, (data) => this.#handleClock(data));
      socket.on(`${prefix}phase`, (data) => {
        if (data === 'finished') this.#fireGameEnd();
      });
      socket.on(`${prefix}removed_stones_accepted`, (data) => {
        if (data.phase === 'finished') {
          this.result = this.#computeResultFromData(data);
          this.#fireGameEnd();
        }
      });
    }

    socket.send('game/connect', { game_id: gameId, chat: false });
  }

  stop() {
    if (this.#socket) {
      if (this.#gameId) {
        this.#socket.send('game/disconnect', { game_id: this.#gameId });
      }
      this.#socket.disconnect();
      this.#socket = null;
    }
    this.game = null;
    this.board = null;
    this.handicapStones = [];
    this.shiftMap = null;
    this.clock = null;
    this.lastMove = null;
    this.animatedVertex = null;
    this.moves = [];
    this.result = null;
    this.#gameId = null;
    this.#listenersAttachedFor = null;
    this.#moveCount = 0;
    this.#firstColor = 1;
    this.#endedFired = false;
  }

  #fireGameEnd() {
    if (this.#endedFired) return;
    this.#endedFired = true;
    if (typeof this.onGameEnd === 'function') this.onGameEnd(this.#gameId);
  }

  #handleGamedata(data) {
    if (!this.game) {
      const rules = data.rules ? data.rules[0].toUpperCase() + data.rules.slice(1) : null;
      this.game = {
        id: this.#gameId,
        width: data.width,
        black: data.players?.black,
        white: data.players?.white,
        ranked: data.ranked ?? false,
        komi: data.komi ?? null,
        rules,
        timeControl: formatOgsClock(data.time_control),
        handicap: data.handicap || 0
      };
    }
    this.#firstColor = data.initial_player === 'white' ? -1 : 1;
    const size = data.width;
    let board = GoBoardLib.fromDimensions(size);
    let shifts = emptyShiftMap(size);

    const handicapStones = parseSgfCoords(data.initial_state?.black ?? '');
    this.handicapStones = handicapStones;
    if (handicapStones.length > 0) {
      const signMap = board.signMap.map((row) => [...row]);
      for (const [x, y] of handicapStones) {
        signMap[y][x] = 1;
      }
      board = new GoBoardLib(signMap);
    }

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

    if (data.phase === 'finished' || data?.paused_since) {
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
}

export const ogsLiveGame = new OgsLiveGame();
