import {
  createBoard,
  applySetup,
  computeScore,
  toggleDeadStones,
  buildScoreBoard,
  emptyMarkerMap
} from '$lib/game/board';
import influence from '@sabaki/influence';
import { nameMove } from '@sabaki/boardmatcher';

export function makeAnalysisNode(
  board,
  lastMove,
  markerMap,
  signToPlay,
  parent,
  moveName = null,
  comment = '',
  setup = []
) {
  return { board, lastMove, markerMap, signToPlay, children: [], parent, moveName, comment, setup };
}

export function getAnalysisMoveName(parentBoard, sign, vertex) {
  if (!vertex) return null;
  try {
    return nameMove(parentBoard.signMap, sign, vertex);
  } catch {
    return null;
  }
}

function nextLabel(markerMap, size) {
  const used = new Set();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const m = markerMap[y][x];
      if (m && m.type === 'label') used.add(m.label);
    }
  }
  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(65 + i);
    if (!used.has(ch)) return ch;
  }
  return 'A';
}

function nextNumber(markerMap, size) {
  let max = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const m = markerMap[y][x];
      if (m && m.type === 'number') {
        const n = parseInt(m.label);
        if (n > max) max = n;
      }
    }
  }
  return String(max + 1);
}

function hasMarkers(markerMap) {
  for (const row of markerMap) {
    for (const cell of row) {
      if (cell !== null) return true;
    }
  }
  return false;
}

function serializeNode(node) {
  const result = {};
  if (node.lastMove) {
    result.move = node.lastMove;
  } else if (node.parent) {
    result.pass = true;
  }
  if (node.setup && node.setup.length > 0) result.setup = node.setup;
  if (node.comment) result.comment = node.comment;
  if (hasMarkers(node.markerMap)) result.markers = node.markerMap;
  return result;
}

function deserializeNodeNested(data, parentBoard, signToPlay, parent, size) {
  let board = parentBoard;
  let lastMove = null;

  if (data.move) {
    lastMove = data.move;
    try {
      board = parentBoard.makeMove(signToPlay, lastMove, {
        preventSuicide: true,
        preventOverwrite: true,
        preventKo: true
      });
    } catch {
      return null;
    }
  }

  const setup = data.setup ?? [];
  board = applySetup(board, setup);

  const turnAdvanced = !!lastMove || parent !== null;
  const nextSign = turnAdvanced ? (signToPlay === 1 ? -1 : 1) : signToPlay;
  const markers = data.markers ?? emptyMarkerMap(size);
  const moveName = lastMove ? getAnalysisMoveName(parentBoard, signToPlay, lastMove) : null;
  const comment = data.comment ?? '';
  const node = makeAnalysisNode(
    board,
    lastMove,
    markers,
    nextSign,
    parent,
    moveName,
    comment,
    setup
  );

  if (data.children) {
    for (const childData of data.children) {
      const childNode = deserializeNodeNested(childData, board, nextSign, node, size);
      if (childNode) node.children.push(childNode);
    }
  }

  return node;
}

function deserializeFlat(entries, size) {
  const emptyBoard = createBoard(size);
  const rootData = entries[0];
  const rootHasHandicap = (rootData.setup ?? []).some((s) => s.sign === 1);
  const initialSign = rootHasHandicap ? -1 : 1;

  const nodes = [];
  const boards = [];
  const signs = [];

  for (const entry of entries) {
    const parentIndex = entry.parent ?? null;
    const parentNode = parentIndex !== null ? nodes[parentIndex] : null;
    const parentBoard = parentIndex !== null ? boards[parentIndex] : emptyBoard;
    const signToPlay = parentIndex !== null ? signs[parentIndex] : initialSign;

    let board = parentBoard;
    let lastMove = null;

    if (entry.move) {
      lastMove = entry.move;
      try {
        board = parentBoard.makeMove(signToPlay, lastMove, {
          preventSuicide: true,
          preventOverwrite: true,
          preventKo: true
        });
      } catch {
        nodes.push(null);
        boards.push(parentBoard);
        signs.push(signToPlay);
        continue;
      }
    }

    const setup = entry.setup ?? [];
    board = applySetup(board, setup);

    const turnAdvanced = !!lastMove || parentNode !== null;
    const nextSign = turnAdvanced ? (signToPlay === 1 ? -1 : 1) : signToPlay;
    const markers = entry.markers ?? emptyMarkerMap(size);
    const moveName = lastMove ? getAnalysisMoveName(parentBoard, signToPlay, lastMove) : null;
    const comment = entry.comment ?? '';
    const node = makeAnalysisNode(
      board,
      lastMove,
      markers,
      nextSign,
      parentNode,
      moveName,
      comment,
      setup
    );

    if (parentNode) parentNode.children.push(node);
    nodes.push(node);
    boards.push(board);
    signs.push(nextSign);
  }

  return nodes[0];
}

