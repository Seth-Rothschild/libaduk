import { createBoard, placeStones, parseSgf, sgfNodeSetup, sgfNodeToMove } from '$lib/game/board';

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

  board = $state.raw(null);
  lastMove = $state(null);
  feedback = $state('init');
  rating = $state(1500);
  playedMoves = $state([]);
  hadFailure = $state(false);

  signMap = $derived(this.board?.signMap ?? null);
  colorToPlay = $derived(this.#playerSign === -1 ? 'White' : 'Black');
  moveRows = $derived(buildMoveRows(this.playedMoves));

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

    this.#setupMoves = setupStones
      .filter((s) => s.sign !== 0)
      .map((s) => ({
        label: vertexToLabel(s.x, s.y, parsed.size),
        color: s.sign === 1 ? 'black' : 'white'
      }));
    this.playedMoves = [...this.#setupMoves];
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

    const expected = this.#solutionMoves[this.#solutionIndex];
    if (!expected) return;

    const isCorrect = x === expected.x && y === expected.y;

    if (!isCorrect) {
      this.feedback = 'fail';
      this.hadFailure = true;
      return;
    }

    const label = vertexToLabel(x, y, this.#size);
    const color = expected.sign === 1 ? 'black' : 'white';

    this.#board = this.#board.makeMove(expected.sign, [x, y], {
      preventSuicide: true,
      preventOverwrite: true,
      preventKo: true
    });
    this.board = this.#board;
    this.lastMove = [x, y];
    this.playedMoves = [...this.playedMoves, { label, color }];
    this.#solutionIndex++;

    const isLastMove = this.#solutionIndex >= this.#solutionMoves.length;

    if (isLastMove) {
      this.feedback = 'after';
      return;
    }

    this.feedback = 'good';
    this.#playOpponentResponse();
  }

  viewSolution() {
    this.#board = this.#initialBoard;
    let board = this.#board;
    const moves = [...this.#setupMoves];
    let last = null;

    for (const move of this.#solutionMoves) {
      board = board.makeMove(move.sign, [move.x, move.y], {
        preventSuicide: true,
        preventOverwrite: true,
        preventKo: true
      });
      const label = vertexToLabel(move.x, move.y, this.#size);
      const color = move.sign === 1 ? 'black' : 'white';
      moves.push({ label, color });
      last = [move.x, move.y];
    }

    this.#board = board;
    this.board = board;
    this.lastMove = last;
    this.playedMoves = moves;
    this.#solutionIndex = this.#solutionMoves.length;
    this.feedback = 'after';
  }

  retry() {
    this.#solutionIndex = 0;
    this.#board = this.#initialBoard;
    this.board = this.#board;
    this.lastMove = null;
    this.playedMoves = [...this.#setupMoves];
    this.feedback = 'init';
  }

  #playOpponentResponse() {
    const response = this.#solutionMoves[this.#solutionIndex];
    if (!response) return;

    setTimeout(() => {
      const label = vertexToLabel(response.x, response.y, this.#size);
      const color = response.sign === 1 ? 'black' : 'white';

      this.#board = this.#board.makeMove(response.sign, [response.x, response.y], {
        preventSuicide: true,
        preventOverwrite: true,
        preventKo: true
      });
      this.board = this.#board;
      this.lastMove = [response.x, response.y];
      this.playedMoves = [...this.playedMoves, { label, color }];
      this.#solutionIndex++;
      this.feedback = 'init';
    }, 500);
  }
}
