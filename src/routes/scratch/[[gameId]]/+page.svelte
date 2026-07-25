<script>
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { createBoard } from '$lib/game/board';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import PlayerStrip from '$lib/game/PlayerStrip.svelte';
  import NavigationButtons from '$lib/game/NavigationButtons.svelte';
  import AnalysisMoves from '$lib/game/AnalysisMoves.svelte';
  import GameGraph from '$lib/game/GameGraph.svelte';
  import {
    AnalysisState,
    makeAnalysisNode,
    getAnalysisMoveName,
    serializeTree
  } from '$lib/game/analysisState.svelte.js';
  import { getMe } from '$lib/state/user.svelte.js';
  import { page } from '$app/state';
  import { boardSettings } from '$lib/nav/boardSettings.svelte.js';
  import {
    clampBoardSize,
    applySetup,
    exportSgf,
    parseSgf,
    sgfNodeToMove,
    sgfNodeMarkers,
    sgfNodeComment,
    sgfNodeSetup
  } from '$lib/game/board';

  const gameId = page.params.gameId ?? null;

  const initialSize = clampBoardSize(Number(page.url.searchParams.get('size') ?? 19));
  let size = $state(initialSize);
  let komi = $state(6.5);

  let analysis = $state(new AnalysisState(initialSize, 6.5));

  let blackName = $state('Black');
  let whiteName = $state('White');

  let fileInput;

  const hasMovesPlaced = $derived(analysis.root.children.length > 0);

  function changeSize(newSize) {
    size = newSize;
    analysis = new AnalysisState(size, komi);
  }

  function downloadSgf() {
    const sgf = exportSgf(analysis.root, size, { playerBlack: blackName, playerWhite: whiteName });
    const blob = new Blob([sgf], { type: 'application/x-go-sgf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scratch.sgf';
    a.click();
    URL.revokeObjectURL(url);
  }

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

    const parsedSize = clampBoardSize(parsed.size);

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
          moveName = getAnalysisMoveName(board, move.sign, lastMove);
          nextSign = move.sign === 1 ? -1 : 1;
        } catch {
          return null;
        }
      }

      const setup = sgfNodeSetup(sgfNode, parsedSize);
      newBoard = applySetup(newBoard, setup);

      const markers = sgfNodeMarkers(sgfNode, parsedSize);
      const comment = sgfNodeComment(sgfNode);
      const node = makeAnalysisNode(
        newBoard,
        lastMove,
        markers,
        nextSign,
        parent,
        moveName,
        comment,
        setup
      );

      for (const childSgf of sgfNode.children) {
        const childNode = buildNode(childSgf, newBoard, nextSign, node);
        if (childNode) node.children.push(childNode);
      }

      return node;
    }

    const newRoot = buildNode(parsed.root, createBoard(parsedSize), 1, null);
    if (!newRoot) return;

    size = parsedSize;
    analysis = new AnalysisState(parsedSize, komi);
    blackName = parsed.playerBlack || 'Black';
    whiteName = parsed.playerWhite || 'White';
    analysis.setRoot(newRoot);
  }

  async function saveGame() {
    const tree = serializeTree(analysis.root);
    const username = getMe()?.username ?? null;
    const res = await fetch('/api/game/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysisTree: tree, blackName, whiteName, size, komi, username })
    });
    const { id } = await res.json();
    goto(`/play/${id}`);
  }

  function handleKeydown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const keyMap = {
      ArrowUp: 'prev',
      ArrowDown: 'next',
      Home: 'first',
      End: 'last',
      ArrowLeft: 'prev-variation',
      ArrowRight: 'next-variation'
    };
    const action = keyMap[e.key];
    if (action) {
      e.preventDefault();
      analysis.navigate(action);
    }
  }

  onMount(async () => {
    document.addEventListener('keydown', handleKeydown);
    if (!gameId) return;
    const res = await fetch(`/api/game/${gameId}`);
    if (!res.ok) return;
    const game = await res.json();
    const gamedata = game.gamedata ?? {};
    size = gamedata.width ?? 19;
    blackName = gamedata.players?.black?.username ?? 'Black';
    whiteName = gamedata.players?.white?.username ?? 'White';
    komi = gamedata.komi ?? 6.5;
    if (game.analysisTree) {
      analysis = new AnalysisState(size, komi);
      analysis.loadTree(game.analysisTree, null);
    }
  });
  onDestroy(() => document.removeEventListener('keydown', handleKeydown));
</script>

