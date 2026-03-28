import {
  createBoard,
  placeStones,
  parseSgf,
  sgfNodeSetup,
  sgfNodeToMove,
  applyMoveWithShifts
} from '$lib/game/board';
import { emptyShiftMap } from '$lib/game/board/helpers.js';

function extractSolutionMoves(sgfNode) {
  const moves = [];
  let node = sgfNode;
  while (node.children.length > 0) {
    const child = node.children[0];
    const move = sgfNodeToMove(child);
    if (move && move.type === 'move') {
      moves.push({ x: move.x, y: move.y, sign: move.sign });
    }
    node = child;
  }
  return moves;
}

function vertexToLabel(x, y, size) {
  const letters = 'ABCDEFGHJKLMNOPQRST';
  const col = letters[x] || '?';
  const row = size - y;
  return col + row;
}

function buildMoveRows(moves) {
  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      moveNum: Math.floor(i / 2) + 1,
      black: moves[i] || null,
      blackIndex: i,
      white: moves[i + 1] || null,
      whiteIndex: i + 1
    });
  }
  return rows;
}

export class PuzzleState {
  #board;
  #initialBoard;
  #solutionMoves;
  #solutionIndex = 0;
  #size;
  #playerSign;
  #setupMoves;
  #shiftMap;
  #initialShiftMap;
  #boardHistory = [];
  #shiftHistory = [];
  #lastMoveHistory = [];

  board = $state.raw(null);
  lastMove = $state(null);
  feedback = $state('init');
  rating = $state(1500);
  playedMoves = $state([]);
  hadFailure = $state(false);
  shiftMap = $state(null);
  animatedVertex = $state(null);
  viewIndex = $state(-1);

