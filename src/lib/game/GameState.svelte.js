import {
  createBoard,
  applySetup,
  applyMoveWithShifts,
  replayMovesWithHistory,
  parseSgfCoords,
  emptyShiftMap
} from '$lib/game/board';

export { replayMoves } from '$lib/game/board';

export function fromOgsTimeControl(tc) {
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
  if (tc.system === 'simple' && tc.speed === 'correspondence') {
    return { type: 'correspondence', days: Math.round(tc.per_move / 86400) };
  }
  return { type: 'none' };
}

export function resultFromGamedata(gamedata) {
  const outcome = gamedata.outcome ?? '';
  if (!outcome || outcome === 'Cancellation') return null;
  const winnerSign = winnerSignFromGamedata(gamedata);
  if (winnerSign === null) return null;
  const prefix = winnerSign === 1 ? 'B' : 'W';
  if (outcome === 'Resignation') return `${prefix}+R`;
  if (outcome === 'Timeout') return `${prefix}+T`;
  return `${prefix}+${String(outcome).replace(' points', '')}`;
}

function winnerSignFromGamedata(gamedata) {
  const winner = gamedata.winner;
  if (winner === null || winner === undefined) return null;
  if (winner === 'black') return 1;
  if (winner === 'white') return -1;
  if (winner === gamedata.players?.black?.id) return 1;
  if (winner === gamedata.players?.white?.id) return -1;
  return null;
}

function playerClockData(t) {
  if (!t) return null;
  const mainMs = t.thinking_time * 1000;
  const periodMs = (t.period_time ?? 0) * 1000;
  return {
    mainMs,
    byoMs: periodMs,
    byoPeriods: t.periods ?? 0,
    periodMs,
    inByoYomi: mainMs <= 0 && (t.periods ?? 0) > 0
  };
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
  /** @type {{ type: string, initial?: number, periodTime?: number, periods?: number, increment?: number, max?: number, days?: number }} */
  timeControl = $state({ type: 'none' });
  clockState = $state(null);
  corrState = $state(null);
  deadStones = $state([]);
  removedString = $state('');
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

  initFromGamedata(gamedata, viewerColor) {
    this.gamedata = gamedata;
    this.boardSize = gamedata.width ?? 19;
    this.timeControl = fromOgsTimeControl(gamedata.time_control);
    this.shiftMap = emptyShiftMap(this.boardSize);

    if (viewerColor === 'black') this.mySign = 1;
    else if (viewerColor === 'white') this.mySign = -1;
    else this.mySign = null;

    const blackCoords = parseSgfCoords(gamedata.initial_state?.black ?? '');
    const whiteCoords = parseSgfCoords(gamedata.initial_state?.white ?? '');
    const hasHandicap = blackCoords.length > 0 || whiteCoords.length > 0;
    const stoneSetup = [
      ...blackCoords.map(([x, y]) => ({ x, y, sign: 1 })),
      ...whiteCoords.map(([x, y]) => ({ x, y, sign: -1 }))
    ];
    const initialBoard = hasHandicap ? applySetup(createBoard(this.boardSize), stoneSetup) : null;
    const whiteFirst = gamedata.initial_player === 'white';

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
      this.currentSign = moves.length % 2 === 0 ? (whiteFirst ? -1 : 1) : whiteFirst ? 1 : -1;
      const lastMove = moves.at(-1);
      this.lastMove = lastMove?.type === 'move' ? [lastMove.x, lastMove.y] : null;
    } else {
      this.board = initialBoard ?? createBoard(this.boardSize);
      this.boardHistory = [this.board];
      this.lastMoveHistory = [null];
      this.shiftMapHistory = [emptyShiftMap(this.boardSize)];
      this.currentSign = whiteFirst ? -1 : 1;
      this.lastMove = null;
    }

    const lastTwo = (gamedata.moves ?? []).slice(-2);
    const bothPasses = lastTwo.length === 2 && lastTwo.every(([x]) => x < 0);
    this.consecutivePasses = bothPasses ? 2 : lastTwo.at(-1)?.[0] < 0 ? 1 : 0;

    this.removedString = gamedata.removed ?? '';
    this.deadStones = parseSgfCoords(this.removedString);
    this.blackApproved = gamedata.players?.black?.accepted_stones != null;
    this.whiteApproved = gamedata.players?.white?.accepted_stones != null;
    this.winner = winnerSignFromGamedata(gamedata);
    this.winnerResult = resultFromGamedata(gamedata);

    this.applyClock(gamedata.clock);
    this.status = this.#deriveStatus(gamedata);
  }

  #deriveStatus(gamedata) {
    if (gamedata.phase === 'stone removal') return 'scoring';
    if (gamedata.phase === 'finished') {
      return gamedata.outcome === 'Cancellation' ? 'cancelled' : 'gameover';
    }
    const players = gamedata.players ?? {};
    const bothSeated = !!players.black?.username && !!players.white?.username;
    return bothSeated ? 'playing' : 'waiting';
  }

  applyClock(clock) {
    if (!clock) {
      this.clockState = null;
      this.corrState = null;
      return;
    }
    if (typeof clock.black_time === 'number') {
      this.corrState = { turnDeadline: clock.expiration };
      this.clockState = null;
      return;
    }
    const black = playerClockData(clock.black_time);
    const white = playerClockData(clock.white_time);
    if (!black || !white) return;
    const activeColor = clock.current_player === clock.black_player_id ? 'black' : 'white';
    const serverOffset = Date.now() - (clock.now ?? Date.now());
    const turnStartedAt = clock.last_move ? serverOffset + clock.last_move : null;
    this.clockState = { black, white, activeColor, turnStartedAt };
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
    this.consecutivePasses++;
    this.lastMove = null;
    this.animatedVertex = null;
    this.currentSign = this.currentSign === 1 ? -1 : 1;
    this.boardHistory.push(this.board);
    this.lastMoveHistory.push(null);
    this.shiftMapHistory.push(this.shiftMap.map((row) => [...row]));
  }
}
