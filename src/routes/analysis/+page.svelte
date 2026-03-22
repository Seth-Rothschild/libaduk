<script>
  import { onMount, onDestroy } from 'svelte';
  import GoBoardLib from '@sabaki/go-board';
  import influence from '@sabaki/influence';
  import { nameMove } from '@sabaki/boardmatcher';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import PlayerStrip from '$lib/game/PlayerStrip.svelte';
  import NavigationButtons from '$lib/game/NavigationButtons.svelte';
  import { page } from '$app/state';
  import { boardState } from '$lib/boardState.svelte.js';
  import {
    colorName,
    computeScore,
    scoreVerdictShort,
    toggleDeadStones,
    buildScoreBoard,
    emptyMarkerMap,
    computeVertexSize,
    clampBoardSize,
    formatVertex
  } from '$lib/gameUtils.js';
  import { exportSgf, parseSgf, sgfNodeToMove, sgfNodeMarkers } from '$lib/sgf.js';

  let { data } = $props();

  const gameData = data.game;
  const defaultSize = gameData ? gameData.size : Number(page.url.searchParams.get('size') ?? 19);
  const SIZE = clampBoardSize(defaultSize);
  const KOMI = 6.5;

  function makeNode(board, lastMove, markerMap, signToPlay, parent, moveName = null) {
    return { board, lastMove, markerMap, signToPlay, children: [], parent, moveName };
  }

  function getMoveName(parentBoard, sign, vertex) {
    if (!vertex) return 'Pass';
    try {
      return nameMove(parentBoard.signMap, sign, vertex);
    } catch {
      return null;
    }
  }

  function buildTreeFromMoves(moves, size) {
    const treeRoot = makeNode(GoBoardLib.fromDimensions(size), null, emptyMarkerMap(size), 1, null);
    let node = treeRoot;
    for (const move of moves) {
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
        const nextSign = node.signToPlay === 1 ? -1 : 1;
        const movName = getMoveName(node.board, node.signToPlay, [move.x, move.y]);
        const child = makeNode(
          newBoard,
          [move.x, move.y],
          emptyMarkerMap(size),
          nextSign,
          node,
          movName
        );
        node.children.push(child);
        node = child;
      }
    }
    return { root: treeRoot, lastNode: node };
  }

  const initialTree =
    gameData && gameData.moves.length > 0 ? buildTreeFromMoves(gameData.moves, SIZE) : null;

  let root = initialTree
    ? initialTree.root
    : makeNode(GoBoardLib.fromDimensions(SIZE), null, emptyMarkerMap(SIZE), 1, null);
  let currentNode = $state.raw(initialTree ? initialTree.lastNode : root);
  let version = $state(0);
  let animatedVertex = $state(null);
  let boardContainerWidth = $state(0);
  let boardContainerHeight = $state(0);

  let tool = $state('stone');
  let blackName = $state('Black');
  let whiteName = $state('White');

  const currentSign = $derived(currentNode.signToPlay);
  const vertexSize = $derived(computeVertexSize(boardContainerWidth, boardContainerHeight, SIZE));

  const signMap = $derived(currentNode.board.signMap);
  const blackCaptures = $derived(currentNode.board.getCaptures(1));
  const whiteCaptures = $derived(currentNode.board.getCaptures(-1));
  const markerMap = $derived.by(() => {
    version;
    return currentNode.markerMap;
  });

  const childrenMap = $derived.by(() => {
    version;
    if (currentNode.children.length === 0) return null;
    const map = Array.from({ length: SIZE }, () => new Array(SIZE).fill(0));
    for (const child of currentNode.children) {
      if (!child.lastMove) continue;
      const [cx, cy] = child.lastMove;
      map[cy][cx] = currentSign;
    }
    return map;
  });

  let status = $state('playing');
  let deadStones = $state([]);
  let areaMap = $state(null);
  let showEstimate = $state(false);

  const score = $derived(areaMap ? computeScore(areaMap, SIZE, KOMI) : null);

  const estimateAreaMap = $derived.by(() => {
    if (!showEstimate || status === 'scoring') return null;
    return influence.map(currentNode.board.signMap, { discrete: true });
  });

  const estimatedScore = $derived(
    estimateAreaMap ? computeScore(estimateAreaMap, SIZE, KOMI) : null
  );

  function startScoring() {
    status = 'scoring';
    deadStones = [];
    areaMap = influence.areaMap(currentNode.board.signMap);
  }

  function stopScoring() {
    status = 'playing';
    deadStones = [];
    areaMap = null;
  }

  function toggleDeadGroup(x, y) {
    deadStones = toggleDeadStones(currentNode.board, deadStones, x, y);
    const scoreBoard = buildScoreBoard(currentNode.board, deadStones);
    areaMap = influence.areaMap(scoreBoard.signMap);
  }

  const movePath = $derived.by(() => {
    version;
    const path = [];
    let node = currentNode;
    while (node.parent) {
      path.unshift(node);
      node = node.parent;
    }
    return path;
  });

  const moveRows = $derived.by(() => {
    const rows = [];
    for (let i = 0; i < movePath.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const black = movePath[i];
      const white = i + 1 < movePath.length ? movePath[i + 1] : null;
      rows.push({ moveNum, black, white });
    }
    return rows;
  });

  function makeMove(x, y) {
    const vertex = [x, y];
    const sign = currentNode.signToPlay;
    const analysis = currentNode.board.analyzeMove(sign, vertex);
    if (analysis.overwrite || analysis.suicide || analysis.ko) return;

    const existing = currentNode.children.find((child) => {
      return child.lastMove && child.lastMove[0] === x && child.lastMove[1] === y;
    });
    if (existing) {
      currentNode = existing;
      return;
    }

    let newBoard;
    try {
      newBoard = currentNode.board.makeMove(sign, vertex, {
        preventSuicide: true,
        preventOverwrite: true,
        preventKo: true
      });
    } catch {
      return;
    }

    const nextSign = sign === 1 ? -1 : 1;
    const movName = getMoveName(currentNode.board, sign, vertex);
    const newNode = makeNode(
      newBoard,
      vertex,
      emptyMarkerMap(SIZE),
      nextSign,
      currentNode,
      movName
    );
    currentNode.children.push(newNode);
    currentNode = newNode;
    animatedVertex = vertex;
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

  function toggleMarker(x, y) {
    const current = currentNode.markerMap[y][x];
    const newMap = currentNode.markerMap.map((row) => [...row]);

    if (tool === 'label') {
      if (current && current.type === 'label') {
        newMap[y][x] = null;
      } else {
        const letter = nextLabel(currentNode.markerMap, SIZE);
        newMap[y][x] = { type: 'label', label: letter };
      }
    } else if (tool === 'number') {
      if (current && current.type === 'number') {
        newMap[y][x] = null;
      } else {
        const num = nextNumber(currentNode.markerMap, SIZE);
        newMap[y][x] = { type: 'number', label: num };
      }
    } else {
      newMap[y][x] = current === tool ? null : tool;
    }

    currentNode.markerMap = newMap;
    version++;
  }

  function handleVertexClick(x, y) {
    if (status === 'scoring') {
      toggleDeadGroup(x, y);
      return;
    }
    if (tool === 'stone') {
      makeMove(x, y);
    } else {
      toggleMarker(x, y);
    }
  }

  function jumpPrev() {
    if (!currentNode.parent) return;
    currentNode = currentNode.parent;
    animatedVertex = null;
  }

  function jumpNext() {
    if (currentNode.children.length === 0) return;
    currentNode = currentNode.children[0];
    animatedVertex = null;
  }

  function jumpFirst() {
    let node = currentNode;
    while (node.parent) node = node.parent;
    currentNode = node;
    animatedVertex = null;
  }

  function jumpLast() {
    let node = currentNode;
    while (node.children.length > 0) node = node.children[0];
    currentNode = node;
    animatedVertex = null;
  }

  function nextVariation() {
    if (!currentNode.parent) return;
    const siblings = currentNode.parent.children;
    const idx = siblings.indexOf(currentNode);
    if (idx < siblings.length - 1) {
      currentNode = siblings[idx + 1];
    }
  }

  function prevVariation() {
    if (!currentNode.parent) return;
    const siblings = currentNode.parent.children;
    const idx = siblings.indexOf(currentNode);
    if (idx > 0) {
      currentNode = siblings[idx - 1];
    }
  }

  function clearBoard() {
    root = makeNode(GoBoardLib.fromDimensions(SIZE), null, emptyMarkerMap(SIZE), 1, null);
    currentNode = root;
    animatedVertex = null;
    blackName = 'Black';
    whiteName = 'White';
    stopScoring();
  }

  function downloadSgf() {
    const sgf = exportSgf(root, SIZE, { playerBlack: blackName, playerWhite: whiteName });
    const blob = new Blob([sgf], { type: 'application/x-go-sgf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analysis.sgf';
    a.click();
    URL.revokeObjectURL(url);
  }

  let fileInput;

  function importSgfFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadSgfText(reader.result);
    reader.readAsText(file);
    e.target.value = '';
  }

  function loadSgfText(text) {
    const parsed = parseSgf(text);
    if (!parsed) return;

    const size = parsed.size;
    if (size !== SIZE) return;

    function buildNode(sgfNode, board, signToPlay, parent) {
      const move = sgfNodeToMove(sgfNode);
      let newBoard = board;
      let lastMove = null;
      let moveName = null;
      let nextSign = signToPlay;

      if (move && move.type === 'move') {
        try {
          newBoard = board.makeMove(move.sign, [move.x, move.y], {
            preventSuicide: true,
            preventOverwrite: true,
            preventKo: true
          });
          lastMove = [move.x, move.y];
          moveName = getMoveName(board, move.sign, lastMove);
          nextSign = move.sign === 1 ? -1 : 1;
        } catch {
          return null;
        }
      }

      const markers = sgfNodeMarkers(sgfNode, size);
      const node = makeNode(newBoard, lastMove, markers, nextSign, parent, moveName);

      for (const childSgf of sgfNode.children) {
        const childNode = buildNode(childSgf, newBoard, nextSign, node);
        if (childNode) node.children.push(childNode);
      }

      return node;
    }

    const newRoot = buildNode(parsed.root, GoBoardLib.fromDimensions(size), 1, null);
    if (!newRoot) return;

    root = newRoot;
    currentNode = root;
    animatedVertex = null;
    blackName = parsed.playerBlack || 'Black';
    whiteName = parsed.playerWhite || 'White';
    stopScoring();
  }

  function handleKeydown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      jumpPrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      jumpNext();
    } else if (e.key === 'Home') {
      e.preventDefault();
      jumpFirst();
    } else if (e.key === 'End') {
      e.preventDefault();
      jumpLast();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      prevVariation();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      nextVariation();
    }
  }

  onMount(() => {
    document.addEventListener('keydown', handleKeydown);
  });
  onDestroy(() => {
    document.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="round">
  <aside class="round__side">
    <div class="game__meta">
      <section>
        <div class="game__meta__infos" data-icon="&#xe015;">
          <div class="setup">Analysis • {SIZE}×{SIZE}</div>
        </div>
      </section>
      <section class="analysis-tools">
        <div class="tool-buttons">
          <button
            class="button"
            class:button-green={tool === 'stone'}
            class:button-metal={tool !== 'stone'}
            onclick={() => (tool = 'stone')}
            title="Place stones"
          >
            Stone
          </button>
          <button
            class="button"
            class:button-green={tool === 'cross'}
            class:button-metal={tool !== 'cross'}
            onclick={() => (tool = 'cross')}
            title="Mark X"
          >
            ✕
          </button>
          <button
            class="button"
            class:button-green={tool === 'circle'}
            class:button-metal={tool !== 'circle'}
            onclick={() => (tool = 'circle')}
            title="Mark circle"
          >
            ◯
          </button>
          <button
            class="button"
            class:button-green={tool === 'square'}
            class:button-metal={tool !== 'square'}
            onclick={() => (tool = 'square')}
            title="Mark square"
          >
            ⬜
          </button>
          <button
            class="button"
            class:button-green={tool === 'triangle'}
            class:button-metal={tool !== 'triangle'}
            onclick={() => (tool = 'triangle')}
            title="Mark triangle"
          >
            △
          </button>
          <button
            class="button"
            class:button-green={tool === 'label'}
            class:button-metal={tool !== 'label'}
            onclick={() => (tool = 'label')}
            title="Label (A, B, C...)"
          >
            A
          </button>
          <button
            class="button"
            class:button-green={tool === 'number'}
            class:button-metal={tool !== 'number'}
            onclick={() => (tool = 'number')}
            title="Number (1, 2, 3...)"
          >
            1
          </button>
        </div>
      </section>
      <section class="analysis-info">
        <div class="captures-display">
          <span class="color-icon is black text">
            {blackCaptures}
          </span>
          <span class="color-icon is white text">
            {whiteCaptures}
          </span>
        </div>
        {#if currentNode.lastMove}
          <div class="current-move-info">
            <span class="move-label">
              {colorName(currentNode.signToPlay === 1 ? -1 : 1)}
              {formatVertex(currentNode.lastMove, SIZE)}
            </span>
            {#if currentNode.moveName}
              <span class="move-pattern">{currentNode.moveName}</span>
            {/if}
          </div>
        {/if}
      </section>
    </div>
  </aside>

  <div class="round__app">
    <div class="round__app__table"></div>

    <div
      class="round__app__board"
      bind:clientWidth={boardContainerWidth}
      bind:clientHeight={boardContainerHeight}
    >
      <GoBoard
        {signMap}
        lastMove={currentNode.lastMove}
        {animatedVertex}
        size={SIZE}
        {vertexSize}
        showCoords={boardState.showCoords}
        {currentSign}
        {markerMap}
        {childrenMap}
        areaMap={status === 'scoring' ? areaMap : estimateAreaMap}
        deadStones={status === 'scoring' ? deadStones : null}
        onVertexClick={handleVertexClick}
      />
    </div>

    <PlayerStrip color="white" name={whiteName} position="top" />

    <div class="rmoves">
      <div class="analysis-moves">
        {#if moveRows.length > 0}
          <table class="moves-table">
            <thead>
              <tr>
                <th class="moves-col-num"></th>
                <th class="moves-col-black">Black</th>
                <th class="moves-col-white">White</th>
              </tr>
            </thead>
            <tbody>
              {#each moveRows as row}
                <tr>
                  <td class="moves-col-num">{row.moveNum}.</td>
                  <td class="moves-col-black">
                    <button
                      class="move-entry"
                      class:active={row.black === currentNode}
                      onclick={() => {
                        currentNode = row.black;
                        animatedVertex = null;
                      }}
                      title={row.black.moveName
                        ? `${formatVertex(row.black.lastMove, SIZE)} — ${row.black.moveName}`
                        : formatVertex(row.black.lastMove, SIZE)}
                    >
                      <span class="move-coord">{formatVertex(row.black.lastMove, SIZE)}</span>
                      {#if row.black.moveName}
                        <span class="move-name">{row.black.moveName}</span>
                      {/if}
                      {#if row.black.children.length > 1}
                        <span class="move-branches" title="{row.black.children.length} variations"
                          >⑂</span
                        >
                      {/if}
                    </button>
                  </td>
                  <td class="moves-col-white">
                    {#if row.white}
                      <button
                        class="move-entry"
                        class:active={row.white === currentNode}
                        onclick={() => {
                          currentNode = row.white;
                          animatedVertex = null;
                        }}
                        title={row.white.moveName
                          ? `${formatVertex(row.white.lastMove, SIZE)} — ${row.white.moveName}`
                          : formatVertex(row.white.lastMove, SIZE)}
                      >
                        <span class="move-coord">{formatVertex(row.white.lastMove, SIZE)}</span>
                        {#if row.white.moveName}
                          <span class="move-name">{row.white.moveName}</span>
                        {/if}
                        {#if row.white.children.length > 1}
                          <span class="move-branches" title="{row.white.children.length} variations"
                            >⑂</span
                          >
                        {/if}
                      </button>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <div class="analysis-empty">Click the board to start analyzing</div>
        {/if}
      </div>
      {#if currentNode.parent && currentNode.parent.children.length > 1}
        {@const siblings = currentNode.parent.children}
        {@const idx = siblings.indexOf(currentNode)}
        <div class="variation-nav">
          Variation {idx + 1} of {siblings.length}
          <button class="var-nav-btn" onclick={prevVariation} disabled={idx <= 0}>◀</button>
          <button class="var-nav-btn" onclick={nextVariation} disabled={idx >= siblings.length - 1}
            >▶</button
          >
        </div>
      {/if}
    </div>

    <div class="rcontrols">
      {#if status === 'scoring'}
        <button class="button button-green" onclick={stopScoring}>Back to analysis</button>
        {#if score}
          <div class="score-display">
            <span class="color-icon is black text">{score.blackArea}</span>
            <span class="color-icon is white text"
              >{score.whiteArea} + {KOMI} = {score.whiteScore.toFixed(1)}</span
            >
            <strong>{scoreVerdictShort(score)}</strong>
          </div>
        {/if}
      {:else}
        <button class="button button-metal" onclick={startScoring}>Score</button>
        <button
          class="button"
          class:button-green={showEstimate}
          class:button-metal={!showEstimate}
          onclick={() => (showEstimate = !showEstimate)}>Estimate</button
        >
        <button class="button button-metal" onclick={clearBoard}>Clear</button>
        <!-- <button class="button button-metal" onclick={downloadSgf}>SGF</button>
        <button class="button button-metal" onclick={() => fileInput.click()}>Load</button> -->
        {#if estimatedScore}
          <div class="score-display">
            <span class="color-icon is black text">{estimatedScore.blackArea}</span>
            <span class="color-icon is white text"
              >{estimatedScore.whiteArea} + {KOMI} = {estimatedScore.whiteScore.toFixed(1)}</span
            >
            <strong>{scoreVerdictShort(estimatedScore)}</strong>
          </div>
        {/if}
      {/if}
    </div>

    <NavigationButtons
      canPrev={!!currentNode.parent}
      canNext={currentNode.children.length > 0}
      onFirst={jumpFirst}
      onPrev={jumpPrev}
      onNext={jumpNext}
      onLast={jumpLast}
    />

    <PlayerStrip color="black" name={blackName} position="bottom" active={true} />
  </div>
</div>

<!-- <input
  type="file"
  accept=".sgf"
  style="display: none"
  bind:this={fileInput}
  onchange={importSgfFile}
/> -->

<style>
  .analysis-tools {
    padding: 0.5em;
  }

  .tool-buttons {
    display: flex;
    gap: 0.4em;
  }

  .tool-buttons .button {
    flex: 1;
    font-size: 0.85em;
    padding: 0.4em 0.6em;
  }

  .analysis-info {
    padding: 0.5em;
  }

  .captures-display {
    display: flex;
    gap: 1em;
    font-size: 0.9em;
  }

  .current-move-info {
    margin-top: 0.4em;
    font-size: 0.85em;
    display: flex;
    flex-direction: column;
    gap: 0.15em;
  }

  .move-label {
    text-transform: capitalize;
  }

  .move-pattern {
    color: var(--c-accent);
    font-weight: bold;
  }

  :global(.rmoves) {
    justify-content: flex-start !important;
    padding: 0 !important;
  }

  .analysis-moves {
    padding: 0.5em;
    overflow-y: auto;
    flex: 1 1 0;
  }

  .analysis-empty {
    color: var(--c-font-dim);
    font-size: 0.85em;
    padding: 0.5em;
  }

  .moves-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9em;
  }

  .moves-table thead th {
    font-size: 0.85em;
    color: var(--c-font-dim);
    font-weight: normal;
    text-align: left;
    padding: 4px 6px;
    border-bottom: 1px solid var(--c-border);
  }

  .moves-col-num {
    width: 2.2em;
    text-align: right;
    padding-right: 6px;
    color: var(--c-font-dim);
    font-size: 0.9em;
    vertical-align: middle;
  }

  .moves-col-black,
  .moves-col-white {
    width: 50%;
    padding: 2px;
  }

  .moves-table tbody tr:nth-child(even) {
    background: var(--c-bg-zebra);
  }

  .move-entry {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 6px;
    background: none;
    border: 1px solid transparent;
    border-radius: 3px;
    cursor: pointer;
    color: var(--c-font);
    width: 100%;
    text-align: left;
  }

  .move-entry:hover {
    background: var(--c-bg-zebra2, var(--c-bg-zebra));
  }

  .move-entry.active {
    background: var(--c-accent);
    color: #fff;
    border-color: var(--c-accent);
  }

  .move-name {
    font-size: 0.85em;
    color: var(--c-accent);
    font-style: italic;
  }

  .move-entry.active .move-name {
    color: rgba(255, 255, 255, 0.8);
  }

  .move-branches {
    font-size: 0.9em;
    opacity: 0.6;
  }

  .variation-nav {
    display: flex;
    align-items: center;
    gap: 0.4em;
    padding: 0.3em 0.5em;
    font-size: 0.8em;
    color: var(--c-font-dim);
    background: var(--c-bg-zebra);
    border-radius: 3px;
    margin: 0.3em 0.4em;
  }

  .var-nav-btn {
    background: none;
    border: 1px solid var(--c-border);
    border-radius: 3px;
    color: var(--c-font);
    cursor: pointer;
    padding: 1px 6px;
    font-size: 0.9em;
  }

  .var-nav-btn:hover:not([disabled]) {
    background: var(--c-bg-zebra2, var(--c-bg-zebra));
  }

  .var-nav-btn[disabled] {
    opacity: 0.4;
    cursor: default;
  }

  .score-display {
    display: flex;
    flex-direction: column;
    gap: 0.2em;
    font-size: 0.85em;
    padding: 0.3em 0;
  }
</style>