  signMap = $derived(this.board?.signMap ?? null);
  colorToPlay = $derived(this.#playerSign === -1 ? 'White' : 'Black');
  moveRows = $derived(buildMoveRows(this.playedMoves));
  canPrev = $derived(this.viewIndex > 0);
  canNext = $derived(this.viewIndex < this.#boardHistory.length - 1);

  constructor(sgfText) {
    const parsed = parseSgf(sgfText);
    this.#size = parsed.size;

    const setupStones = sgfNodeSetup(parsed.root, parsed.size);
    this.#initialBoard = placeStones(createBoard(parsed.size), setupStones);

    const plProp = parsed.root.props.PL;
    this.#playerSign = plProp && plProp[0] === 'W' ? -1 : 1;

    this.#solutionMoves = extractSolutionMoves(parsed.root);
    this.#board = this.#initialBoard;
    this.board = this.#board;

    const initialShifts = emptyShiftMap(parsed.size);
    for (const stone of setupStones) {
      if (stone.sign !== 0) {
        initialShifts[stone.y][stone.x] = Math.ceil(Math.random() * 8);
      }
    }
    this.#initialShiftMap = initialShifts;
    this.#shiftMap = initialShifts.map((row) => [...row]);
    this.shiftMap = this.#shiftMap;

    this.#setupMoves = setupStones
      .filter((s) => s.sign !== 0)
      .map((s) => ({
        label: vertexToLabel(s.x, s.y, parsed.size),
        color: s.sign === 1 ? 'black' : 'white'
      }));
    this.playedMoves = [...this.#setupMoves];

    this.#boardHistory = [this.#board];
    this.#shiftHistory = [this.#shiftMap.map((row) => [...row])];
    this.#lastMoveHistory = [null];
    this.viewIndex = 0;
  }

  get size() {
    return this.#size;
  }

  get playerSign() {
    return this.#playerSign;
  }

  get currentSign() {
    if (this.#solutionIndex % 2 === 0) return this.#playerSign;
    return this.#playerSign === 1 ? -1 : 1;
  }

  onVertexClick(x, y) {
    if (this.feedback === 'after') return;
    if (this.viewIndex < this.#boardHistory.length - 1) {
      this.goLast();
    }

    const expected = this.#solutionMoves[this.#solutionIndex];
    if (!expected) return;

    const isCorrect = x === expected.x && y === expected.y;

    if (!isCorrect) {
      this.#showWrongMove(x, y);
      return;
    }

    const label = vertexToLabel(x, y, this.#size);
    const color = expected.sign === 1 ? 'black' : 'white';

    const result = applyMoveWithShifts(this.#board, this.#shiftMap, expected.sign, x, y);
    this.#board = result.board;
    this.#shiftMap = result.shiftMap;
    this.board = this.#board;
    this.shiftMap = this.#shiftMap;
    this.animatedVertex = [x, y];
    this.lastMove = [x, y];
    this.playedMoves = [...this.playedMoves, { label, color }];
    this.#solutionIndex++;
    this.#pushHistory(this.#board, this.#shiftMap, [x, y]);

    const isLastMove = this.#solutionIndex >= this.#solutionMoves.length;

    if (isLastMove) {
      this.feedback = 'after';
      return;
    }

    this.feedback = 'good';
    this.#playOpponentResponse();
  }

  #showWrongMove(x, y) {
    const sign = this.currentSign;
    const savedBoard = this.#board;
    const savedShiftMap = this.#shiftMap;
    const savedLastMove = this.lastMove;

    try {
      const result = applyMoveWithShifts(this.#board, this.#shiftMap, sign, x, y);
      this.#board = result.board;
      this.#shiftMap = result.shiftMap;
      this.board = this.#board;
      this.shiftMap = this.#shiftMap;
      this.animatedVertex = [x, y];
      this.lastMove = [x, y];
    } catch {
      this.feedback = 'fail';
      this.hadFailure = true;
      return;
    }

    setTimeout(() => {
      this.#board = savedBoard;
      this.#shiftMap = savedShiftMap;
      this.board = savedBoard;
      this.shiftMap = savedShiftMap;
      this.lastMove = savedLastMove;
      this.animatedVertex = null;
      this.feedback = 'fail';
      this.hadFailure = true;
    }, 400);
  }

  viewSolution() {
    this.#board = this.#initialBoard;
    let board = this.#board;
    let shifts = this.#initialShiftMap.map((row) => [...row]);
    const moves = [...this.#setupMoves];
    let last = null;

    this.#boardHistory = [this.#initialBoard];
    this.#shiftHistory = [this.#initialShiftMap.map((row) => [...row])];
    this.#lastMoveHistory = [null];

    for (const move of this.#solutionMoves) {
      const result = applyMoveWithShifts(board, shifts, move.sign, move.x, move.y);
      board = result.board;
      shifts = result.shiftMap;
      const label = vertexToLabel(move.x, move.y, this.#size);
      const color = move.sign === 1 ? 'black' : 'white';
      moves.push({ label, color });
      last = [move.x, move.y];
      this.#boardHistory.push(board);
      this.#shiftHistory.push(shifts.map((row) => [...row]));
      this.#lastMoveHistory.push([move.x, move.y]);
    }

    this.#board = board;
    this.#shiftMap = shifts;
    this.board = board;
    this.shiftMap = shifts;
    this.lastMove = last;
    this.animatedVertex = null;
    this.playedMoves = moves;
    this.#solutionIndex = this.#solutionMoves.length;
    this.viewIndex = this.#boardHistory.length - 1;
    this.feedback = 'after';
  }

  retry() {
    this.#solutionIndex = 0;
    this.#board = this.#initialBoard;
    this.#shiftMap = this.#initialShiftMap.map((row) => [...row]);
    this.board = this.#board;
    this.shiftMap = this.#shiftMap;
    this.lastMove = null;
    this.animatedVertex = null;
    this.playedMoves = [...this.#setupMoves];
    this.feedback = 'init';
    this.#boardHistory = [this.#initialBoard];
    this.#shiftHistory = [this.#shiftMap.map((row) => [...row])];
    this.#lastMoveHistory = [null];
    this.viewIndex = 0;
  }

  #playOpponentResponse() {
    const response = this.#solutionMoves[this.#solutionIndex];
    if (!response) return;

    setTimeout(() => {
      const label = vertexToLabel(response.x, response.y, this.#size);
      const color = response.sign === 1 ? 'black' : 'white';

      const result = applyMoveWithShifts(
        this.#board,
        this.#shiftMap,
        response.sign,
        response.x,
        response.y
      );
      this.#board = result.board;
      this.#shiftMap = result.shiftMap;
      this.board = this.#board;
      this.shiftMap = this.#shiftMap;
      this.animatedVertex = [response.x, response.y];
      this.lastMove = [response.x, response.y];
      this.playedMoves = [...this.playedMoves, { label, color }];
      this.#solutionIndex++;
      this.#pushHistory(this.#board, this.#shiftMap, [response.x, response.y]);
      this.feedback = 'init';
    }, 500);
  }

  #pushHistory(board, shiftMap, lastMove) {
    this.#boardHistory.push(board);
    this.#shiftHistory.push(shiftMap.map((row) => [...row]));
    this.#lastMoveHistory.push(lastMove);
    this.viewIndex = this.#boardHistory.length - 1;
  }

  goFirst() {
    this.viewIndex = 0;
    this.#showHistoryAt(0);
  }

  goPrev() {
    if (!this.canPrev) return;
    this.viewIndex--;
    this.#showHistoryAt(this.viewIndex);
  }

  goNext() {
    if (!this.canNext) return;
    this.viewIndex++;
    this.#showHistoryAt(this.viewIndex);
  }

  goLast() {
    this.viewIndex = this.#boardHistory.length - 1;
    this.#showHistoryAt(this.viewIndex);
  }

  #showHistoryAt(index) {
    this.board = this.#boardHistory[index];
    this.shiftMap = this.#shiftHistory[index];
    this.lastMove = this.#lastMoveHistory[index];
    this.animatedVertex = null;
  }

  getHint() {
    const expected = this.#solutionMoves[this.#solutionIndex];
    if (!expected) return;
    this.goLast();
    this.onVertexClick(expected.x, expected.y);
  }
}