export function getNodePath(node) {
  const path = [];
  let current = node;
  while (current.parent) {
    const idx = current.parent.children.indexOf(current);
    path.unshift(idx);
    current = current.parent;
  }
  return path;
}

export function followNodePath(root, path) {
  let node = root;
  for (const idx of path) {
    if (!node.children[idx]) return node;
    node = node.children[idx];
  }
  return node;
}

export function serializeTree(root) {
  const nodes = [];
  const queue = [{ node: root, parentIndex: null }];
  while (queue.length > 0) {
    const { node, parentIndex } = queue.shift();
    const index = nodes.length;
    const entry = serializeNode(node);
    if (parentIndex !== null) entry.parent = parentIndex;
    nodes.push(entry);
    for (const child of node.children) {
      queue.push({ node: child, parentIndex: index });
    }
  }
  return nodes;
}

export function deserializeTree(data, size) {
  if (Array.isArray(data)) {
    return deserializeFlat(data, size);
  }
  const emptyBoard = createBoard(size);
  const rootHasHandicap = (data.setup ?? []).some((s) => s.sign === 1);
  const initialSign = rootHasHandicap ? -1 : 1;
  return deserializeNodeNested(data, emptyBoard, initialSign, null, size);
}

export class AnalysisState {
  #size;
  #komi;
  #root;
  #version = $state(0);

  currentNode = $state.raw(null);
  tool = $state('stone');
  status = $state('playing');
  deadStones = $state([]);
  areaMap = $state(null);
  showEstimate = $state(false);
  animatedVertex = $state(null);

  signMap = $derived.by(() => {
    this.#version;
    return this.currentNode?.board.signMap ?? null;
  });
  currentSign = $derived(this.currentNode?.signToPlay ?? 1);
  blackCaptures = $derived.by(() => {
    this.#version;
    return this.currentNode?.board.getCaptures(1) ?? 0;
  });
  whiteCaptures = $derived.by(() => {
    this.#version;
    return this.currentNode?.board.getCaptures(-1) ?? 0;
  });
  hoverSign = $derived.by(() => {
    if (this.tool === 'stone-black') return 1;
    if (this.tool === 'stone-white') return -1;
    return this.currentSign;
  });

  markerMap = $derived.by(() => {
    this.#version;
    return this.currentNode?.markerMap ?? null;
  });

  currentComment = $derived.by(() => {
    this.#version;
    return this.currentNode?.comment ?? '';
  });

  childrenMap = $derived.by(() => {
    this.#version;
    if (!this.currentNode || this.currentNode.children.length === 0) return null;
    const size = this.#size;
    const sign = this.currentNode.signToPlay;
    const map = Array.from({ length: size }, () => new Array(size).fill(0));
    for (const child of this.currentNode.children) {
      if (!child.lastMove) continue;
      const [cx, cy] = child.lastMove;
      map[cy][cx] = sign;
    }
    return map;
  });

  movePath = $derived.by(() => {
    this.#version;
    const path = [];
    let node = this.currentNode;
    while (node?.parent) {
      path.unshift(node);
      node = node.parent;
    }
    return path;
  });

  moveRows = $derived.by(() => {
    const rows = [];
    for (let i = 0; i < this.movePath.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const black = this.movePath[i];
      const white = i + 1 < this.movePath.length ? this.movePath[i + 1] : null;
      rows.push({ moveNum, black, white });
    }
    return rows;
  });

