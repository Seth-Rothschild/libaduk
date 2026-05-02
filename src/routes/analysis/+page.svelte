<script>
  import { onMount, onDestroy } from 'svelte';
  import { createBoard } from '$lib/game/board';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import PlayerStrip from '$lib/game/PlayerStrip.svelte';
  import NavigationButtons from '$lib/game/NavigationButtons.svelte';
  import AnalysisMoves from '$lib/game/AnalysisMoves.svelte';
  import AnalysisControls from '$lib/game/AnalysisControls.svelte';
  import AnalysisInfo from '$lib/game/AnalysisInfo.svelte';
  import EditBar from '$lib/game/EditBar.svelte';
  import GameGraph from '$lib/game/GameGraph.svelte';
  import {
    AnalysisState,
    makeAnalysisNode,
    getAnalysisMoveName
  } from '$lib/game/analysisState.svelte.js';
  import { MemorizeState } from '$lib/game/memorizeState.svelte.js';
  import { page } from '$app/state';
  import { boardSettings } from '$lib/nav/boardSettings.svelte.js';
  import {
    clampBoardSize,
    emptyMarkerMap,
    applySetup,
    exportSgf,
    parseSgf,
    sgfNodeToMove,
    sgfNodeMarkers,
    sgfNodeComment,
    sgfNodeSetup
  } from '$lib/game/board';

  let { data } = $props();

  const gameData = data.game;
  const defaultSize = gameData ? gameData.size : Number(page.url.searchParams.get('size') ?? 19);
  const SIZE = clampBoardSize(defaultSize);

  const komi = gameData?.komi ?? 6.5;
  const analysis = new AnalysisState(SIZE, komi);

  const handicapStones = gameData?.handicapStones ?? [];
  if (gameData && (gameData.moves.length > 0 || handicapStones.length > 0)) {
    analysis.loadMoves(gameData.moves, handicapStones);
  }

  let blackName = $state(gameData?.blackName ?? 'Black');
  let whiteName = $state(gameData?.whiteName ?? 'White');

  let fileInput;

  const memorize = new MemorizeState(analysis, SIZE);

  function downloadSgf() {
    const sgf = exportSgf(analysis.root, SIZE, { playerBlack: blackName, playerWhite: whiteName });
    const blob = new Blob([sgf], { type: 'application/x-go-sgf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analysis.sgf';
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
    if (!parsed || parsed.size !== SIZE) return;

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

      const setup = sgfNodeSetup(sgfNode, SIZE);
      newBoard = applySetup(newBoard, setup);

      const markers = sgfNodeMarkers(sgfNode, SIZE);
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

    const newRoot = buildNode(parsed.root, createBoard(SIZE), 1, null);
    if (!newRoot) return;

    blackName = parsed.playerBlack || 'Black';
    whiteName = parsed.playerWhite || 'White';
    analysis.setRoot(newRoot);
  }

  function clearBoard() {
    analysis.clear();
    blackName = 'Black';
    whiteName = 'White';
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
    if (memorize.active) return;
    const action = keyMap[e.key];
    if (action) {
      e.preventDefault();
      analysis.navigate(action);
    }
  }

  onMount(() => document.addEventListener('keydown', handleKeydown));
  onDestroy(() => document.removeEventListener('keydown', handleKeydown));
</script>

<div class="round">
  <aside class="round__side">
    <div class="game__meta">
      <section>
        <div class="game__meta__infos" data-icon="&#xe015;">
          <div class="setup">Analysis • {SIZE}×{SIZE}</div>
        </div>
      </section>
      <AnalysisInfo
        blackCaptures={analysis.blackCaptures}
        whiteCaptures={analysis.whiteCaptures}
        currentNode={analysis.currentNode}
        boardSize={SIZE}
        comment={analysis.currentComment}
        onCommentChange={(text) => analysis.setComment(text)}
      />
    </div>
  </aside>

  <div class="round__app">
    <div class="round__app__table"></div>

    <div class="round__app__board" class:round__app__board--with-editbar={!memorize.active}>
      <div class="round__app__board__inner">
        <GoBoard
          signMap={analysis.signMap}
          lastMove={analysis.currentNode?.lastMove}
          animatedVertex={analysis.animatedVertex}
          size={SIZE}
          showCoords={boardSettings.showCoords}
          currentSign={analysis.hoverSign}
          markerMap={memorize.markerMap}
          childrenMap={memorize.active ? null : analysis.childrenMap}
          areaMap={analysis.displayAreaMap}
          deadStones={analysis.displayDeadStones}
          onVertexClick={(x, y) =>
            memorize.active ? memorize.click(x, y) : analysis.onVertexClick(x, y)}
        />
      </div>
      {#if !memorize.active}
        <EditBar tool={analysis.tool} onSetTool={(t) => (analysis.tool = t)} />
      {/if}
    </div>

    <PlayerStrip color="white" name={whiteName} position="top" />

    <div class="rmoves">
      <AnalysisMoves
        analysisMoveRows={analysis.moveRows}
        analysisNode={analysis.currentNode}
        boardSize={SIZE}
        onSelectNode={memorize.active
          ? null
          : (node) => {
              analysis.currentNode = node;
              analysis.animatedVertex = null;
            }}
      />
      {#if analysis.variationCount > 1 && !memorize.active}
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

    {#if !memorize.active}
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
    {/if}

    <div class="rcontrols">
      {#if memorize.active}
        <div
          class="memorize-status"
          class:flash-correct={memorize.flash === 'correct'}
          class:flash-wrong={memorize.flash === 'wrong'}
        >
          {#if memorize.done}
            Done — {memorize.total} moves
          {:else}
            Move {memorize.index + 1} / {memorize.total}
            {#if memorize.hintText}<span class="hint-text">· {memorize.hintText}</span>{/if}
          {/if}
        </div>
        <fieldset class="hint-fieldset">
          <legend>Hint</legend>
          <div class="hint-buttons">
            <button class="hint-btn" onclick={() => memorize.applyHint('quadrant')}>Quadrant</button>
            <button class="hint-btn" onclick={() => memorize.applyHint('grid16')}>16</button>
            <button class="hint-btn" onclick={() => memorize.applyHint('grid9')}>9</button>
            <button class="hint-btn" onclick={() => memorize.applyHint('grid4')}>4</button>
          </div>
        </fieldset>
        <button class="button button-metal" onclick={() => memorize.exit()}>Back to game</button>
      {:else}
        <AnalysisControls
          status={analysis.status}
          score={analysis.score}
          estimatedScore={analysis.estimatedScore}
          showEstimate={analysis.showEstimate}
          onStartScoring={() => analysis.startScoring()}
          onStopScoring={() => analysis.stopScoring()}
          onToggleEstimate={() => (analysis.showEstimate = !analysis.showEstimate)}
          onClear={clearBoard}
          onDownloadSgf={downloadSgf}
          onImportSgf={() => fileInput.click()}
        />
        <button class="button button-metal" onclick={() => memorize.enter()}>Memorize</button>
      {/if}
    </div>

    {#if !memorize.active}
      <NavigationButtons
        canPrev={analysis.canGoPrev}
        canNext={analysis.canGoNext}
        onFirst={() => analysis.navigate('first')}
        onPrev={() => analysis.navigate('prev')}
        onNext={() => analysis.navigate('next')}
        onLast={() => analysis.navigate('last')}
      />
    {/if}

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

  .hint-fieldset {
    border: 1px solid var(--c-border);
    border-radius: 4px;
    margin: 0.4em;
    padding: 0 0.4em 0.4em;
  }

  .hint-fieldset legend {
    padding: 0 0.3em;
    font-size: 0.75em;
    color: var(--c-font-dim);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .hint-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4em;
  }

  .hint-btn {
    flex: 1;
    padding: 0.35em 0.5em;
    font-size: 0.8em;
    font-weight: 600;
    background: var(--c-bg-zebra);
    border: 1px solid var(--c-border);
    border-radius: 4px;
    color: var(--c-font);
    cursor: pointer;
    transition:
      background 0.1s,
      border-color 0.1s;
    white-space: nowrap;
  }

  .hint-btn:hover {
    background: var(--c-accent, #5c8a5c);
    border-color: var(--c-accent, #5c8a5c);
    color: #fff;
  }

  .hint-text {
    color: var(--c-font-dim);
    font-style: italic;
  }

  .memorize-status {
    display: flex;
    align-items: center;
    gap: 0.6em;
    padding: 0.4em 0.6em;
    font-size: 0.85em;
    color: var(--c-font);
    background: var(--c-bg-zebra);
    border-radius: 3px;
    margin: 0.3em 0.4em;
    transition: background 0.15s;
  }

  .memorize-status.flash-correct {
    background: #2d6a2d;
    color: #fff;
  }

  .memorize-status.flash-wrong {
    background: #7a2020;
    color: #fff;
  }
</style>
