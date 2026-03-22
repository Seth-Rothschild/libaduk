import GoBoardLib from '@sabaki/go-board';
import influence from '@sabaki/influence';
import { nameMove } from '@sabaki/boardmatcher';
import { computeScore, toggleDeadStones, buildScoreBoard, emptyMarkerMap } from '$lib/gameUtils.js';

export function makeAnalysisNode(board, lastMove, markerMap, signToPlay, parent, moveName = null, comment = '') {
  return { board, lastMove, markerMap, signToPlay, children: [], parent, moveName, comment };
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

  signMap = $derived(this.currentNode?.board.signMap ?? null);
  currentSign = $derived(this.currentNode?.signToPlay ?? 1);
  blackCaptures = $derived(this.currentNode?.board.getCaptures(1) ?? 0);
  whiteCaptures = $derived(this.currentNode?.board.getCaptures(-1) ?? 0);

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
    return influence.map(this.currentNode.board.signMap, { discrete: true });
  });

  estimatedScore = $derived(
    this.estimateAreaMap ? computeScore(this.estimateAreaMap, this.#size, this.#komi) : null
  );

  displayAreaMap = $derived(this.status === 'scoring' ? this.areaMap : this.estimateAreaMap);
  displayDeadStones = $derived(this.status === 'scoring' ? this.deadStones : null);

  canGoPrev = $derived(!!this.currentNode?.parent);
  canGoNext = $derived((this.currentNode?.children.length ?? 0) > 0);

  variationIndex = $derived(
    this.currentNode?.parent ? this.currentNode.parent.children.indexOf(this.currentNode) : -1
  );
  variationCount = $derived(this.currentNode?.parent?.children.length ?? 0);

  constructor(size, komi = 6.5) {
    this.#size = size;
    this.#komi = komi;
    this.#root = makeAnalysisNode(
      GoBoardLib.fromDimensions(size),
      null,
      emptyMarkerMap(size),
      1,
      null
    );
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

  loadMoves(moves) {
    const size = this.#size;
    const root = makeAnalysisNode(
      GoBoardLib.fromDimensions(size),
      null,
      emptyMarkerMap(size),
      1,
      null
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
        const child = makeAnalysisNode(newBoard, lastMove, emptyMarkerMap(size), nextSign, node, moveName);
        node.children.push(child);
        node = child;
      } else if (move.type === 'pass') {
        const child = makeAnalysisNode(node.board, null, emptyMarkerMap(size), nextSign, node, null);
        node.children.push(child);
        node = child;
      }
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
    this.#root = makeAnalysisNode(
      GoBoardLib.fromDimensions(size),
      null,
      emptyMarkerMap(size),
      1,
      null
    );
    this.currentNode = this.#root;
    this.#reset();
  }

  onVertexClick(x, y) {
    if (this.status === 'scoring') {
      this.#toggleDeadGroup(x, y);
      return;
    }
    if (this.tool === 'stone') {
      this.#makeMove(x, y);
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
    const scoreBoard = buildScoreBoard(this.currentNode.board, this.deadStones);
    this.areaMap = influence.areaMap(scoreBoard.signMap);
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
