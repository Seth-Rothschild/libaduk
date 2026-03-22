import GoBoardLib from '@sabaki/go-board';
import { emptyShiftMap } from './gameUtils.js';

function readjustShifts(shiftMap, x, y) {
  const direction = shiftMap[y]?.[x];
  if (!direction) return;
  const neighbors = [
    [[1, 5, 8], x - 1, y, [3, 7, 6]],
    [[2, 5, 6], x, y - 1, [4, 7, 8]],
    [[3, 7, 6], x + 1, y, [1, 5, 8]],
    [[4, 7, 8], x, y + 1, [2, 5, 6]]
  ];
  for (const [dirs, qx, qy, removeShifts] of neighbors) {
    if (!dirs.includes(direction)) continue;
    if (shiftMap[qy]?.[qx] && removeShifts.includes(shiftMap[qy][qx])) {
      shiftMap[qy][qx] = 0;
    }
  }
}

export function replayMoves(moves, size) {
  let board = GoBoardLib.fromDimensions(size);
  let sign = 1;
  for (const move of moves) {
    if (move.type === 'move') {
      try {
        board = board.makeMove(sign, [move.x, move.y], {
          preventSuicide: true,
          preventOverwrite: true,
          preventKo: true
        });
      } catch {}
    }
    sign = sign === 1 ? -1 : 1;
  }
  return board;
}

export class GameState {
  boardSize = $state(19);
  board = $state(GoBoardLib.fromDimensions(19));
  currentSign = $state(1);
  consecutivePasses = $state(0);
  status = $state('waiting');
  lastMove = $state(null);
  winner = $state(null);
  winnerResult = $state(null);
  shiftMap = $state(emptyShiftMap(19));
  animatedVertex = $state(null);
  timeControl = $state({ type: 'none' });
  clockState = $state(null);
  corrState = $state(null);
  deadStones = $state([]);
  blackApproved = $state(false);
  whiteApproved = $state(false);
  finalScore = $state(null);
  timedOutColor = $state(null);
  mySign = $state(null);
  isLocal = false;

  boardHistory = $state([]);
  lastMoveHistory = $state([]);
  shiftMapHistory = $state([]);
  viewPly = $state(null);

  get totalPly() {
    return this.boardHistory.length - 1;
  }

  get currentViewPly() {
    return this.viewPly ?? this.totalPly;
  }

  get isViewingHistory() {
    return this.viewPly !== null && this.viewPly < this.totalPly;
  }

  get viewBoard() {
    if (this.viewPly === null || this.viewPly >= this.totalPly) return this.board;
    return this.boardHistory[this.viewPly] ?? this.board;
  }

  get viewLastMove() {
    if (this.viewPly === null || this.viewPly >= this.totalPly) return this.lastMove;
    return this.lastMoveHistory[this.viewPly] ?? null;
  }

  get viewShiftMap() {
    if (this.viewPly === null || this.viewPly >= this.totalPly) return this.shiftMap;
    return this.shiftMapHistory[this.viewPly] ?? emptyShiftMap(this.boardSize);
  }

  jumpTo(ply) {
    const clamped = Math.max(0, Math.min(ply, this.totalPly));
    this.viewPly = clamped >= this.totalPly ? null : clamped;
  }

  jumpFirst() {
    this.jumpTo(0);
  }

  jumpPrev() {
    this.jumpTo(this.currentViewPly - 1);
  }

  jumpNext() {
    this.jumpTo(this.currentViewPly + 1);
  }

  jumpLast() {
    this.viewPly = null;
  }

  constructor({ isLocal = false } = {}) {
    this.isLocal = isLocal;
    if (isLocal) this.mySign = 1;
  }

