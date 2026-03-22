<script>
  import { untrack } from 'svelte';
  import { page } from '$app/state';
  import influence from '@sabaki/influence';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import Clock from '$lib/game/Clock.svelte';
  import PlayerStrip from '$lib/game/PlayerStrip.svelte';
  import NavigationButtons from '$lib/game/NavigationButtons.svelte';
  import { boardState } from '$lib/boardState.svelte.js';
  import { getGuestId } from '$lib/guestId.js';
  import { GameState } from '$lib/gameLogic.svelte.js';
  import { AnalysisState } from '$lib/game/analysisState.svelte.js';
  import { gameSocket } from '$lib/socket.svelte.js';
  import GameChat from '$lib/game/GameChat.svelte';
  import GameMeta from '$lib/game/GameMeta.svelte';
  import GameStatusMessage from '$lib/game/GameStatusMessage.svelte';
  import GameControls from '$lib/game/GameControls.svelte';
  import AnalysisMoves from '$lib/game/AnalysisMoves.svelte';
  import AnalysisControls from '$lib/game/AnalysisControls.svelte';
  import EditBar from '$lib/game/EditBar.svelte';
  import JoinGameModal from '$lib/game/JoinGameModal.svelte';
  import {
    colorName,
    computeScore,
    buildScoreBoard,
    toggleDeadStones,
    computeVertexSize,
    scoreVerdictShort
  } from '$lib/gameUtils.js';

  let { data } = $props();
  const username = $derived(data.user?.username ?? '');
  const displayName = $derived(username || getGuestId());

  const KOMI = 6.5;

  const gameId = $derived(page.params.gameId);
  const isLocal = $derived(data.game.gameType === 'local');

  let boardContainerWidth = $state(0);
  let boardContainerHeight = $state(0);
  let chatMessages = $state(data.chat ?? []);
  let blackName = $state(data.game.blackName ?? null);
  let whiteName = $state(data.game.whiteName ?? null);
  let blackOnline = $state(false);
  let whiteOnline = $state(false);
  let clockPausedAt = $state(null);

  function handleChatSend(text) {
    chatMessages.push({ user: displayName, text });
    fetch('/api/game/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameId, user: displayName, text })
    });
  }

  let gs = $state(new GameState({ isLocal }));

  const vertexSize = $derived(
    computeVertexSize(boardContainerWidth, boardContainerHeight, gs.boardSize)
  );
  const displayBoard = $derived(gs.viewBoard);
  const signMap = $derived(displayBoard.signMap);
  const blackCaptures = $derived(displayBoard.getCaptures(1));
  const whiteCaptures = $derived(displayBoard.getCaptures(-1));

  const showJoinModal = $derived(
    gs.status === 'waiting' && gs.mySign === null && !isLocal
  );

  function handleJoined(color) {
    gs.mySign = color === 'black' ? 1 : -1;
    gs.status = 'playing';
    if (color === 'black') blackName = displayName;
    else whiteName = displayName;
    gameSocket.send({ type: 'join', gameId, color });
  }

  const isSpectator = $derived(!isLocal && gs.mySign === null);
  const mySign = $derived(isLocal ? 1 : (gs.mySign ?? -1));
  const myColor = $derived(colorName(mySign));
  const oppColor = $derived(myColor === 'black' ? 'white' : 'black');
  const myCaptures = $derived(mySign === 1 ? blackCaptures : whiteCaptures);
  const opponentCaptures = $derived(mySign === 1 ? whiteCaptures : blackCaptures);

  const isCorrGame = $derived(gs.timeControl.type === 'correspondence');
  const isMyTurn = $derived(
    !isSpectator &&
      gs.status === 'playing' &&
      gs.timedOutColor === null &&
      (isLocal || gs.currentSign === mySign) &&
      (!isCorrGame || gs.corrState?.activeColor === myColor)
  );

  function handleTimeout(loser) {
    if (gs.status !== 'playing') return;
    gs.timedOutColor = loser;
    gs.status = 'gameover';
    const winnerColor = loser === 'black' ? 'white' : 'black';
    gs.winner = winnerColor === 'black' ? 1 : -1;
    gs.winnerResult = `${winnerColor === 'black' ? 'B' : 'W'}+T`;
    if (!isLocal) {
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

  function activePlayerOnline() {
    if (isLocal) return true;
    const activeColor = gs.clockState?.activeColor;
    if (activeColor === 'black') return blackOnline;
    if (activeColor === 'white') return whiteOnline;
    return true;
  }

  const myClockRunning = $derived(
    gs.status === 'playing' &&
      !!gs.clockState?.turnStartedAt &&
      gs.clockState?.activeColor === myColor &&
      activePlayerOnline()
  );
  const oppClockRunning = $derived(
    gs.status === 'playing' &&
      !!gs.clockState?.turnStartedAt &&
      gs.clockState?.activeColor === oppColor &&
      activePlayerOnline()
  );

  const scoreBoard = $derived.by(() => {
    if (gs.status !== 'scoring') return displayBoard;
    return buildScoreBoard(gs.board, gs.deadStones);
  });

  const areaMap = $derived(gs.status === 'scoring' ? influence.areaMap(scoreBoard.signMap) : null);
  const score = $derived(areaMap ? computeScore(areaMap, gs.boardSize, KOMI) : null);

  // --- Analysis mode ---

  let analysis = $state(null);
  const analysisMode = $derived(analysis !== null);

  function enterAnalysis() {
    analysis = new AnalysisState(gs.boardSize);
    analysis.loadMoves(data.game.moves);
  }

  function exitAnalysis() {
    analysis = null;
  }

  // --- Game actions ---

  function onVertexClick(x, y) {
    if (isSpectator) return;
    if (gs.status === 'playing') {
      if (!isMyTurn) return;
      const movingSign = isLocal ? gs.currentSign : mySign;
      const moveResult = gs.board.analyzeMove(movingSign, [x, y]);
      if (moveResult.overwrite || moveResult.suicide || moveResult.ko) return;
      gs.applyMove(x, y, movingSign);
      gs.tickClock();
      if (!isLocal) {
        gameSocket.send({ type: 'move', x, y });
      }
    } else if (gs.status === 'scoring') {
      gs.deadStones = toggleDeadStones(gs.board, gs.deadStones, x, y);
      gs.blackApproved = false;
      gs.whiteApproved = false;
    }
  }

  function pass() {
    if (!isMyTurn) return;
    applyPass();
    if (!isLocal) {
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

  function abort() {}

  function resign() {
    const winner = myColor === 'black' ? 'white' : 'black';
    const result = winner === 'white' ? 'W+R' : 'B+R';
    if (isLocal) {
      gs.status = 'gameover';
      gs.winner = mySign === 1 ? -1 : 1;
      gs.winnerResult = result;
    } else {
      gameSocket.send({ type: 'gameover', winner, result });
    }
  }

  function forceResign() {
    const result = myColor === 'white' ? 'W+R' : 'B+R';
    gameSocket.send({ type: 'gameover', winner: myColor, result });
  }

  function approveScore() {
    if (myColor === 'black') gs.blackApproved = true;
    else gs.whiteApproved = true;
    if (!isLocal) {
      gameSocket.send({ type: 'approve-score', color: myColor });
    }
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
    if (!isLocal) {
      gameSocket.send({ type: 'gameover', winner: winner === 1 ? 'black' : 'white', result: resultString });
    }
  }

  const opponentOnline = $derived(isLocal ? null : (oppColor === 'black' ? blackOnline : whiteOnline));

  function resolvePlayerName(targetColor) {
    if (isLocal) return targetColor === 'black' ? 'Black' : 'White';
    if (isSpectator) {
      const name = targetColor === 'black' ? blackName : whiteName;
      return name ?? (targetColor === 'black' ? 'Black' : 'White');
    }
    if (targetColor === myColor) return displayName;
    const oppName = targetColor === 'black' ? blackName : whiteName;
    return oppName ?? '...';
  }

  function resolveStripName(targetColor) {
    if (isLocal) {
      const name = targetColor === 'black' ? blackName : whiteName;
      return name ?? (targetColor === 'black' ? 'Black' : 'White');
    }
    if (isSpectator) {
      const name = targetColor === 'black' ? blackName : whiteName;
      return name ?? (targetColor === 'black' ? 'Black' : 'White');
    }
    if (targetColor === myColor) return displayName;
    const oppName = targetColor === 'black' ? blackName : whiteName;
    return oppName ?? (gs.status === 'waiting' ? 'Waiting...' : targetColor);
  }

  const topStripColor = $derived(isSpectator ? 'black' : oppColor);
  const bottomStripColor = $derived(isSpectator ? 'white' : myColor);

  function handleKeydown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (analysisMode) {
      const keyMap = {
        ArrowLeft: 'prev',
        ArrowRight: 'next',
        Home: 'first',
        End: 'last'
      };
      const action = keyMap[e.key];
      if (action) {
        e.preventDefault();
        analysis.navigate(action);
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
      analysis = null;

      gameSocket.onMessage((msg) => {
        if (msg.type === 'joined') {
          gs.status = 'playing';
          if (msg.color === 'black') blackName = msg.name;
          else whiteName = msg.name;
        }
        if (msg.type === 'move') {
          const opponentSign = gs.currentSign;
          gs.applyMove(msg.x, msg.y, opponentSign);
          gs.tickClock();
        }
        if (msg.type === 'pass') {
          applyPass();
        }
        if (msg.type === 'approve-score') {
          if (msg.color === 'black') gs.blackApproved = true;
          else gs.whiteApproved = true;
          checkBothApproved();
        }
        if (msg.type === 'chat') {
          const isDuplicate = chatMessages.some(
            (m) => m.user === msg.user && m.text === msg.text
          );
          if (!isDuplicate) {
            chatMessages.push({ user: msg.user, text: msg.text });
          }
        }
        if (msg.type === 'presence') {
          if (msg.color === 'black') blackOnline = msg.online;
          else if (msg.color === 'white') whiteOnline = msg.online;

          const isActivePlayer = gs.clockState?.activeColor === msg.color;
          if (isActivePlayer && gs.clockState?.turnStartedAt) {
            if (!msg.online) {
              clockPausedAt = Date.now();
            } else if (clockPausedAt) {
              const pausedMs = Date.now() - clockPausedAt;
              gs.clockState.turnStartedAt += pausedMs;
              clockPausedAt = null;
            }
          }
        }
        if (msg.type === 'gameover') {
          gs.status = 'gameover';
          gs.winner = msg.winner === 'black' ? 1 : -1;
          gs.winnerResult = msg.result ?? null;
        }
      });
      gameSocket.join(currentGameId, data.viewerColor ?? null);

      document.addEventListener('keydown', handleKeydown);
    });

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      gameSocket.onMessage(null);
      gameSocket.leave();
    };
  });
</script>

<div class="round">
  <aside class="round__side">
    <GameMeta
      boardSize={gs.boardSize}
      status={gs.status}
      winner={gs.winner}
      winnerResult={gs.winnerResult}
      {mySign}
      {isLocal}
      {isSpectator}
      blackName={resolvePlayerName('black')}
      whiteName={resolvePlayerName('white')}
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
          size={gs.boardSize}
          {vertexSize}
          showCoords={boardState.showCoords}
          currentSign={analysis.currentSign}
          childrenMap={analysis.childrenMap}
          markerMap={analysis.markerMap}
          areaMap={analysis.displayAreaMap}
          deadStones={analysis.displayDeadStones}
          onVertexClick={(x, y) => analysis.onVertexClick(x, y)}
        />
        <EditBar tool={analysis.tool} onSetTool={(t) => (analysis.tool = t)} />
      {:else}
        <GoBoard
          {signMap}
          lastMove={gs.viewLastMove}
          shiftMap={gs.viewShiftMap}
          animatedVertex={gs.isViewingHistory ? null : gs.animatedVertex}
          size={gs.boardSize}
          {vertexSize}
          {areaMap}
          deadStones={gs.status === 'scoring' ? gs.deadStones : null}
          showCoords={boardState.showCoords}
          currentSign={gs.currentSign}
          onVertexClick={!gs.isViewingHistory &&
          (gs.status === 'playing' || gs.status === 'scoring')
            ? onVertexClick
            : null}
        />
      {/if}
    </div>

    {#if !isCorrGame}
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
      name={resolveStripName(topStripColor)}
      captures={opponentCaptures}
      position="top"
      online={isLocal ? null : (topStripColor === 'black' ? blackOnline : whiteOnline)}
    />

    <div class="rmoves">
      {#if analysisMode}
        <AnalysisMoves
          analysisMoveRows={analysis.moveRows}
          analysisNode={analysis.currentNode}
          boardSize={gs.boardSize}
          onSelectNode={(node) => {
            analysis.currentNode = node;
            analysis.animatedVertex = null;
          }}
        />
      {:else}
        {#if gs.isViewingHistory}
          <div class="history-indicator">Move {gs.currentViewPly} of {gs.totalPly}</div>
        {/if}
        <GameStatusMessage
          status={gs.status}
          {isLocal}
          {isSpectator}
          {isMyTurn}
          {myColor}
          {mySign}
          currentSign={gs.currentSign}
          {isCorrGame}
          corrDeadline={gs.corrState?.turnDeadline}
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
      {/if}
      <GameControls
        status={gs.status}
        {isSpectator}
        {isMyTurn}
        {isLocal}
        {myColor}
        blackApproved={gs.blackApproved}
        whiteApproved={gs.whiteApproved}
        {opponentOnline}
        onPass={pass}
        onResign={resign}
        onForceResign={forceResign}
        onAbort={abort}
        onApproveScore={approveScore}
        onApproveBlack={() => {
          gs.blackApproved = true;
        }}
        onApproveWhite={() => {
          gs.whiteApproved = true;
        }}
      />
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
      online={isLocal ? null : (bottomStripColor === 'black' ? blackOnline : whiteOnline)}
    />

    {#if !isCorrGame}
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
