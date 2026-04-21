<script>
  import { untrack } from 'svelte';
  import { page } from '$app/state';
  import influence from '@sabaki/influence';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import Clock from '$lib/game/Clock.svelte';
  import PlayerStrip from '$lib/game/PlayerStrip.svelte';
  import NavigationButtons from '$lib/game/NavigationButtons.svelte';
  import { boardSettings } from '$lib/nav/boardSettings.svelte.js';
  import { getGuestId } from '$lib/state/guestId.js';
  import { getMe } from '$lib/state/user.svelte.js';
  import { GameState } from '$lib/game/GameState.svelte.js';
  import {
    AnalysisState,
    serializeTree,
    getNodePath,
    followNodePath
  } from '$lib/game/analysisState.svelte.js';
  import { gameSocket } from '$lib/state/socket.svelte.js';
  import GameChat from '$lib/game/GameChat.svelte';
  import GameMeta from '$lib/game/GameMeta.svelte';
  import GameStatusMessage from '$lib/game/GameStatusMessage.svelte';
  import GameControls from '$lib/game/GameControls.svelte';
  import AnalysisControls from '$lib/game/AnalysisControls.svelte';
  import AnalysisMoves from '$lib/game/AnalysisMoves.svelte';
  import EditBar from '$lib/game/EditBar.svelte';
  import GameGraph from '$lib/game/GameGraph.svelte';
  import JoinGameModal from '$lib/game/JoinGameModal.svelte';
  import { computeVertexSize } from '$lib/game/layout.js';
  import {
    colorName,
    computeScore,
    buildScoreBoard,
    toggleDeadStones,
    scoreVerdictShort
  } from '$lib/game/board';
  import { initEngine, generateMove, hasModel, isReady, dispose } from '$lib/ai/engine.js';
  import ModelManager from '$lib/ai/ModelManager.svelte';

  function getOgsToken() {
    for (const pair of document.cookie.split(';')) {
      const [key, value] = pair.trim().split('=');
      if (key === 'ogs_token') return decodeURIComponent(value);
    }
    return null;
  }

  let { data } = $props();
  const username = $derived(data.user?.username ?? '');
  const displayName = $derived(username || getGuestId());

  let komi = $state(data.game.komi ?? 6.5);

  const gameId = $derived(page.params.gameId);
  const isOgs = $derived(data.game.gameType === 'ogs');

  let boardContainerWidth = $state(0);
  let boardContainerHeight = $state(0);
  let chatMessages = $state(data.chat ?? []);
  let blackName = $state(data.game.blackName ?? null);
  let whiteName = $state(data.game.whiteName ?? null);
  let blackOnline = $state(false);
  let whiteOnline = $state(false);

  const isAI = $derived(data.game.gameType === 'ai');
  const aiDifficulty = $derived(data.game.aiDifficulty ?? 5);
  let aiThinking = $state(false);
  let aiMoveHistory = $state([]);
  let showModelPrompt = $state(false);
  let engineError = $state(null);
  let engineLoading = $state(false);

  function handleChatSend(text) {
    chatMessages.push({ user: displayName, text });
    fetch('/api/game/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, user: displayName, text })
    });
  }

  let gs = $state(new GameState());

  const vertexSize = $derived(
    computeVertexSize(boardContainerWidth, boardContainerHeight, gs.boardSize)
  );
  const displayBoard = $derived(gs.viewBoard);
  const signMap = $derived(displayBoard.signMap);
  const blackCaptures = $derived(displayBoard.getCaptures(1));
  const whiteCaptures = $derived(displayBoard.getCaptures(-1));

  const showJoinModal = $derived(gs.status === 'waiting' && gs.mySign === null && !isOgs);

  function handleJoined(color) {
    gs.mySign = color === 'black' ? 1 : -1;
    gs.status = 'playing';
    if (color === 'black') blackName = displayName;
    else whiteName = displayName;
    gameSocket.send({ type: 'join', gameId, color });
  }

  const isSpectator = $derived(gs.mySign === null);
  const mySign = $derived(gs.mySign ?? -1);
  const myColor = $derived(colorName(mySign));
  const oppColor = $derived(myColor === 'black' ? 'white' : 'black');
  const myCaptures = $derived(mySign === 1 ? blackCaptures : whiteCaptures);
  const opponentCaptures = $derived(mySign === 1 ? whiteCaptures : blackCaptures);

  const isCorrGame = $derived(gs.timeControl.type === 'correspondence');
  const isMyTurn = $derived(
    !isSpectator &&
      gs.status === 'playing' &&
      gs.timedOutColor === null &&
      !aiThinking &&
      gs.currentSign === mySign
  );

  function handleTimeout(loser) {
    if (gs.status !== 'playing') return;
    gs.timedOutColor = loser;
    gs.status = 'gameover';
    const winnerColor = loser === 'black' ? 'white' : 'black';
    gs.winner = winnerColor === 'black' ? 1 : -1;
    gs.winnerResult = `${winnerColor === 'black' ? 'B' : 'W'}+T`;
    fetch('/api/game/finish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId,
        winner: winnerColor,
        result: gs.winnerResult
      })
    });
  }

  const hasClock = $derived(
    gs.timeControl.type !== 'none' && gs.timeControl.type !== 'correspondence'
  );
  const initialMs = $derived(hasClock ? (gs.timeControl.initial ?? 0) * 1000 : null);
  const previewClockData = $derived.by(() => {
    if (!hasClock) return null;
    const mainMs = (gs.timeControl.initial ?? 0) * 1000;
    const isByoyomi = gs.timeControl.type === 'byoyomi';
    return {
      mainMs,
      byoMs: isByoyomi ? (gs.timeControl.periodTime ?? 30) * 1000 : 0,
      byoPeriods: isByoyomi ? (gs.timeControl.periods ?? 5) : 0,
      inByoYomi: isByoyomi && mainMs === 0
    };
  });

  const myClockData = $derived(gs.clockState?.[myColor] ?? previewClockData);
  const oppClockData = $derived(gs.clockState?.[oppColor] ?? previewClockData);

  const myClockRunning = $derived(
    gs.status === 'playing' &&
      !!gs.clockState?.turnStartedAt &&
      gs.clockState?.activeColor === myColor
  );
  const oppClockRunning = $derived(
    gs.status === 'playing' &&
      !!gs.clockState?.turnStartedAt &&
      gs.clockState?.activeColor === oppColor
  );

  const scoreBoard = $derived.by(() => {
    if (gs.status !== 'scoring') return displayBoard;
    return buildScoreBoard(gs.board, gs.deadStones);
  });

  const areaMap = $derived(gs.status === 'scoring' ? influence.areaMap(scoreBoard.signMap) : null);
  const score = $derived(areaMap ? computeScore(areaMap, gs.boardSize, komi) : null);

  const displayDeadStones = $derived(
    gs.status === 'scoring' || gs.status === 'gameover' ? gs.deadStones : null
  );

  // --- AI move logic ---

  const aiSign = $derived(isAI ? (mySign === 1 ? -1 : 1) : null);
  const aiColor = $derived(isAI ? colorName(aiSign) : null);

  function buildAiMoveHistory() {
    const moves = data.game.moves ?? [];
    return moves.map((m, i) => {
      const color = i % 2 === 0 ? 1 : -1;
      if (m.type === 'pass') return { color, x: -1, y: -1 };
      return { color, x: m.x, y: m.y };
    });
  }

  async function triggerAiMove() {
    if (!isAI || !isReady() || aiThinking) return;
    if (gs.status !== 'playing') return;
    if (gs.currentSign !== aiSign) return;

    aiThinking = true;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const result = await generateMove(
        gs.board.signMap,
        aiSign,
        komi,
        aiMoveHistory,
        aiDifficulty
      );
      if (gs.status !== 'playing') return;

      if (result.move === 'pass') {
        applyAiPass();
      } else {
        const moveResult = gs.board.analyzeMove(aiSign, [result.x, result.y]);
        if (moveResult.overwrite || moveResult.suicide || moveResult.ko) {
          applyAiPass();
        } else {
          gs.applyMove(result.x, result.y, aiSign);
          gs.tickClock();
          aiMoveHistory.push({ color: aiSign, x: result.x, y: result.y });
          gameSocket.send({ type: 'move', x: result.x, y: result.y });
        }
      }
    } catch (err) {
      console.error('[AI] Move generation failed:', err);
    }
    aiThinking = false;
  }

  function applyAiPass() {
    gs.consecutivePasses++;
    gs.lastMove = null;
    gs.animatedVertex = null;
    gs.currentSign = gs.currentSign === 1 ? -1 : 1;
    gs.recordPass();
    gs.tickClock();
    aiMoveHistory.push({ color: aiSign, x: -1, y: -1 });
    gameSocket.send({ type: 'pass' });
    if (gs.consecutivePasses >= 2) {
      gs.status = 'scoring';
      gs.deadStones = [];
      gs.blackApproved = false;
      gs.whiteApproved = false;
    }
  }

  async function initAiEngine() {
    if (isSpectator || !isAI) return;
    engineLoading = true;
    engineError = null;
    const found = await hasModel();
    if (!found) {
      showModelPrompt = true;
      engineLoading = false;
      return;
    }
    try {
      await initEngine();
      engineLoading = false;
      aiMoveHistory = buildAiMoveHistory();
      if (gs.status === 'playing' && gs.currentSign === aiSign) {
        triggerAiMove();
      }
    } catch (e) {
      engineError = e.message;
      engineLoading = false;
    }
  }

  async function onModelSaved() {
    showModelPrompt = false;
    engineLoading = true;
    engineError = null;
    try {
      await initEngine();
      engineLoading = false;
      aiMoveHistory = buildAiMoveHistory();
      if (gs.status === 'playing' && gs.currentSign === aiSign) {
        triggerAiMove();
      }
    } catch (err) {
      engineError = err.message;
      engineLoading = false;
    }
  }

  // --- Analysis mode ---

  let analysis = $state(null);
  const analysisMode = $derived(analysis !== null);

  // Tracks the latest analysis tree. data.game.analysisTree is a page-load snapshot
  // and goes stale as moves are made, so we keep our own up-to-date copy.
  let savedAnalysisTree = data.game.analysisTree ?? null;

  function enterAnalysisFromTree(tree) {
    analysis = new AnalysisState(gs.boardSize, komi);
    analysis.loadTree(tree);
  }

  function enterAnalysisFromMoves() {
    analysis = new AnalysisState(gs.boardSize, komi);
    const handicapStones = data.game.handicapStones ?? [];
    const moves = [];
    for (let i = 1; i < gs.lastMoveHistory.length; i++) {
      const vertex = gs.lastMoveHistory[i];
      if (vertex) {
        moves.push({ type: 'move', x: vertex[0], y: vertex[1] });
      } else {
        moves.push({ type: 'pass' });
      }
    }
    analysis.loadMoves(moves, handicapStones);
  }

  function enterAnalysis() {
    if (analysis) return;
    if (savedAnalysisTree) {
      enterAnalysisFromTree(savedAnalysisTree);
    } else {
      enterAnalysisFromMoves();
    }
    const tree = serializeTree(analysis.root);
    gameSocket.send({ type: 'analysis-enter', tree });
  }

  function exitAnalysis() {
    savedAnalysisTree = serializeTree(analysis.root);
    analysis = null;
    gameSocket.send({ type: 'analysis-exit' });
  }

  function persistAnalysisTree() {
    const tree = serializeTree(analysis.root);
    savedAnalysisTree = tree;
    gameSocket.send({ type: 'analysis-tree', tree });
  }

  function onAnalysisVertexClick(x, y) {
    analysis.onVertexClick(x, y);
    gameSocket.send({ type: 'analysis-move', x, y, tool: analysis.tool });
    persistAnalysisTree();
  }

  function navigateAnalysisTo(node) {
    analysis.currentNode = node;
    analysis.animatedVertex = null;
    const path = getNodePath(node);
    gameSocket.send({ type: 'analysis-navigate', path });
  }

  // --- Game actions ---

  function onVertexClick(x, y) {
    if (isSpectator) return;
    if (gs.status === 'playing') {
      if (!isMyTurn) return;
      const movingSign = mySign;
      const moveResult = gs.board.analyzeMove(movingSign, [x, y]);
      if (moveResult.overwrite || moveResult.suicide || moveResult.ko) return;
      if (isAI) {
        gs.applyMove(x, y, movingSign);
        gs.tickClock();
        aiMoveHistory.push({ color: movingSign, x, y });
        gameSocket.send({ type: 'move', x, y });
        triggerAiMove();
      } else {
        gameSocket.send({ type: 'move', x, y });
      }
    } else if (gs.status === 'scoring') {
      gameSocket.send({ type: 'scoring-mark', x, y });
    }
  }

  function resumePlay() {
    gameSocket.send({ type: 'scoring-resume' });
  }

  function pass() {
    if (!isMyTurn) return;
    if (isAI) {
      applyPass();
      aiMoveHistory.push({ color: mySign, x: -1, y: -1 });
      gameSocket.send({ type: 'pass' });
      if (gs.consecutivePasses < 2) {
        triggerAiMove();
      }
    } else {
      gameSocket.send({ type: 'pass' });
    }
  }

  function applyPass() {
    gs.consecutivePasses++;
    gs.lastMove = null;
    gs.animatedVertex = null;
    gs.currentSign = gs.currentSign === 1 ? -1 : 1;
    gs.recordPass();
    gs.tickClock();
    if (gs.consecutivePasses >= 2) {
      gs.status = 'scoring';
      gs.deadStones = [];
      gs.blackApproved = false;
      gs.whiteApproved = false;
    }
  }

  function cancel() {
    gameSocket.send({ type: 'cancel' });
  }

  function serializeClockState() {
    if (!gs.clockState) return null;
    return {
      black: { ...gs.clockState.black },
      white: { ...gs.clockState.white }
    };
  }

  function resign() {
    const winner = myColor === 'black' ? 'white' : 'black';
    const result = winner === 'white' ? 'W+R' : 'B+R';
    gs.status = 'gameover';
    gs.winner = winner === 'black' ? 1 : -1;
    gs.winnerResult = result;
    gameSocket.send({ type: 'gameover', winner, result, clockState: serializeClockState() });
  }

  function forceResign() {
    const result = myColor === 'white' ? 'W+R' : 'B+R';
    gameSocket.send({
      type: 'gameover',
      winner: myColor,
      result,
      clockState: serializeClockState()
    });
  }

  function approveScore() {
    if (myColor === 'black') gs.blackApproved = true;
    else gs.whiteApproved = true;
    if (isAI) {
      gs.blackApproved = true;
      gs.whiteApproved = true;
    }
    gameSocket.send({ type: 'approve-score', color: myColor });
    checkBothApproved();
  }

  function checkBothApproved() {
    if (!gs.blackApproved || !gs.whiteApproved) return;
    const finalScore = score;
    const winner = finalScore.blackScore > finalScore.whiteScore ? 1 : -1;
    const resultString = scoreVerdictShort(finalScore);
    gs.status = 'gameover';
    gs.winner = winner;
    gs.finalScore = finalScore;
    gameSocket.send({
      type: 'gameover',
      winner: winner === 1 ? 'black' : 'white',
      result: resultString,
      clockState: serializeClockState(),
      deadStones: gs.deadStones
    });
  }

  const opponentOnline = $derived(
    isAI || isOgs ? null : oppColor === 'black' ? blackOnline : whiteOnline
  );

  function resolvePlayerName(targetColor) {
    const storedName = targetColor === 'black' ? blackName : whiteName;
    const fallback = targetColor === 'black' ? 'Black' : 'White';
    if (isOgs) {
      const myOgsUsername = getMe()?.ogs?.username;
      if (myOgsUsername && storedName === myOgsUsername) return displayName;
      return storedName ?? fallback;
    }
    if (isSpectator) return storedName ?? fallback;
    if (targetColor === myColor) return displayName;
    return storedName ?? '...';
  }

  function resolveStripName(targetColor) {
    const storedName = targetColor === 'black' ? blackName : whiteName;
    const fallback = gs.status === 'waiting' ? 'Waiting...' : targetColor;
    if (isOgs) {
      const myOgsUsername = getMe()?.ogs?.username;
      if (myOgsUsername && storedName === myOgsUsername) return displayName;
      return storedName ?? fallback;
    }
    if (isSpectator) return storedName ?? (targetColor === 'black' ? 'Black' : 'White');
    if (targetColor === myColor) return displayName;
    return storedName ?? fallback;
  }

  const topStripColor = $derived(isSpectator ? 'black' : oppColor);
  const bottomStripColor = $derived(isSpectator ? 'white' : myColor);

  function handleKeydown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (analysisMode) {
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
        const path = getNodePath(analysis.currentNode);
        gameSocket.send({ type: 'analysis-navigate', path });
      }
      return;
    }
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
    const currentGameId = gameId;

    untrack(() => {
      gs.initFromData(data.game, data.viewerColor);
      if (gs.mySign === null) {
        if (blackName === displayName) gs.mySign = 1;
        else if (whiteName === displayName) gs.mySign = -1;
      }
      chatMessages = data.chat ?? [];

      if (data.game.analysisActive) {
        enterAnalysisFromTree(data.game.analysisTree);
      }

      gameSocket.onMessage((msg) => {
        if (msg.type === 'joined') {
          gs.status = 'playing';
          if (msg.color === 'black') blackName = msg.name;
          else whiteName = msg.name;
        }
        if (msg.type === 'move') {
          const opponentSign = gs.currentSign;
          gs.applyMove(msg.x, msg.y, opponentSign);
          if (msg.clockState) {
            gs.clockState = msg.clockState;
          } else if (!isOgs) {
            gs.tickClock();
          }
        }
        if (msg.type === 'pass') {
          applyPass();
          if (msg.clockState) {
            gs.clockState = msg.clockState;
          }
        }
        if (msg.type === 'approve-score') {
          if (msg.color === 'black') gs.blackApproved = true;
          else gs.whiteApproved = true;
          checkBothApproved();
        }
        if (msg.type === 'scoring-mark') {
          gs.deadStones = toggleDeadStones(gs.board, gs.deadStones, msg.x, msg.y);
          gs.blackApproved = false;
          gs.whiteApproved = false;
        }
        if (msg.type === 'scoring-resume') {
          gs.status = 'playing';
          gs.consecutivePasses = 0;
          gs.deadStones = [];
          gs.blackApproved = false;
          gs.whiteApproved = false;
        }
        if (msg.type === 'chat') {
          const isDuplicate = msg.t
            ? chatMessages.some((m) => m.t === msg.t)
            : chatMessages.some((m) => m.user === msg.user && m.text === msg.text);
          if (!isDuplicate) {
            chatMessages.push({ user: msg.user, text: msg.text, t: msg.t });
          }
        }
        if (msg.type === 'presence') {
          if (msg.color === 'black') blackOnline = msg.online;
          else if (msg.color === 'white') whiteOnline = msg.online;
        }
        if (msg.type === 'gameover') {
          gs.status = 'gameover';
          if (msg.winner) gs.winner = msg.winner === 'black' ? 1 : -1;
          if (msg.result) gs.winnerResult = msg.result;
          if (msg.deadStones) gs.deadStones = msg.deadStones;
        }
        if (msg.type === 'cancel') {
          gs.status = 'cancelled';
        }
        if (msg.type === 'analysis-enter') {
          enterAnalysisFromTree(msg.tree);
        }
        if (msg.type === 'analysis-exit') {
          analysis = null;
        }
        if (msg.type === 'analysis-navigate' && analysis) {
          const target = followNodePath(analysis.root, msg.path);
          analysis.currentNode = target;
          analysis.animatedVertex = null;
        }
        if (msg.type === 'analysis-move' && analysis) {
          const prevTool = analysis.tool;
          analysis.tool = msg.tool ?? 'stone';
          analysis.onVertexClick(msg.x, msg.y);
          analysis.tool = prevTool;
        }
        if (msg.type === 'my-color') {
          gs.mySign = msg.color === 'black' ? 1 : -1;
          if (gs.status === 'waiting') gs.status = 'playing';
          if (msg.komi != null) komi = msg.komi;
          if (gs.totalPly === 0 && msg.handicapStones?.length > 0) {
            for (const [x, y] of msg.handicapStones) {
              gs.applyMove(x, y, 1);
            }
            gs.currentSign = -1;
          }
        }
        if (msg.type === 'clock') {
          gs.clockState = msg.clockState;
        }
        if (msg.type === 'scoring-start') {
          gs.status = 'scoring';
          gs.deadStones = [];
        }
        if (msg.type === 'dead-stones') {
          gs.deadStones = msg.stones;
        }
      });

      const ogsToken = isOgs ? getOgsToken() : null;
      gameSocket.join(currentGameId, data.viewerColor ?? null, ogsToken);

      if (data.game.gameType === 'ai') {
        initAiEngine();
      }

      document.addEventListener('keydown', handleKeydown);
    });

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      gameSocket.onMessage(null);
      gameSocket.leave();
      if (data.game.gameType === 'ai') {
        dispose();
      }
    };
  });