  score = $derived(this.areaMap ? computeScore(this.areaMap, this.#size, this.#komi) : null);

  estimateAreaMap = $derived.by(() => {
    if (!this.showEstimate || this.status === 'scoring' || !this.currentNode) return null;
    const board =
      this.deadStones.length > 0
        ? buildScoreBoard(this.currentNode.board, this.deadStones)
        : this.currentNode.board;
    return influence.map(board.signMap, { discrete: true });
  });

  estimatedScore = $derived(
    this.estimateAreaMap ? computeScore(this.estimateAreaMap, this.#size, this.#komi) : null
  );

  displayAreaMap = $derived(this.status === 'scoring' ? this.areaMap : this.estimateAreaMap);
  displayDeadStones = $derived(
    this.status === 'scoring' || this.showEstimate ? this.deadStones : null
  );

  canGoPrev = $derived(!!this.currentNode?.parent);
  canGoNext = $derived((this.currentNode?.children.length ?? 0) > 0);

  variationIndex = $derived(
    this.currentNode?.parent ? this.currentNode.parent.children.indexOf(this.currentNode) : -1
  );
  variationCount = $derived(this.currentNode?.parent?.children.length ?? 0);

  constructor(size, komi = 6.5) {
    this.#size = size;
    this.#komi = komi;
    this.#root = makeAnalysisNode(createBoard(size), null, emptyMarkerMap(size), 1, null);
    this.currentNode = this.#root;
  }

  get size() {
    return this.#size;
  }

  get version() {
    return this.#version;
  }

  get root() {
    return this.#root;
  }

  loadMoves(moves, handicapStones = []) {
    const size = this.#size;
    const hasHandicap = handicapStones.length >= 2;
    const stoneSetup = handicapStones.map(({ x, y }) => ({ x, y, sign: 1 }));
    const initialBoard = hasHandicap
      ? applySetup(createBoard(size), stoneSetup)
      : createBoard(size);
    const initialSign = hasHandicap ? -1 : 1;
    const root = makeAnalysisNode(
      initialBoard,
      null,
      emptyMarkerMap(size),
      initialSign,
      null,
      null,
      '',
      stoneSetup
    );
    let node = root;
    for (const move of moves) {
      const nextSign = node.signToPlay === 1 ? -1 : 1;
      if (move.type === 'move') {
        let newBoard;
        try {
          newBoard = node.board.makeMove(node.signToPlay, [move.x, move.y], {
            preventSuicide: true,
            preventOverwrite: true,
            preventKo: true
          });
        } catch {
          continue;
        }
        const lastMove = [move.x, move.y];
        const moveName = getAnalysisMoveName(node.board, node.signToPlay, lastMove);
        const child = makeAnalysisNode(
          newBoard,
          lastMove,
          emptyMarkerMap(size),
          nextSign,
          node,
          moveName
        );
        node.children.push(child);
        node = child;
      } else if (move.type === 'pass') {
        const child = makeAnalysisNode(
          node.board,
          null,
          emptyMarkerMap(size),
          nextSign,
          node,
          null
        );
        node.children.push(child);
        node = child;
      }
    }
    this.#root = root;
    this.currentNode = node;
    this.#reset();
  }

  loadTree(data, path = null) {
    const root = deserializeTree(data, this.#size);
    if (!root) return;
    let node = root;
    if (path) {
      node = followNodePath(root, path);
    } else {
      while (node.children.length > 0) node = node.children[0];
    }
    this.#root = root;
    this.currentNode = node;
    this.#reset();
  }

  setRoot(root, currentNode = null) {
    this.#root = root;
    this.currentNode = currentNode ?? root;
    this.#reset();
  }

  clear() {
    const size = this.#size;
    this.#root = makeAnalysisNode(createBoard(size), null, emptyMarkerMap(size), 1, null);
    this.currentNode = this.#root;
    this.#reset();
  }

  onVertexClick(x, y) {
    if (this.status === 'scoring' || this.showEstimate) {
      this.#toggleDeadGroup(x, y);
      return;
    }
    if (this.tool === 'stone') {
      this.#makeMove(x, y);
    } else if (this.tool === 'stone-black') {
      this.#placeSetupStone(x, y, 1);
    } else if (this.tool === 'stone-white') {
      this.#placeSetupStone(x, y, -1);
    } else {
      this.#toggleMarker(x, y);
    }
  }

  navigate(action) {
    if (!this.currentNode) return;
    if (action === 'prev' && this.currentNode.parent) {
      this.currentNode = this.currentNode.parent;
      this.animatedVertex = null;
    } else if (action === 'next' && this.currentNode.children.length > 0) {
      this.currentNode = this.currentNode.children[0];
      this.animatedVertex = null;
    } else if (action === 'first') {
      let node = this.currentNode;
      while (node.parent) node = node.parent;
      this.currentNode = node;
      this.animatedVertex = null;
    } else if (action === 'last') {
      let node = this.currentNode;
      while (node.children.length > 0) node = node.children[0];
      this.currentNode = node;
      this.animatedVertex = null;
    } else if (action === 'prev-variation' && this.currentNode.parent) {
      const siblings = this.currentNode.parent.children;
      const idx = siblings.indexOf(this.currentNode);
      if (idx > 0) this.currentNode = siblings[idx - 1];
    } else if (action === 'next-variation' && this.currentNode.parent) {
      const siblings = this.currentNode.parent.children;
      const idx = siblings.indexOf(this.currentNode);
      if (idx < siblings.length - 1) this.currentNode = siblings[idx + 1];
    }
  }

  startScoring() {
    this.status = 'scoring';
    this.deadStones = [];
    this.areaMap = influence.areaMap(this.currentNode.board.signMap);
  }

  stopScoring() {
    this.status = 'playing';
    this.deadStones = [];
    this.areaMap = null;
  }

  setComment(text) {
    if (!this.currentNode) return;
    this.currentNode.comment = text;
    this.#version++;
  }

  #makeMove(x, y) {
    const vertex = [x, y];
    const sign = this.currentNode.signToPlay;
    const analysis = this.currentNode.board.analyzeMove(sign, vertex);
    if (analysis.overwrite || analysis.suicide || analysis.ko) return;

    const existing = this.currentNode.children.find(
      (c) => c.lastMove && c.lastMove[0] === x && c.lastMove[1] === y
    );
    if (existing) {
      this.currentNode = existing;
      return;
    }

    let newBoard;
    try {
      newBoard = this.currentNode.board.makeMove(sign, vertex, {
        preventSuicide: true,
        preventOverwrite: true,
        preventKo: true
      });
    } catch {
      return;
    }

    const nextSign = sign === 1 ? -1 : 1;
    const moveName = getAnalysisMoveName(this.currentNode.board, sign, vertex);
    const newNode = makeAnalysisNode(
      newBoard,
      vertex,
      emptyMarkerMap(this.#size),
      nextSign,
      this.currentNode,
      moveName
    );
    this.currentNode.children.push(newNode);
    this.currentNode = newNode;
    this.animatedVertex = vertex;
    this.#version++;
  }

  #placeSetupStone(x, y, sign) {
    const node = this.currentNode;
    const existingSign = node.board.get([x, y]);
    const newSign = existingSign === sign ? 0 : sign;

    node.board = applySetup(node.board, [{ x, y, sign: newSign }]);

    const setupWithout = node.setup.filter((s) => s.x !== x || s.y !== y);
    node.setup = [...setupWithout, { x, y, sign: newSign }];

    this.#version++;
  }

  #toggleMarker(x, y) {
    const current = this.currentNode.markerMap[y][x];
    const newMap = this.currentNode.markerMap.map((row) => [...row]);

    if (this.tool === 'label') {
      if (current && current.type === 'label') {
        newMap[y][x] = null;
      } else {
        const letter = nextLabel(this.currentNode.markerMap, this.#size);
        newMap[y][x] = { type: 'label', label: letter };
      }
    } else if (this.tool === 'number') {
      if (current && current.type === 'number') {
        newMap[y][x] = null;
      } else {
        const num = nextNumber(this.currentNode.markerMap, this.#size);
        newMap[y][x] = { type: 'number', label: num };
      }
    } else {
      newMap[y][x] = current === this.tool ? null : this.tool;
    }

    this.currentNode.markerMap = newMap;
    this.#version++;
  }

  #toggleDeadGroup(x, y) {
    this.deadStones = toggleDeadStones(this.currentNode.board, this.deadStones, x, y);
    if (this.status === 'scoring') {
      const scoreBoard = buildScoreBoard(this.currentNode.board, this.deadStones);
      this.areaMap = influence.areaMap(scoreBoard.signMap);
    }
  }

  #reset() {
    this.animatedVertex = null;
    this.status = 'playing';
    this.deadStones = [];
    this.areaMap = null;
    this.showEstimate = false;
    this.#version++;
  }
}