<div class="round">
  <aside class="round__side">
    <div class="game__meta">
      <section>
        <div class="game__meta__infos" data-icon="&#xe015;">
          <div class="setup">Scratch board</div>
        </div>
      </section>
      <div class="scratch-setup">
        <label class="scratch-field">
          <span>Size</span>
          <select
            value={size}
            onchange={(e) => changeSize(Number(e.target.value))}
            disabled={hasMovesPlaced}
          >
            <option value={9}>9×9</option>
            <option value={13}>13×13</option>
            <option value={19}>19×19</option>
          </select>
        </label>
        <label class="scratch-field">
          <span>Black</span>
          <input type="text" bind:value={blackName} disabled={!!gameId} />
        </label>
        <label class="scratch-field">
          <span>White</span>
          <input type="text" bind:value={whiteName} disabled={!!gameId} />
        </label>
      </div>
    </div>
  </aside>

  <div class="round__app">
    <div class="round__app__table"></div>

    <div class="round__app__board">
      <div class="round__app__board__inner">
        <GoBoard
          signMap={analysis.signMap}
          lastMove={analysis.currentNode?.lastMove}
          animatedVertex={analysis.animatedVertex}
          {size}
          showCoords={boardSettings.showCoords}
          currentSign={analysis.hoverSign}
          markerMap={analysis.markerMap}
          childrenMap={analysis.childrenMap}
          areaMap={analysis.displayAreaMap}
          deadStones={analysis.displayDeadStones}
          onVertexClick={(x, y) => analysis.onVertexClick(x, y)}
        />
      </div>
    </div>

    <PlayerStrip color="white" name={whiteName} position="top" />

    <div class="rmoves">
      <AnalysisMoves
        analysisMoveRows={analysis.moveRows}
        analysisNode={analysis.currentNode}
        boardSize={size}
        onSelectNode={(node) => {
          analysis.currentNode = node;
          analysis.animatedVertex = null;
        }}
      />
      {#if analysis.variationCount > 1}
        <div class="variation-nav">
          Variation {analysis.variationIndex + 1} of {analysis.variationCount}
          <button
            class="var-nav-btn"
            onclick={() => analysis.navigate('prev-variation')}
            disabled={analysis.variationIndex <= 0}>◀</button
          >
          <button
            class="var-nav-btn"
            onclick={() => analysis.navigate('next-variation')}
            disabled={analysis.variationIndex >= analysis.variationCount - 1}>▶</button
          >
        </div>
      {/if}
    </div>

    <div class="rgraph">
      <GameGraph
        root={analysis.root}
        currentNode={analysis.currentNode}
        version={analysis.version}
        onSelectNode={(node) => {
          analysis.currentNode = node;
          analysis.animatedVertex = null;
        }}
      />
    </div>

    <div class="rcontrols">
      {#if !gameId}
        <button class="button button-green" onclick={saveGame}>Save game</button>
      {/if}
      <button class="button button-metal" onclick={downloadSgf}>Download SGF</button>
      <button class="button button-metal" onclick={() => fileInput.click()}>Import SGF</button>
    </div>

    <NavigationButtons
      canPrev={analysis.canGoPrev}
      canNext={analysis.canGoNext}
      onFirst={() => analysis.navigate('first')}
      onPrev={() => analysis.navigate('prev')}
      onNext={() => analysis.navigate('next')}
      onLast={() => analysis.navigate('last')}
    />

    <PlayerStrip color="black" name={blackName} position="bottom" active={true} />
  </div>
</div>

<input
  type="file"
  accept=".sgf"
  style="display: none"
  bind:this={fileInput}
  onchange={importSgfFile}
/>

<style>
  :global(.rmoves) {
    justify-content: flex-start !important;
    padding: 0 !important;
  }

  .scratch-setup {
    display: flex;
    flex-direction: column;
    gap: 0.5em;
    padding: 0.6em 0.8em;
  }

  .scratch-field {
    display: flex;
    align-items: center;
    gap: 0.5em;
    font-size: 0.85em;
  }

  .scratch-field span {
    width: 3.5em;
    color: var(--c-font-dim);
    flex-shrink: 0;
  }

  .scratch-field input,
  .scratch-field select {
    flex: 1;
    background: var(--c-bg-input, var(--c-bg-zebra));
    border: 1px solid var(--c-border);
    border-radius: 3px;
    color: var(--c-font);
    padding: 0.2em 0.4em;
    font-size: 1em;
  }

  .scratch-field select:disabled {
    opacity: 0.5;
    cursor: default;
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
</style>