</script>

{#if showModelPrompt}
  <dialog class="ai-model-dialog" open oncancel={(e) => e.preventDefault()}>
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
      {mySign}
      {isSpectator}
      blackName={resolvePlayerName('black')}
      whiteName={resolvePlayerName('white')}
      gameType={data.game.gameType}
      gameUrl={page.url.href}
      ogsGameId={data.game.ogsGameId}
    />
    <GameChat
      {username}
      {gameId}
      gameStatus={gs.status}
      bind:messages={chatMessages}
      initialNote={data.note ?? ''}
      onSend={handleChatSend}
    />
  </aside>

  <div class="round__app">
    <div class="round__app__table"></div>

    <div
      class="round__app__board"
      bind:clientWidth={boardContainerWidth}
      bind:clientHeight={boardContainerHeight}
    >
      {#if analysisMode}
        <GoBoard
          signMap={analysis.signMap}
          lastMove={analysis.currentNode?.lastMove}
          animatedVertex={analysis.animatedVertex}
          size={gs.boardSize}
          {vertexSize}
          showCoords={boardSettings.showCoords}
          currentSign={analysis.currentSign}
          childrenMap={analysis.childrenMap}
          markerMap={analysis.markerMap}
          areaMap={analysis.displayAreaMap}
          deadStones={analysis.displayDeadStones}
          onVertexClick={(x, y) => onAnalysisVertexClick(x, y)}
        />
        <EditBar tool={analysis.tool} onSetTool={(t) => (analysis.tool = t)} />
      {:else}
        <GoBoard
          {signMap}
          lastMove={gs.viewLastMove}
          shiftMap={boardSettings.fuzzyPlacement ? gs.viewShiftMap : null}
          animatedVertex={gs.isViewingHistory ? null : gs.animatedVertex}
          size={gs.boardSize}
          {vertexSize}
          {areaMap}
          deadStones={displayDeadStones}
          showCoords={boardSettings.showCoords}
          currentSign={gs.currentSign}
          interactive={isMyTurn || gs.status === 'scoring'}
          onVertexClick={!gs.isViewingHistory &&
          (gs.status === 'playing' || gs.status === 'scoring')
            ? onVertexClick
            : null}
        />
      {/if}
    </div>

    {#if hasClock || gs.clockState}
      <Clock
        clockData={oppClockData}
        running={oppClockRunning}
        position="top"
        {initialMs}
        turnStartedAt={gs.clockState?.turnStartedAt}
        onTimeout={() => handleTimeout(oppColor)}
      />
    {/if}

    <PlayerStrip
      color={topStripColor}
      name={isAI && aiThinking && topStripColor === aiColor
        ? resolveStripName(topStripColor) + ' (thinking...)'
        : resolveStripName(topStripColor)}
      captures={opponentCaptures}
      position="top"
      online={isAI || isOgs ? null : topStripColor === 'black' ? blackOnline : whiteOnline}
    />

    <div class="rmoves">
      {#if analysisMode}
        <AnalysisMoves
          analysisMoveRows={analysis.moveRows}
          analysisNode={analysis.currentNode}
          boardSize={gs.boardSize}
          onSelectNode={navigateAnalysisTo}
        />
      {:else}
        {#if gs.isViewingHistory}
          <div class="history-indicator">Move {gs.currentViewPly} of {gs.totalPly}</div>
        {:else if isAI && engineLoading}
          <div class="ai-status">Loading AI engine...</div>
        {:else if isAI && aiThinking}
          <div class="ai-status">AI is thinking...</div>
        {/if}
        <GameStatusMessage
          status={gs.status}
          {isSpectator}
          {isMyTurn}
          {myColor}
          {mySign}
          currentSign={gs.currentSign}
          {isCorrGame}
          corrDeadline={gs.corrState?.turnDeadline}
          {score}
          {komi}
          blackApproved={gs.blackApproved}
          whiteApproved={gs.whiteApproved}
          winner={gs.winner}
          winnerResult={gs.winnerResult}
          finalScore={gs.finalScore}
        />
      {/if}
    </div>

    {#if analysisMode}
      <div class="rgraph">
        <GameGraph
          root={analysis.root}
          currentNode={analysis.currentNode}
          version={analysis.version}
          onSelectNode={navigateAnalysisTo}
        />
      </div>
    {/if}

    <div class="rcontrols">
      {#if analysisMode}
        <AnalysisControls
          status={analysis.status}
          score={analysis.score}
          estimatedScore={analysis.estimatedScore}
          showEstimate={analysis.showEstimate}
          onStartScoring={() => analysis.startScoring()}
          onStopScoring={() => analysis.stopScoring()}
          onToggleEstimate={() => (analysis.showEstimate = !analysis.showEstimate)}
          onExit={exitAnalysis}
        />
      {:else}
        <GameControls
          status={gs.status}
          {isSpectator}
          {isMyTurn}
          {myColor}
          {analysisMode}
          blackApproved={gs.blackApproved}
          whiteApproved={gs.whiteApproved}
          {opponentOnline}
          onPass={pass}
          onResign={resign}
          onForceResign={forceResign}
          onCancel={cancel}
          onApproveScore={approveScore}
          onResumePlay={resumePlay}
          onAnalysis={enterAnalysis}
          onExitAnalysis={exitAnalysis}
        />
      {/if}
    </div>

    {#if analysisMode}
      <NavigationButtons
        canPrev={analysis.canGoPrev}
        canNext={analysis.canGoNext}
        onFirst={() => analysis.navigate('first')}
        onPrev={() => analysis.navigate('prev')}
        onNext={() => analysis.navigate('next')}
        onLast={() => analysis.navigate('last')}
      />
    {:else if gs.totalPly > 0}
      <NavigationButtons
        canPrev={gs.currentViewPly > 0}
        canNext={gs.currentViewPly < gs.totalPly}
        onFirst={() => gs.jumpFirst()}
        onPrev={() => gs.jumpPrev()}
        onNext={() => gs.jumpNext()}
        onLast={() => gs.jumpLast()}
      />
    {/if}

    <PlayerStrip
      color={bottomStripColor}
      name={resolveStripName(bottomStripColor)}
      captures={myCaptures}
      position="bottom"
      online={isAI || isOgs ? null : bottomStripColor === 'black' ? blackOnline : whiteOnline}
    />

    {#if hasClock || gs.clockState}
      <Clock
        clockData={myClockData}
        running={myClockRunning}
        position="bottom"
        {initialMs}
        turnStartedAt={gs.clockState?.turnStartedAt}
        onTimeout={() => handleTimeout(myColor)}
      />
    {/if}
  </div>
</div>

{#if showJoinModal}
  <JoinGameModal game={data.game} joinerName={displayName} onJoined={handleJoined} />
{/if}
