import {
  createBoard,
  applySetup,
  applyMoveWithShifts,
  replayMovesWithHistory,
  parseSgfCoords,
  emptyShiftMap
} from '$lib/game/board';

export { replayMoves } from '$lib/game/board';

function fromOgsTimeControl(tc) {
  if (!tc) return { type: 'none' };
  if (tc.system === 'byoyomi') {
    return {
      type: 'byoyomi',
      initial: tc.main_time,
      periodTime: tc.period_time,
      periods: tc.periods
    };
  }
  if (tc.system === 'fischer') {
    return {
      type: 'fischer',
      initial: tc.initial_time,
      increment: tc.time_increment,
      max: tc.max_time
    };
  }
  if (tc.system === 'correspondence') {
    return { type: 'correspondence', days: tc.per_move ?? 3 };
  }
  return { type: 'none' };
}

export class GameState {
  boardSize = $state(19);
  board = $state(createBoard(19));
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
  gamedata = $state(null);

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

  constructor() {}

  initFromData(game, viewerColor) {
    this.boardSize = game.size ?? 19;
    this.timeControl = game.timeControl ?? { type: 'none' };
    this.shiftMap = emptyShiftMap(this.boardSize);

    if (viewerColor === 'black') this.mySign = 1;
    else if (viewerColor === 'white') this.mySign = -1;
    else this.mySign = null;

    const stones = game.handicapStones ?? [];
    const hasHandicap = stones.length > 0;
    const stoneSetup = stones.map(({ x, y }) => ({ x, y, sign: 1 }));
    const initialBoard = hasHandicap ? applySetup(createBoard(this.boardSize), stoneSetup) : null;

    if (game.moves && game.moves.length > 0) {
      const replay = replayMovesWithHistory(game.moves, this.boardSize, initialBoard);
      this.board = replay.board;
      this.shiftMap = replay.shiftMap;
      this.boardHistory = replay.boards;
      this.lastMoveHistory = replay.lastMoves;
      this.shiftMapHistory = replay.shiftMaps;
      this.consecutivePasses = 0;
      const whiteFirst = hasHandicap;
      this.currentSign = game.moves.length % 2 === 0 ? (whiteFirst ? -1 : 1) : whiteFirst ? 1 : -1;
      const lastMoveEntry = game.moves.at(-1);
      if (lastMoveEntry?.type === 'move') this.lastMove = [lastMoveEntry.x, lastMoveEntry.y];
    } else if (hasHandicap) {
      this.board = initialBoard;
      this.boardHistory = [initialBoard];
      this.lastMoveHistory = [null];
      this.shiftMapHistory = [emptyShiftMap(this.boardSize)];
      this.currentSign = -1;
    } else {
      this.board = createBoard(this.boardSize);
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
        activeColor: game.clockState.activeColor ?? null,
        turnStartedAt: game.clockState.turnStartedAt ?? null
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
      const activeColor = moves.length % 2 === (hasHandicap ? 1 : 0) ? 'black' : 'white';
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

    if (tc.type === 'correspondence') {
      this.corrState = { turnDeadline: game.corrTurnDeadline };
    } else {
      this.corrState = null;
    }

    if (game.scoringActive) {
      this.status = 'scoring';
      this.deadStones = game.deadStones ?? [];
      this.blackApproved = game.scoringBlackApproved ?? false;
      this.whiteApproved = game.scoringWhiteApproved ?? false;
    } else if (game.status === 'finished') {
      this.status = 'gameover';
      this.winner = game.winner === 'black' ? 1 : game.winner === 'white' ? -1 : null;
      this.deadStones = game.deadStones ?? [];
      this.winnerResult = game.result ?? null;
    } else if (game.status === 'abandoned') {
      this.status = 'abandoned';
    } else if (game.status === 'cancelled') {
      this.status = 'cancelled';
    } else {
      this.status = game.status ?? 'waiting';
    }
  }

  initFromGamedata(gamedata, viewerColor) {
    this.gamedata = gamedata;
    this.boardSize = gamedata.width ?? 19;
    this.timeControl = fromOgsTimeControl(gamedata.time_control);
    this.shiftMap = emptyShiftMap(this.boardSize);
    this.deadStones = [];
    this.blackApproved = false;
    this.whiteApproved = false;
    this.clockState = null;
    this.corrState = null;

    if (viewerColor === 'black') this.mySign = 1;
    else if (viewerColor === 'white') this.mySign = -1;
    else this.mySign = null;

    const blackSetupCoords = parseSgfCoords(gamedata.initial_state?.black ?? '');
    const whiteSetupCoords = parseSgfCoords(gamedata.initial_state?.white ?? '');
    const hasHandicap = blackSetupCoords.length > 0;
    const stoneSetup = [
      ...blackSetupCoords.map(([x, y]) => ({ x, y, sign: 1 })),
      ...whiteSetupCoords.map(([x, y]) => ({ x, y, sign: -1 }))
    ];
    const initialBoard =
      stoneSetup.length > 0 ? applySetup(createBoard(this.boardSize), stoneSetup) : null;

    const moves = (gamedata.moves ?? []).map(([x, y]) =>
      x < 0 ? { type: 'pass' } : { type: 'move', x, y }
    );

    if (moves.length > 0) {
      const replay = replayMovesWithHistory(moves, this.boardSize, initialBoard);
      this.board = replay.board;
      this.shiftMap = replay.shiftMap;
      this.boardHistory = replay.boards;
      this.lastMoveHistory = replay.lastMoves;
      this.shiftMapHistory = replay.shiftMaps;
      this.consecutivePasses = 0;
      const whiteFirst = hasHandicap;
      this.currentSign = moves.length % 2 === 0 ? (whiteFirst ? -1 : 1) : whiteFirst ? 1 : -1;
      const lastMove = moves.at(-1);
      if (lastMove?.type === 'move') this.lastMove = [lastMove.x, lastMove.y];
    } else if (stoneSetup.length > 0) {
      this.board = initialBoard;
      this.boardHistory = [initialBoard];
      this.lastMoveHistory = [null];
      this.shiftMapHistory = [emptyShiftMap(this.boardSize)];
      this.currentSign = -1;
    } else {
      this.board = createBoard(this.boardSize);
      this.boardHistory = [this.board];
      this.lastMoveHistory = [null];
      this.shiftMapHistory = [emptyShiftMap(this.boardSize)];
    }

    const outcome = gamedata.outcome ?? '';
    if (gamedata.phase === 'stone removal') {
      this.status = 'scoring';
    } else if (gamedata.phase === 'finished') {
      this.status = 'gameover';
      this.winnerResult = outcome || null;
      this.winner = outcome.startsWith('B') ? 1 : outcome.startsWith('W') ? -1 : null;
    } else {
      this.status = 'playing';
    }
  }

  applyMove(x, y, sign) {
    try {
      const result = applyMoveWithShifts(this.board, this.shiftMap, sign, x, y);
      this.board = result.board;
      this.shiftMap = result.shiftMap;
    } catch {
      return false;
    }
    const vertex = [x, y];
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
    const elapsed = this.clockState.turnStartedAt ? now - this.clockState.turnStartedAt : 0;

    if (clock.inByoYomi) {
      const periodStep = clock.periodMs > 0 ? clock.periodMs : clock.byoMs;
      let remaining = clock.byoMs - elapsed;
      let periodsLeft = clock.byoPeriods;
      while (remaining <= 0 && periodsLeft > 1) {
        periodsLeft--;
        remaining += periodStep;
      }
      clock.byoMs = clock.periodMs ?? clock.byoMs;
      clock.byoPeriods = periodsLeft;
    } else if (elapsed > 0) {
      clock.mainMs = Math.max(0, clock.mainMs - elapsed);
      if (clock.mainMs <= 0 && clock.byoPeriods > 0) {
        clock.inByoYomi = true;
      }
    }

    this.clockState.activeColor = movedColor === 'black' ? 'white' : 'black';
    this.clockState.turnStartedAt = now;
  }
}