  initFromData(game, viewerColor) {
    this.boardSize = game.size ?? 19;
    this.timeControl = game.timeControl ?? { type: 'none' };
    this.shiftMap = emptyShiftMap(this.boardSize);

    if (viewerColor === 'black') this.mySign = 1;
    else if (viewerColor === 'white') this.mySign = -1;
    else this.mySign = null;

    if (game.moves && game.moves.length > 0) {
      this.boardHistory = [GoBoardLib.fromDimensions(this.boardSize)];
      this.lastMoveHistory = [null];
      this.shiftMapHistory = [emptyShiftMap(this.boardSize)];
      let replayBoard = GoBoardLib.fromDimensions(this.boardSize);
      let replayShiftMap = emptyShiftMap(this.boardSize);
      let sign = 1;
      for (const move of game.moves) {
        if (move.type === 'move') {
          try {
            replayBoard = replayBoard.makeMove(sign, [move.x, move.y], {
              preventSuicide: true,
              preventOverwrite: true,
              preventKo: true
            });
            replayShiftMap = replayShiftMap.map((row) => [...row]);
            replayShiftMap[move.y][move.x] = Math.ceil(Math.random() * 8);
            readjustShifts(replayShiftMap, move.x, move.y);
          } catch {}
          this.boardHistory.push(replayBoard);
          this.lastMoveHistory.push([move.x, move.y]);
          this.shiftMapHistory.push(replayShiftMap);
        } else {
          this.boardHistory.push(replayBoard);
          this.lastMoveHistory.push(null);
          this.shiftMapHistory.push(replayShiftMap);
        }
        sign = sign === 1 ? -1 : 1;
      }
      this.board = replayBoard;
      this.shiftMap = replayShiftMap;
      this.consecutivePasses = 0;
      this.currentSign = game.moves.length % 2 === 0 ? 1 : -1;
      const lastMoveEntry = game.moves.at(-1);
      if (lastMoveEntry?.type === 'move') this.lastMove = [lastMoveEntry.x, lastMoveEntry.y];
    } else {
      this.board = GoBoardLib.fromDimensions(this.boardSize);
      this.boardHistory = [this.board];
      this.lastMoveHistory = [null];
      this.shiftMapHistory = [emptyShiftMap(this.boardSize)];
    }

    const tc = this.timeControl;
    const hasRealTimeClock = tc.type === 'byoyomi' || tc.type === 'fischer';
    if (hasRealTimeClock && game.clockState) {
      this.clockState = {
        black: { ...game.clockState.black },
        white: { ...game.clockState.white },
        activeColor: null,
        turnStartedAt: null
      };
    } else if (hasRealTimeClock) {
      const mainMs = (tc.initial ?? 0) * 1000;
      const isByoyomi = tc.type === 'byoyomi';
      const periodMs = isByoyomi ? (tc.periodTime ?? 30) * 1000 : 0;
      const clockEntry = {
        mainMs,
        byoMs: isByoyomi ? periodMs : 0,
        byoPeriods: isByoyomi ? (tc.periods ?? 5) : 0,
        inByoYomi: isByoyomi && mainMs === 0,
        periodMs
      };
      const moves = game.moves ?? [];
      const activeColor = moves.length % 2 === 0 ? 'black' : 'white';
      this.clockState = {
        black: { ...clockEntry },
        white: { ...clockEntry },
        activeColor,
        turnStartedAt: null,
        periodMs
      };
    } else {
      this.clockState = null;
    }

    if (game.corrActiveColor) {
      this.corrState = {
        activeColor: game.corrActiveColor,
        turnDeadline: game.corrTurnDeadline
      };
    } else {
      this.corrState = null;
    }

    if (game.scoringActive) {
      this.status = 'scoring';
      this.deadStones = game.scoringDeadStones ?? [];
      this.blackApproved = game.scoringBlackApproved ?? false;
      this.whiteApproved = game.scoringWhiteApproved ?? false;
    } else if (game.status === 'finished') {
      this.status = 'gameover';
      this.winner = game.winner === 'black' ? 1 : game.winner === 'white' ? -1 : null;
      this.winnerResult = game.result ?? null;
    } else if (game.status === 'abandoned') {
      this.status = 'abandoned';
    } else if (game.status === 'aborted') {
      this.status = 'aborted';
    } else {
      this.status = game.status ?? 'waiting';
    }
  }

  applyMove(x, y, sign) {
    const vertex = [x, y];
    const prevSignMap = this.board.signMap;
    try {
      this.board = this.board.makeMove(sign, vertex, {
        preventSuicide: true,
        preventOverwrite: true,
        preventKo: true
      });
    } catch {
      return false;
    }
    this.shiftMap[y][x] = Math.ceil(Math.random() * 8);
    readjustShifts(this.shiftMap, x, y);
    for (let ry = 0; ry < this.boardSize; ry++) {
      for (let rx = 0; rx < this.boardSize; rx++) {
        if (prevSignMap[ry][rx] !== 0 && this.board.signMap[ry][rx] === 0) {
          this.shiftMap[ry][rx] = 0;
        }
      }
    }
    this.animatedVertex = vertex;
    this.lastMove = vertex;
    this.consecutivePasses = 0;
    this.currentSign = this.currentSign === 1 ? -1 : 1;
    this.boardHistory.push(this.board);
    this.lastMoveHistory.push(vertex);
    this.shiftMapHistory.push(this.shiftMap.map((row) => [...row]));
    if (this.isViewingHistory) this.viewPly = null;
    return true;
  }

  recordPass() {
    this.boardHistory.push(this.board);
    this.lastMoveHistory.push(null);
    this.shiftMapHistory.push(this.shiftMap.map((row) => [...row]));
  }

  tickClock() {
    if (!this.clockState) return;

    const now = Date.now();
    const movedColor = this.clockState.activeColor;
    const clock = this.clockState[movedColor];

    if (this.clockState.turnStartedAt) {
      const elapsed = now - this.clockState.turnStartedAt;

      if (clock.inByoYomi) {
        clock.byoMs = clock.periodMs ?? clock.byoMs;
      } else {
        clock.mainMs = Math.max(0, clock.mainMs - elapsed);
        if (clock.mainMs <= 0 && clock.byoPeriods > 0) {
          clock.inByoYomi = true;
        }
      }
    }

    this.clockState.activeColor = movedColor === 'black' ? 'white' : 'black';
    this.clockState.turnStartedAt = now;
  }

}
