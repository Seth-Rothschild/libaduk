<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { getMe } from '$lib/state/user.svelte.js';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import {
    createBoard,
    applyMove,
    exportSgf,
    parseSgf,
    sgfNodeToMove,
    sgfNodeComment,
    emptyMarkerMap
  } from '$lib/game/board';

  const gameId = $derived(page.params.gameId ?? null);

  let size = $state(19);
  let blackName = $state('');
  let whiteName = $state('');
  let notes = $state('');
  let moves = $state([]);

  const gameState = $derived.by(() => buildGameState(moves, size));
  const currentSign = $derived(moves.length % 2 === 0 ? 1 : -1);

  let cursor = $state(0);
  const highlightVertex = $derived.by(() => {
    if (cursor < 1 || cursor >= moves.length) return null;
    const move = moves[cursor - 1];
    return [move.x, move.y];
  });

  function navFirst() {
    if (moves.length > 0) cursor = 1;
  }
  function navPrev() {
    if (cursor > 1) cursor -= 1;
  }
  function navNext() {
    if (cursor < moves.length) cursor += 1;
  }
  function navLast() {
    if (moves.length > 0) cursor = moves.length;
  }

  function loadMovesFromGame(game) {
    const dbMoves = game.moves ?? [];
    const result = [];
    let sign = 1;
    for (const m of dbMoves) {
      if (m.type === 'pass') {
        sign = sign === 1 ? -1 : 1;
        continue;
      }
      if (m.x == null || m.y == null) continue;
      result.push({ x: m.x, y: m.y, sign, number: result.length + 1 });
      sign = sign === 1 ? -1 : 1;
    }
    return result;
  }

  function buildGameState(moves, size) {
    let board = createBoard(size);
    const numberAt = new Map();
    const displaySignMap = Array.from({ length: size }, () => Array(size).fill(0));

    for (const move of moves) {
      let nextBoard;
      try {
        nextBoard = applyMove(board, move.sign, move.x, move.y);
      } catch {
        continue;
      }
      const key = `${move.x},${move.y}`;
      if (!numberAt.has(key)) {
        displaySignMap[move.y][move.x] = move.sign;
        numberAt.set(key, move.number);
      }
      board = nextBoard;
    }

    const markerMap = Array.from({ length: size }, () => Array(size).fill(null));
    for (const [key, num] of numberAt) {
      const [x, y] = key.split(',').map(Number);
      markerMap[y][x] = { type: 'label', label: String(num) };
    }

    return { board, displaySignMap, markerMap, numberAt };
  }

  function placeStone(x, y) {
    try {
      applyMove(gameState.board, currentSign, x, y);
    } catch {
      return;
    }
    const newNumber = moves.length + 1;
    const previousNumber = gameState.numberAt.get(`${x},${y}`);
    if (previousNumber !== undefined) {
      const line = `${newNumber} is at ${previousNumber}`;
      notes = notes ? `${notes}\n${line}` : line;
    }
    const updatedMoves = [...moves, { x, y, sign: currentSign, number: newNumber }];
    moves = updatedMoves;
    if (gameId) syncMoves(updatedMoves);
  }

  function changeSize(newSize) {
    size = newSize;
    moves = [];
    cursor = 0;
  }

  function undo() {
    if (moves.length === 0) return;
    const updatedMoves = moves.slice(0, -1);
    moves = updatedMoves;
    if (cursor > moves.length) cursor = moves.length;
    if (gameId) syncMoves(updatedMoves);
  }

  async function syncMoves(updatedMoves) {
    const dbMoves = updatedMoves.map(({ x, y }) => ({ type: 'move', x, y }));
    await fetch('/api/game/moves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, moves: dbMoves })
    });
  }

  async function createGameRecord() {
    const dbMoves = moves.map(({ x, y }) => ({ type: 'move', x, y }));
    const res = await fetch('/api/game/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moves: dbMoves,
        blackName,
        whiteName,
        size,
        komi: 6.5,
        username: getMe()?.username ?? null
      })
    });
    const { id } = await res.json();
    goto(`/kifu/${id}`);
  }

  function buildSgfTree(moves, size, comment) {
    const root = {
      lastMove: null,
      signToPlay: 1,
      markerMap: emptyMarkerMap(size),
      comment,
      setup: [],
      children: []
    };
    let current = root;
    for (const move of moves) {
      const node = {
        lastMove: [move.x, move.y],
        signToPlay: move.sign === 1 ? -1 : 1,
        markerMap: emptyMarkerMap(size),
        comment: '',
        setup: [],
        children: []
      };
      current.children.push(node);
      current = node;
    }
    return root;
  }

  function downloadSgf() {
    const root = buildSgfTree(moves, size, notes);
    const sgf = exportSgf(root, size, { playerBlack: blackName, playerWhite: whiteName });
    const blob = new Blob([sgf], { type: 'application/x-go-sgf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'kifu.sgf';
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
    if (!parsed || !parsed.size) return;

    let board = createBoard(parsed.size);
    const newMoves = [];
    let node = parsed.root;
    while (node.children.length > 0) {
      node = node.children[0];
      const move = sgfNodeToMove(node);
      if (move?.type !== 'move') continue;
      try {
        board = applyMove(board, move.sign, move.x, move.y);
      } catch {
        continue;
      }
      newMoves.push({
        x: move.x,
        y: move.y,
        sign: move.sign,
        number: newMoves.length + 1
      });
    }

    blackName = parsed.playerBlack || '';
    whiteName = parsed.playerWhite || '';
    notes = sgfNodeComment(parsed.root) || '';
    size = parsed.size;
    moves = newMoves;
    cursor = 0;
  }

  onMount(async () => {
    if (!gameId) return;
    const res = await fetch(`/api/game/${gameId}`);
    if (!res.ok) return;
    const game = await res.json();
    size = game.size ?? 19;
    blackName = game.blackName ?? '';
    whiteName = game.whiteName ?? '';
    moves = loadMovesFromGame(game);
  });
</script>

<div class="kifu">
  <div class="kifu__board">
    <GoBoard
      signMap={gameState.displaySignMap}
      markerMap={gameState.markerMap}
      {size}
      showCoords={true}
      {currentSign}
      {highlightVertex}
      onVertexClick={placeStone}
    />
  </div>

  <div class="kifu__actions">
    <button
      data-icon="&#xe035;"
      aria-label="First move"
      disabled={moves.length === 0 || cursor === 1}
      onclick={navFirst}
    ></button>
    <button data-icon="&#xe037;" aria-label="Previous move" disabled={cursor <= 1} onclick={navPrev}
    ></button>
    <button
      data-icon="&#xe036;"
      aria-label="Next move"
      disabled={cursor >= moves.length}
      onclick={navNext}
    ></button>
    <button
      data-icon="&#xe034;"
      aria-label="Last move"
      disabled={moves.length === 0 || cursor === moves.length}
      onclick={navLast}
    ></button>
    <button onclick={undo} disabled={moves.length === 0}>Undo</button>
    <button onclick={downloadSgf} disabled={moves.length === 0}>Download SGF</button>
    {#if !gameId}
      <button onclick={() => fileInput.click()}>Upload SGF</button>
      <button onclick={createGameRecord} disabled={moves.length === 0}>Create game record</button>
    {/if}
    <span>Move {moves.length}</span>
  </div>
  <div class="kifu__names">
    <label class="kifu__name">
      <span>Size</span>
      <select
        value={size}
        onchange={(e) => changeSize(Number(e.target.value))}
        disabled={!!gameId || moves.length > 0}
      >
        <option value={9}>9×9</option>
        <option value={13}>13×13</option>
        <option value={19}>19×19</option>
      </select>
    </label>
    <label class="kifu__name">
      <span>Black</span>
      <input type="text" placeholder="player name" bind:value={blackName} />
    </label>
    <label class="kifu__name">
      <span>White</span>
      <input type="text" placeholder="player name" bind:value={whiteName} />
    </label>
  </div>

  <textarea class="kifu__notes" placeholder="Notes..." bind:value={notes}></textarea>
</div>

{#if !gameId}
  <input
    type="file"
    accept=".sgf"
    style="display: none"
    bind:this={fileInput}
    onchange={importSgfFile}
  />
{/if}
