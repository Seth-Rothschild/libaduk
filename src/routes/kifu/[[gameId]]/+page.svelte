<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { getMe } from '$lib/state/user.svelte.js';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import NavigationButtons from '$lib/game/NavigationButtons.svelte';
  import {
    createBoard,
    applyMove,
    applySetup,
    exportSgf,
    parseSgf,
    sgfNodeToMove,
    sgfNodeComment,
    sgfNodeSetup,
    emptyMarkerMap,
    parseSgfCoords
  } from '$lib/game/board';

  const gameId = $derived(page.params.gameId ?? null);

  let size = $state(19);
  let blackName = $state('');
  let whiteName = $state('');
  let komi = $state(6.5);
  let result = $state('');
  let notes = $state('');
  let moves = $state([]);
  let setup = $state([]);
  let handicapMode = $state(false);
  let status = $state('waiting');
  let winner = $state(null);

  const me = $derived(getMe()?.username ?? null);
  const isFinished = $derived(status === 'finished');

  let cursor = $state(0);
  const atLiveEdge = $derived(cursor === moves.length);
  const displayedMoves = $derived.by(() => {
    if (editMode === 'replace') return moves.slice(0, editTargetIndex - 1);
    return moves.slice(0, cursor);
  });
  const gameState = $derived.by(() => buildGameState(displayedMoves, setup, size));
  const currentSign = $derived.by(() => {
    if (handicapMode) return 1;
    const hasHandicap = setup.length >= 2;
    const n = displayedMoves.length;
    return hasHandicap ? (n % 2 === 0 ? -1 : 1) : n % 2 === 0 ? 1 : -1;
  });

  let editMode = $state(null);
  let editTargetIndex = $state(null);
  let editSnapshot = $state(null);
  const isEditing = $derived(editMode !== null);

  const highlightVertex = $derived.by(() => {
    if (atLiveEdge) return null;
    if (cursor < 1 || cursor > moves.length) return null;
    const move = moves[cursor - 1];
    if (move.type === 'pass') return null;
    return [move.x, move.y];
  });

  function navFirst() {
    cursor = 0;
  }
  function navPrev() {
    if (cursor > 0) cursor -= 1;
  }
  function navNext() {
    if (cursor < moves.length) cursor += 1;
  }
  function navLast() {
    cursor = moves.length;
  }

  function renumber(list) {
    const hasHandicap = setup.length >= 2;
    let sign = hasHandicap ? -1 : 1;
    return list.map((m, i) => {
      const next = { ...m, number: i + 1, sign };
      sign = sign === 1 ? -1 : 1;
      return next;
    });
  }

  function startReplace() {
    if (cursor < 1) return;
    editMode = 'replace';
    editTargetIndex = cursor;
  }

  function startInsert() {
    editMode = 'insert';
    editTargetIndex = cursor;
    editSnapshot = moves;
  }

  function removeMove() {
    if (isEditing || handicapMode || cursor < 1 || cursor > moves.length) return;
    const updated = [...moves];
    updated.splice(cursor - 1, 1);
    moves = renumber(updated);
    cursor = moves.length;
    if (gameId) syncMoves(moves);
  }

  function cancelEdit() {
    if (editMode === 'insert' && editSnapshot) {
      moves = editSnapshot;
    }
    editMode = null;
    editTargetIndex = null;
    editSnapshot = null;
    cursor = moves.length;
  }

  function finishInsert() {
    editMode = null;
    editTargetIndex = null;
    editSnapshot = null;
    cursor = moves.length;
    if (gameId) syncMoves(moves);
  }

  function loadMovesFromGame(game) {
    const packedMoves = game.gamedata?.moves ?? [];
    const result = [];
    let sign = game.gamedata?.initial_player === 'white' ? -1 : 1;
    for (const [x, y] of packedMoves) {
      if (x < 0) {
        result.push({ type: 'pass', sign, number: result.length + 1 });
      } else {
        result.push({ type: 'move', x, y, sign, number: result.length + 1 });
      }
      sign = sign === 1 ? -1 : 1;
    }
    return result;
  }

  function buildGameState(moves, setup, size) {
    let board = applySetup(createBoard(size), setup);
    const numberAt = new Map();

    for (const move of moves) {
      if (move.type === 'pass') continue;
      let nextBoard;
      try {
        nextBoard = applyMove(board, move.sign, move.x, move.y);
      } catch {
        continue;
      }
      const key = `${move.x},${move.y}`;
      if (!numberAt.has(key)) {
        numberAt.set(key, move.number);
      }
      board = nextBoard;
    }

    const markerMap = Array.from({ length: size }, () => Array(size).fill(null));
    for (const [key, num] of numberAt) {
      const [x, y] = key.split(',').map(Number);
      if (board.signMap[y][x] !== 0) {
        markerMap[y][x] = { type: 'label', label: String(num) };
      }
    }

    return { board, displaySignMap: board.signMap, markerMap, numberAt };
  }

  function placeSetupStone(x, y) {
    const alreadyPlaced = setup.some((s) => s.x === x && s.y === y);
    if (alreadyPlaced) {
      setup = setup.filter((s) => s.x !== x || s.y !== y);
    } else {
      setup = [...setup, { x, y, sign: 1 }];
    }
  }

  function placeStone(x, y) {
    if (handicapMode) {
      placeSetupStone(x, y);
      return;
    }
    if (editMode === 'replace') {
      try {
        applyMove(gameState.board, currentSign, x, y);
      } catch {
        return;
      }
      const updated = [...moves];
      updated[editTargetIndex - 1] = { type: 'move', x, y, sign: currentSign, number: 0 };
      moves = renumber(updated);
      editMode = null;
      editTargetIndex = null;
      cursor = moves.length;
      if (gameId) syncMoves(moves);
      return;
    }
    if (editMode === 'insert') {
      try {
        applyMove(gameState.board, currentSign, x, y);
      } catch {
        return;
      }
      const updated = [...moves];
      updated.splice(editTargetIndex, 0, { type: 'move', x, y, sign: currentSign, number: 0 });
      moves = renumber(updated);
      editTargetIndex += 1;
      cursor = editTargetIndex;
      return;
    }
    if (!atLiveEdge) return;
    try {
      applyMove(gameState.board, currentSign, x, y);
    } catch {
      return;
    }
    const newNumber = moves.length + 1;
    const updatedMoves = [...moves, { type: 'move', x, y, sign: currentSign, number: newNumber }];
    moves = updatedMoves;
    cursor = updatedMoves.length;
    if (gameId) syncMoves(updatedMoves);
  }

  function pass() {
    if (isEditing || !atLiveEdge) return;
    const updatedMoves = [...moves, { type: 'pass', sign: currentSign, number: moves.length + 1 }];
    moves = updatedMoves;
    cursor = updatedMoves.length;
    if (gameId) syncMoves(updatedMoves);
  }

  function startHandicap() {
    setup = [];
    moves = [];
    cursor = 0;
    handicapMode = true;
  }

  function editHandicap() {
    if (cursor !== 0 || isEditing) return;
    handicapMode = true;
  }

  function doneHandicap() {
    handicapMode = false;
    moves = renumber(moves);
    cursor = moves.length;
    if (gameId) syncHandicap();
  }

  async function syncHandicap() {
    const handicapStones = setup.map(({ x, y }) => ({ x, y }));
    await fetch('/api/game/details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, handicapStones })
    });
  }

  function changeSize(newSize) {
    size = newSize;
    moves = [];
    setup = [];
    cursor = 0;
    handicapMode = false;
  }

  function undo() {
    if (isEditing || moves.length === 0) return;
    const updatedMoves = moves.slice(0, -1);
    moves = updatedMoves;
    cursor = moves.length;
    if (gameId) syncMoves(updatedMoves);
  }

  async function syncMoves(updatedMoves) {
    const dbMoves = updatedMoves.map((m) =>
      m.type === 'pass' ? { type: 'pass' } : { type: 'move', x: m.x, y: m.y }
    );
    await fetch('/api/game/moves', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, moves: dbMoves })
    });
  }

  async function createGameRecord() {
    const dbMoves = moves.map((m) =>
      m.type === 'pass' ? { type: 'pass' } : { type: 'move', x: m.x, y: m.y }
    );
    const handicapStones = setup.map(({ x, y }) => ({ x, y }));
    const res = await fetch('/api/game/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moves: dbMoves,
        handicapStones,
        blackName,
        whiteName,
        size,
        komi,
        result,
        status: 'playing',
        username: getMe()?.username ?? null
      })
    });
    const { id } = await res.json();
    await goto(`/kifu/${id}`);
  }

  async function syncDetails() {
    if (!gameId) return;
    await fetch('/api/game/details', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, blackName, whiteName, komi, result })
    });
  }

  function claimColor(color) {
    if (!me) return;
    if (color === 'black') {
      blackName = me;
      if (whiteName === me) whiteName = '';
    } else {
      whiteName = me;
      if (blackName === me) blackName = '';
    }
    syncDetails();
  }

  let showFinishDialog = $state(false);
  let finishWinner = $state('black');
  let finishResult = $state('');
  let finishDialogEl;

  function openFinishDialog() {
    finishWinner = winner || 'black';
    finishResult = result || '';
    showFinishDialog = true;
    finishDialogEl?.showModal();
  }

  function closeFinishDialog() {
    showFinishDialog = false;
    finishDialogEl?.close();
  }

  async function confirmFinish() {
    status = 'finished';
    winner = finishWinner;
    result = finishResult;
    if (gameId) {
      await fetch('/api/game/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          status: 'finished',
          winner: finishWinner,
          result: finishResult
        })
      });
    }
    closeFinishDialog();
  }

  function buildSgfTree(moves, setup, size, comment) {
    const root = {
      lastMove: null,
      signToPlay: setup.length >= 2 ? -1 : 1,
      markerMap: emptyMarkerMap(size),
      comment,
      setup,
      children: []
    };
    let current = root;
    for (const move of moves) {
      const node = {
        lastMove: move.type === 'pass' ? null : [move.x, move.y],
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
    const root = buildSgfTree(moves, setup, size, notes);
    const sgf = exportSgf(root, size, { playerBlack: blackName, playerWhite: whiteName, komi });
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

    const rootSetup = sgfNodeSetup(parsed.root, parsed.size);
    const hasHandicap = rootSetup.filter((s) => s.sign === 1).length >= 2;
    let board = applySetup(createBoard(parsed.size), rootSetup);
    let sign = hasHandicap ? -1 : 1;
    const newMoves = [];
    let node = parsed.root;
    while (node.children.length > 0) {
      node = node.children[0];
      const move = sgfNodeToMove(node);
      if (!move) continue;
      if (move.type === 'pass') {
        newMoves.push({ type: 'pass', sign, number: newMoves.length + 1 });
        sign = sign === 1 ? -1 : 1;
        continue;
      }
      try {
        board = applyMove(board, move.sign, move.x, move.y);
      } catch {
        continue;
      }
      newMoves.push({
        type: 'move',
        x: move.x,
        y: move.y,
        sign: move.sign,
        number: newMoves.length + 1
      });
      sign = sign === 1 ? -1 : 1;
    }

    blackName = parsed.playerBlack || '';
    whiteName = parsed.playerWhite || '';
    komi = parsed.root.props.KM ? parseFloat(parsed.root.props.KM[0]) : 6.5;
    notes = sgfNodeComment(parsed.root) || '';
    size = parsed.size;
    setup = rootSetup;
    moves = newMoves;
    cursor = newMoves.length;
  }

  onMount(async () => {
    if (!gameId) return;
    const res = await fetch(`/api/game/${gameId}`);
    if (!res.ok) return;
    const game = await res.json();
    const gamedata = game.gamedata ?? {};
    size = gamedata.width ?? 19;
    blackName = gamedata.players?.black?.username ?? '';
    whiteName = gamedata.players?.white?.username ?? '';
    komi = gamedata.komi ?? 6.5;
    result = game.result ?? '';
    status = game.status ?? 'waiting';
    winner = game.winner ?? null;
    const handicapCoords = parseSgfCoords(gamedata.initial_state?.black ?? '');
    setup = handicapCoords.map(([x, y]) => ({ x, y, sign: 1 }));
    moves = loadMovesFromGame(game);
    cursor = moves.length;
  });
</script>

<div class="round">
  <aside class="round__side">
    <div class="game__meta">
      <section>
        <div class="game__meta__infos" data-icon="&#xe015;">
          <div class="setup">Kifu</div>
        </div>
      </section>
      <div class="kifu-fields">
        <label class="kifu-field">
          <span>Size</span>
          <select
            value={size}
            onchange={(e) => changeSize(Number(e.target.value))}
            disabled={!!gameId || moves.length > 0 || setup.length > 0}
          >
            <option value={9}>9×9</option>
            <option value={13}>13×13</option>
            <option value={19}>19×19</option>
          </select>
        </label>
        <label class="kifu-field">
          <span>Black</span>
          <div class="kifu-field-row">
            <input
              type="text"
              placeholder="player name"
              bind:value={blackName}
              onchange={syncDetails}
            />
            {#if me && blackName !== me}
              <button class="kifu-claim-btn" onclick={() => claimColor('black')}>This is me</button>
            {/if}
          </div>
        </label>
        <label class="kifu-field">
          <span>White</span>
          <div class="kifu-field-row">
            <input
              type="text"
              placeholder="player name"
              bind:value={whiteName}
              onchange={syncDetails}
            />
            {#if me && whiteName !== me}
              <button class="kifu-claim-btn" onclick={() => claimColor('white')}>This is me</button>
            {/if}
          </div>
        </label>
        <label class="kifu-field">
          <span>Komi</span>
          <input type="number" step="0.5" bind:value={komi} onchange={syncDetails} />
        </label>
        <label class="kifu-field">
          <span>Result</span>
          <input type="text" placeholder="e.g. B+R" bind:value={result} onchange={syncDetails} />
        </label>
        <textarea class="kifu-notes" placeholder="Notes..." bind:value={notes}></textarea>
      </div>
    </div>
  </aside>

  <div class="kifu-app">
    <div class="round__app__board kifu-board">
      <div class="round__app__board__inner">
        <GoBoard
          signMap={gameState.displaySignMap}
          markerMap={gameState.markerMap}
          {size}
          showCoords={true}
          {currentSign}
          {highlightVertex}
          onVertexClick={placeStone}
          interactive={handicapMode || atLiveEdge || isEditing}
          useTheme={false}
        />
      </div>
    </div>

    <div class="rcontrols">
      {#if isEditing}
        <div class="kifu-edit-bar">
          <span>
            {editMode === 'replace'
              ? 'Click the correct spot for this move.'
              : 'Placing inserted moves…'}
          </span>
          <div class="kifu-inline-actions">
            {#if editMode === 'insert'}
              <button class="button button-metal" onclick={finishInsert}>Done inserting</button>
            {/if}
            <button class="button button-metal" onclick={cancelEdit}>Cancel</button>
          </div>
        </div>
      {/if}
      <div class="kifu-move-count">Move {moves.length}</div>
      {#if handicapMode}
        <button class="button button-metal" onclick={doneHandicap}>Done placing</button>
      {:else if !gameId && moves.length === 0}
        <button class="button button-metal" onclick={startHandicap}>Set handicap</button>
      {:else if gameId && cursor === 0 && !isEditing}
        <button class="button button-metal" onclick={editHandicap}>Edit handicap</button>
      {/if}
      <button class="button button-metal" onclick={undo} disabled={isEditing || moves.length === 0}
        >Undo</button
      >
      <button
        class="button button-metal"
        onclick={pass}
        disabled={isEditing || handicapMode || !atLiveEdge}>Pass</button
      >
      {#if gameId}
        <button class="button button-metal" onclick={openFinishDialog}
          >{isFinished ? 'Edit result' : 'Game over'}</button
        >
      {/if}
      {#if gameId}
        <a class="button button-metal" href={`/play/${gameId}`}>View game record</a>
      {:else}
        <button class="button button-metal" onclick={createGameRecord} disabled={moves.length === 0}
          >Save game record</button
        >
      {/if}
    </div>

    <NavigationButtons
      canPrev={!isEditing && cursor > 0}
      canNext={!isEditing && cursor < moves.length}
      onFirst={navFirst}
      onPrev={navPrev}
      onNext={navNext}
      onLast={navLast}
      menuItems={[
        ...(moves.length > 0 || setup.length > 0
          ? [{ label: 'Download SGF', onclick: downloadSgf }]
          : []),
        ...(!gameId ? [{ label: 'Upload SGF', onclick: () => fileInput.click() }] : []),
        ...(!isEditing && !handicapMode && cursor > 0
          ? [
              { label: 'Replace this move', onclick: startReplace },
              { label: 'Remove this move', onclick: removeMove }
            ]
          : []),
        ...(!isEditing && !handicapMode
          ? [{ label: 'Insert moves here', onclick: startInsert }]
          : [])
      ]}
    />
  </div>
</div>

<dialog
  bind:this={finishDialogEl}
  class="ai-model-dialog"
  onclose={() => (showFinishDialog = false)}
>
  {#if showFinishDialog}
    <h2>Mark game over</h2>
    <p>Recording stops once a game is marked done. You can still browse the moves afterward.</p>
    <div class="kifu-fields">
      <label class="kifu-field">
        <span>Winner</span>
        <select bind:value={finishWinner}>
          <option value="black">Black</option>
          <option value="white">White</option>
        </select>
      </label>
      <label class="kifu-field">
        <span>Result</span>
        <input type="text" placeholder="e.g. B+R" bind:value={finishResult} />
      </label>
    </div>
    <div class="kifu-inline-actions">
      <button class="button button-metal" onclick={closeFinishDialog}>Cancel</button>
      <button class="button button-green" onclick={confirmFinish}>Confirm</button>
    </div>
  {/if}
</dialog>

{#if !gameId}
  <input
    type="file"
    accept=".sgf"
    style="display: none"
    bind:this={fileInput}
    onchange={importSgfFile}
  />
{/if}
