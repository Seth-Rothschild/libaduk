export class MemorizeState {
  #analysis;
  #size;
  #line = $state([]);
  #index = $state(0);
  #hintMarkers = $state(null);
  #hintPool = $state(null);

  active = $state(false);
  flash = $state(null);
  hintText = $state(null);

  markerMap = $derived.by(() => {
    const hint = this.#hintMarkers;
    const base = this.#analysis.markerMap;
    if (!hint || !base) return base;
    return base.map((row, y) => row.map((cell, x) => hint[y][x] ?? cell));
  });

  index = $derived.by(() => this.#index);
  total = $derived.by(() => this.#line.length);
  done = $derived.by(() => this.#index >= this.#line.length);

  constructor(analysis, size) {
    this.#analysis = analysis;
    this.#size = size;
  }

  enter() {
    this.#line = this.#mainLine(this.#analysis.root);
    this.#index = 0;
    this.#analysis.currentNode = this.#analysis.root;
    this.#analysis.animatedVertex = null;
    this.#clearHints();
    this.active = true;
  }

  exit() {
    this.active = false;
  }

  click(x, y) {
    if (this.done) return;
    const expected = this.#line[this.#index];
    if (!expected.lastMove) {
      this.#analysis.currentNode = expected;
      this.#index++;
      return;
    }
    const [ex, ey] = expected.lastMove;
    if (x === ex && y === ey) {
      this.#analysis.currentNode = expected;
      this.#analysis.animatedVertex = [x, y];
      this.#index++;
      this.#clearHints();
      this.#setFlash('correct');
    } else {
      this.#setFlash('wrong');
    }
  }

  applyHint(type) {
    if (this.done) return;
    const expected = this.#line[this.#index];
    if (!expected.lastMove) return;
    const [ex, ey] = expected.lastMove;
    const board = this.#analysis.currentNode.board;

    if (type === 'quadrant') {
      this.hintText = 'Quadrant';
      this.#hintMarkers = this.#markerMap(this.#quadrantPoints(ex, ey, board));
      return;
    }

    if (!this.#hintPool) {
      const { points: large, xStart, yStart } = this.#grid(ex, ey, 4, board);
      const medium = this.#innerGrid(ex, ey, xStart, yStart, board);
      const small = this.#sample(medium, [ex, ey], 4);
      this.#hintPool = { large, medium, small };
    }

    const pools = { grid16: 'large', grid9: 'medium', grid4: 'small' };
    const labels = { grid16: '16 locations', grid9: '9 locations', grid4: '4 locations' };
    this.hintText = labels[type];
    this.#hintMarkers = this.#markerMap(this.#hintPool[pools[type]]);
  }

  #mainLine(root) {
    const line = [];
    let node = root.children[0];
    while (node) {
      line.push(node);
      node = node.children[0];
    }
    return line;
  }

  #markerMap(vertices) {
    const size = this.#size;
    const map = Array.from({ length: size }, () => new Array(size).fill(null));
    for (const [x, y] of vertices) map[y][x] = 'circle';
    return map;
  }

  #quadrantPoints(ex, ey, board) {
    const mid = Math.floor(this.#size / 2);
    const xMin = ex < mid ? 0 : mid;
    const xMax = ex < mid ? mid : this.#size;
    const yMin = ey < mid ? 0 : mid;
    const yMax = ey < mid ? mid : this.#size;
    return this.#emptyInRect(xMin, xMax, yMin, yMax, board);
  }

  #grid(ex, ey, n, board) {
    const size = this.#size;
    const xStart = Math.max(0, Math.min(size - n, ex - 1));
    const yStart = Math.max(0, Math.min(size - n, ey - 1));
    const points = this.#emptyInRect(xStart, xStart + n, yStart, yStart + n, board);
    return { points, xStart, yStart };
  }

  #innerGrid(ex, ey, xStart, yStart, board) {
    const validX = [xStart, xStart + 1].filter((xi) => xi <= ex && ex <= xi + 2);
    const validY = [yStart, yStart + 1].filter((yi) => yi <= ey && ey <= yi + 2);
    const xInner = validX[Math.floor(Math.random() * validX.length)];
    const yInner = validY[Math.floor(Math.random() * validY.length)];
    return this.#emptyInRect(xInner, xInner + 3, yInner, yInner + 3, board);
  }

  #emptyInRect(xMin, xMax, yMin, yMax, board) {
    const points = [];
    for (let y = yMin; y < yMax; y++) {
      for (let x = xMin; x < xMax; x++) {
        if (board.get([x, y]) === 0) points.push([x, y]);
      }
    }
    return points;
  }

  #sample(pool, required, count) {
    const others = pool
      .filter(([x, y]) => x !== required[0] || y !== required[1])
      .sort(() => Math.random() - 0.5)
      .slice(0, count - 1);
    return [...others, required].sort(() => Math.random() - 0.5);
  }

  #clearHints() {
    this.hintText = null;
    this.#hintMarkers = null;
    this.#hintPool = null;
  }

  #setFlash(type) {
    this.flash = type;
    setTimeout(() => (this.flash = null), 500);
  }
}
