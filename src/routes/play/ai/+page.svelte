<script>
  import { onMount, tick } from 'svelte';
  import { page } from '$app/state';
  import influence from '@sabaki/influence';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import PlayerStrip from '$lib/game/PlayerStrip.svelte';
  import NavigationButtons from '$lib/game/NavigationButtons.svelte';
  import GameStatusMessage from '$lib/game/GameStatusMessage.svelte';
  import GameControls from '$lib/game/GameControls.svelte';
  import { boardSettings } from '$lib/nav/boardSettings.svelte.js';
  import { GameState } from '$lib/game/GameState.svelte.js';
  import { computeVertexSize } from '$lib/game/layout.js';
  import { createBoard } from '$lib/game/board';
  import {
    computeScore,
    buildScoreBoard,
    toggleDeadStones,
    scoreVerdictShort
  } from '$lib/game/board';
  import GameMeta from '$lib/game/GameMeta.svelte';
  import ModelManager from '$lib/ai/ModelManager.svelte';
  import { initEngine, generateMove, hasModel, isReady, dispose } from '$lib/ai/engine.js';

  const KOMI = 6.5;

  const params = page.url.searchParams;
  const boardSize = Number(params.get('size') || 19);
  const difficulty = Number(params.get('difficulty') || 5);

  const colorParam = params.get('color') || 'black';
  const humanSign =
    colorParam === 'white' ? -1 : colorParam === 'random' ? (Math.random() < 0.5 ? 1 : -1) : 1;
  const aiSign = humanSign === 1 ? -1 : 1;
  const humanColor = humanSign === 1 ? 'black' : 'white';
  const aiColor = humanSign === 1 ? 'white' : 'black';

  let boardContainerWidth = $state(0);
  let boardContainerHeight = $state(0);
  let aiThinking = $state(false);
  let showModelPrompt = $state(false);
  let engineError = $state(null);
  let engineLoading = $state(true);

  let gs = $state(new GameState({ isLocal: true }));
  let moveHistory = $state([]);

  function initGame() {
    gs.boardSize = boardSize;
    gs.board = createBoard(boardSize);
    gs.boardHistory = [gs.board];
    gs.lastMoveHistory = [null];
    gs.status = 'playing';
    gs.mySign = humanSign;
    gs.currentSign = 1;
  }

  initGame();

  onMount(() => {
    hasModel().then(async (found) => {
      if (found) {
        try {
          await initEngine();
          engineLoading = false;
          if (aiSign === 1) {
            triggerAiMove();
          }
        } catch (e) {
          engineError = e.message;
          engineLoading = false;
        }
      } else {
        showModelPrompt = true;
        engineLoading = false;
      }
    });

    return () => {
      dispose();
    };
  });

  async function onModelSaved() {
    showModelPrompt = false;
    engineLoading = true;
    engineError = null;
    try {
      await initEngine();
      engineLoading = false;
      if (aiSign === 1 && moveHistory.length === 0) {
        triggerAiMove();
      }
    } catch (err) {
      engineError = err.message;
      engineLoading = false;
    }
  }

  const vertexSize = $derived(
    computeVertexSize(boardContainerWidth, boardContainerHeight, gs.boardSize)
  );
  const displayBoard = $derived(gs.viewBoard);
  const signMap = $derived(displayBoard.signMap);
  const blackCaptures = $derived(displayBoard.getCaptures(1));
  const whiteCaptures = $derived(displayBoard.getCaptures(-1));
  const humanCaptures = $derived(humanSign === 1 ? blackCaptures : whiteCaptures);
  const aiCaptures = $derived(humanSign === 1 ? whiteCaptures : blackCaptures);

  const isMyTurn = $derived(gs.status === 'playing' && gs.currentSign === humanSign && !aiThinking);

  const scoreBoard = $derived.by(() => {
    if (gs.status !== 'scoring') return displayBoard;
    return buildScoreBoard(gs.board, gs.deadStones);
  });
  const areaMap = $derived(gs.status === 'scoring' ? influence.areaMap(scoreBoard.signMap) : null);
  const score = $derived(areaMap ? computeScore(areaMap, gs.boardSize, KOMI) : null);

  async function triggerAiMove() {
    if (!isReady()) return;
    await tick();
    aiThinking = true;
    try {
      const result = await generateMove(gs.board.signMap, aiSign, KOMI, moveHistory, difficulty);
      if (result.move === 'pass') {
        applyPass(aiSign);
      } else {
        const moveResult = gs.board.analyzeMove(aiSign, [result.x, result.y]);
        if (moveResult.overwrite || moveResult.suicide || moveResult.ko) {
          applyPass(aiSign);
        } else {
          gs.applyMove(result.x, result.y, aiSign);
          moveHistory.push({ color: aiSign, x: result.x, y: result.y });
        }
      }
    } catch (err) {
      console.error('[AI] Move generation failed:', err);
    }
    aiThinking = false;
  }

  function applyPass(sign) {
    gs.consecutivePasses++;
    gs.lastMove = null;
    gs.animatedVertex = null;
    gs.currentSign = sign === 1 ? -1 : 1;
    gs.recordPass();
    moveHistory.push({ color: sign, x: -1, y: -1 });
    if (gs.consecutivePasses >= 2) {
      gs.status = 'scoring';
      gs.deadStones = [];
      gs.blackApproved = false;
      gs.whiteApproved = false;
    }
  }

  function onVertexClick(x, y) {
    if (gs.status === 'playing') {
      if (!isMyTurn) return;
      const moveResult = gs.board.analyzeMove(humanSign, [x, y]);
      if (moveResult.overwrite || moveResult.suicide || moveResult.ko) return;
      gs.applyMove(x, y, humanSign);
      moveHistory.push({ color: humanSign, x, y });
      triggerAiMove();
    } else if (gs.status === 'scoring') {
      gs.deadStones = toggleDeadStones(gs.board, gs.deadStones, x, y);
      gs.blackApproved = false;
      gs.whiteApproved = false;
    }
  }

  function pass() {
    if (!isMyTurn) return;
    applyPass(humanSign);
    if (gs.consecutivePasses < 2) {
      triggerAiMove();
    }
  }

  function resign() {
    gs.status = 'gameover';
    gs.winner = aiSign;
    gs.winnerResult = aiSign === -1 ? 'W+R' : 'B+R';
  }

  function approveScore() {
    gs.blackApproved = true;
    gs.whiteApproved = true;
    const finalScore = score;
    const winner = finalScore.blackScore > finalScore.whiteScore ? 1 : -1;
    gs.status = 'gameover';
    gs.winner = winner;
    gs.finalScore = finalScore;
  }

  function handleKeydown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      gs.jumpPrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      gs.jumpNext();
    } else if (e.key === 'Home') {
      e.preventDefault();
      gs.jumpFirst();
    } else if (e.key === 'End') {
      e.preventDefault();
      gs.jumpLast();
    }
  }

  $effect(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });
</script>

{#if showModelPrompt}
  <dialog class="ai-model-dialog" open>
    <h2>AI Model Required</h2>
    <p>To play against the AI, download a KataGo ONNX model.</p>
    <ModelManager onSaved={onModelSaved} />
  </dialog>
{/if}

{#if engineError}
  <div class="ai-error">{engineError}</div>
{/if}

<div class="round">
  <aside class="round__side">
    <GameMeta
      boardSize={gs.boardSize}
      status={gs.status}
      winner={gs.winner}
      winnerResult={gs.winnerResult}
      mySign={humanSign}
      isLocal={true}
      isSpectator={false}
      blackName={humanSign === 1 ? 'You' : `AI (strength ${difficulty})`}
      whiteName={humanSign === -1 ? 'You' : `AI (strength ${difficulty})`}
    />
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
        lastMove={gs.viewLastMove}
        shiftMap={gs.viewShiftMap}
        animatedVertex={gs.isViewingHistory ? null : gs.animatedVertex}
        size={gs.boardSize}
        {vertexSize}
        {areaMap}
        deadStones={gs.status === 'scoring' ? gs.deadStones : null}
        showCoords={boardSettings.showCoords}
        currentSign={gs.currentSign}
        interactive={isMyTurn || gs.status === 'scoring'}
        onVertexClick={!gs.isViewingHistory && (gs.status === 'playing' || gs.status === 'scoring')
          ? onVertexClick
          : null}
      />
    </div>

    <PlayerStrip
      color={aiColor}
      name={aiThinking ? 'AI (thinking...)' : `AI (strength ${difficulty})`}
      captures={aiCaptures}
      position="top"
    />

    <div class="rmoves">
      {#if engineLoading}
        <div class="ai-status">Loading AI engine...</div>
      {:else if aiThinking}
        <div class="ai-status">AI is thinking...</div>
      {:else}
        <GameStatusMessage
          status={gs.status}
          isLocal={true}
          isSpectator={false}
          {isMyTurn}
          myColor={humanColor}
          mySign={humanSign}
          currentSign={gs.currentSign}
          isCorrGame={false}
          {score}
          komi={KOMI}
          blackApproved={gs.blackApproved}
          whiteApproved={gs.whiteApproved}
          winner={gs.winner}
          winnerResult={gs.winnerResult}
          finalScore={gs.finalScore}
        />
      {/if}
    </div>

    <div class="rcontrols">
      <GameControls
        status={gs.status}
        isSpectator={false}
        {isMyTurn}
        isLocal={true}
        myColor={humanColor}
        analysisMode={false}
        blackApproved={gs.blackApproved}
        whiteApproved={gs.whiteApproved}
        opponentOnline={null}
        onPass={pass}
        onResign={resign}
        onAbort={() => {}}
        onApproveScore={approveScore}
        onApproveBlack={() => {
          gs.blackApproved = true;
        }}
        onApproveWhite={() => {
          gs.whiteApproved = true;
        }}
        onAnalysis={() => {}}
        onExitAnalysis={() => {}}
      />
    </div>

    {#if gs.totalPly > 0}
      <NavigationButtons
        canPrev={gs.currentViewPly > 0}
        canNext={gs.currentViewPly < gs.totalPly}
        onFirst={() => gs.jumpFirst()}
        onPrev={() => gs.jumpPrev()}
        onNext={() => gs.jumpNext()}
        onLast={() => gs.jumpLast()}
      />
    {/if}

    <PlayerStrip color={humanColor} name="You" captures={humanCaptures} position="bottom" />
  </div>
</div>

<style>
  .ai-model-dialog {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: var(--c-bg-box, #2b2b2b);
    color: var(--c-font, #ddd);
    border: 1px solid var(--c-border, #555);
    border-radius: 8px;
    padding: 2rem;
    z-index: 1000;
    max-width: 420px;
  }

  .ai-model-dialog h2 {
    margin: 0 0 0.75rem;
  }

  .ai-model-dialog p {
    margin: 0 0 1rem;
    line-height: 1.5;
    color: var(--c-font-dim, #999);
  }

  .ai-status {
    padding: 0.5rem 1rem;
    text-align: center;
    color: var(--c-font-dim, #999);
    font-style: italic;
  }

  .ai-error {
    background: #c0392b;
    color: white;
    padding: 0.5rem 1rem;
    text-align: center;
  }
</style>
