<script>
  import { untrack } from 'svelte';
  import { page } from '$app/state';
  import influence from '@sabaki/influence';
  import GoBoardLib from '@sabaki/go-board';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import Clock from '$lib/game/Clock.svelte';
  import PlayerStrip from '$lib/game/PlayerStrip.svelte';
  import NavigationButtons from '$lib/game/NavigationButtons.svelte';
  import { boardState } from '$lib/boardState.svelte.js';
  import { getGuestId } from '$lib/guestId.js';
  import { GameState } from '$lib/gameLogic.svelte.js';
  import { gameSocket } from '$lib/socket.svelte.js';
  import GameChat from '$lib/game/GameChat.svelte';
  import GameMeta from '$lib/game/GameMeta.svelte';
  import GameStatusMessage from '$lib/game/GameStatusMessage.svelte';
  import GameControls from '$lib/game/GameControls.svelte';
  import AnalysisMoves from '$lib/game/AnalysisMoves.svelte';
  import AnalysisControls from '$lib/game/AnalysisControls.svelte';
  import JoinGameModal from '$lib/game/JoinGameModal.svelte';
  import {
    colorName,
    computeScore,
    buildScoreBoard,
    toggleDeadStones,
    computeVertexSize,
    emptyMarkerMap,
    scoreVerdictShort
  } from '$lib/gameUtils.js';

  let { data } = $props();
  const username = $derived(data.user?.username ?? '');
  const displayName = $derived(username || getGuestId());

  const KOMI = 6.5;
  const ICON_INFO = '\ue060';

  const gameId = $derived(page.params.gameId);
  const isLocal = $derived(data.game.gameType === 'local');

  let boardContainerWidth = $state(0);
  let boardContainerHeight = $state(0);
  let chatMessages = $state(data.chat ?? []);
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
    data.game[color + 'Name'] = displayName;
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

  function makeTreeNode(board, lastMove, signToPlay, parent, size) {
    return { board, lastMove, signToPlay, children: [], parent, markerMap: emptyMarkerMap(size) };
  }

  function buildGameTree(moves, size) {
    const treeRoot = makeTreeNode(GoBoardLib.fromDimensions(size), null, 1, null, size);
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
        const child = makeTreeNode(newBoard, [move.x, move.y], nextSign, node, size);
        node.children.push(child);
        node = child;
      } else if (move.type === 'pass') {
        const nextSign = node.signToPlay === 1 ? -1 : 1;
        const child = makeTreeNode(node.board, null, nextSign, node, size);
        node.children.push(child);
        node = child;
      }
    }
    return { root: treeRoot, lastNode: node };
  }

  let analysisMode = $state(false);
  let analysisNode = $state(null);
  let analysisTool = $state('stone');
  let analysisVersion = $state(0);

  const analysisSignMap = $derived(analysisNode?.board.signMap ?? null);
  const analysisChildrenMap = $derived.by(() => {
    if (!analysisNode || analysisNode.children.length === 0) return null;
    const size = gs.boardSize;
    const map = Array.from({ length: size }, () => new Array(size).fill(0));
    for (const child of analysisNode.children) {
      if (!child.lastMove) continue;
      const [cx, cy] = child.lastMove;
      map[cy][cx] = analysisNode.signToPlay;
    }
    return map;
  });

  const analysisMarkerMap = $derived.by(() => {
    analysisVersion;
    return analysisNode?.markerMap ?? null;
  });

  const analysisMovePath = $derived.by(() => {
    analysisVersion;
    if (!analysisNode) return [];
    const path = [];
    let node = analysisNode;
    while (node.parent) {
      path.unshift(node);
      node = node.parent;
    }
    return path;
  });

  const analysisMoveRows = $derived.by(() => {
    const rows = [];
    for (let i = 0; i < analysisMovePath.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      const black = analysisMovePath[i];
      const white = i + 1 < analysisMovePath.length ? analysisMovePath[i + 1] : null;
      rows.push({ moveNum, black, white });
    }
    return rows;
  });

  let analysisStatus = $state('playing');
  let analysisDeadStones = $state([]);
  let analysisAreaMap = $state(null);
  let analysisShowEstimate = $state(false);

  const analysisScore = $derived(
    analysisAreaMap ? computeScore(analysisAreaMap, gs.boardSize, KOMI) : null
  );

  const analysisEstimateAreaMap = $derived.by(() => {
    if (!analysisShowEstimate || analysisStatus === 'scoring' || !analysisNode) return null;
    return influence.map(analysisNode.board.signMap, { discrete: true });
  });

  const analysisEstimatedScore = $derived(
    analysisEstimateAreaMap ? computeScore(analysisEstimateAreaMap, gs.boardSize, KOMI) : null
  );

  function analysisStartScoring() {
    analysisStatus = 'scoring';
    analysisDeadStones = [];
    analysisAreaMap = influence.areaMap(analysisNode.board.signMap);
  }

  function analysisStopScoring() {
    analysisStatus = 'playing';
    analysisDeadStones = [];
    analysisAreaMap = null;
  }

  function analysisToggleDeadGroup(x, y) {
    analysisDeadStones = toggleDeadStones(analysisNode.board, analysisDeadStones, x, y);
    const sb = buildScoreBoard(analysisNode.board, analysisDeadStones);
    analysisAreaMap = influence.areaMap(sb.signMap);
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

  function applyAnalysisMarker(x, y, tool) {
    if (!analysisNode) return;
    const current = analysisNode.markerMap[y][x];
    const newMap = analysisNode.markerMap.map((row) => [...row]);
    if (tool === 'label') {
      if (current && current.type === 'label') {
        newMap[y][x] = null;
      } else {
        const letter = nextLabel(analysisNode.markerMap, gs.boardSize);
        newMap[y][x] = { type: 'label', label: letter };
      }
    } else if (tool === 'number') {
      if (current && current.type === 'number') {
        newMap[y][x] = null;
      } else {
        const num = nextNumber(analysisNode.markerMap, gs.boardSize);
        newMap[y][x] = { type: 'number', label: num };
      }
    } else {
      newMap[y][x] = current === tool ? null : tool;
    }
    analysisNode.markerMap = newMap;
    analysisVersion++;
  }

  function applyAnalysisMove(x, y) {
    if (!analysisNode) return;
    const existing = analysisNode.children.find(
      (c) => c.lastMove && c.lastMove[0] === x && c.lastMove[1] === y
    );
    if (existing) {
      analysisNode = existing;
      return;
    }
    const sign = analysisNode.signToPlay;
    const analysis = analysisNode.board.analyzeMove(sign, [x, y]);
    if (analysis.overwrite || analysis.suicide || analysis.ko) return;
    let newBoard;
    try {
      newBoard = analysisNode.board.makeMove(sign, [x, y], {
        preventSuicide: true,
        preventOverwrite: true,
        preventKo: true
      });
    } catch {
      return;
    }
    const nextSign = sign === 1 ? -1 : 1;
    const child = makeTreeNode(newBoard, [x, y], nextSign, analysisNode, gs.boardSize);
    analysisNode.children.push(child);
    analysisNode = child;
  }

  function applyAnalysisNav(action) {
    if (!analysisNode) return;
    if (action === 'prev' && analysisNode.parent) {
      analysisNode = analysisNode.parent;
    } else if (action === 'next' && analysisNode.children.length > 0) {
      analysisNode = analysisNode.children[0];
    } else if (action === 'first') {
      let node = analysisNode;
      while (node.parent) node = node.parent;
      analysisNode = node;
    } else if (action === 'last') {
      let node = analysisNode;
      while (node.children.length > 0) node = node.children[0];
      analysisNode = node;
    }
  }

  function enterAnalysis() {
    const tree = buildGameTree(data.game.moves, gs.boardSize);
    analysisNode = tree.lastNode;
    analysisMode = true;
    analysisTool = 'stone';
    analysisStatus = 'playing';
    analysisDeadStones = [];
    analysisAreaMap = null;
    analysisShowEstimate = false;
  }

  function onAnalysisVertexClick(x, y) {
    if (analysisStatus === 'scoring') {
      analysisToggleDeadGroup(x, y);
      return;
    }
    if (analysisTool === 'stone') {
      applyAnalysisMove(x, y);
    } else {
      applyAnalysisMarker(x, y, analysisTool);
    }
  }

  function analysisNav(action) {
    applyAnalysisNav(action);
  }

  const isGameOver = $derived(
    gs.status === 'gameover' || gs.status === 'abandoned' || gs.status === 'aborted'
  );

  function onVertexClick(x, y) {
    if (isSpectator) return;
    if (gs.status === 'playing') {
      if (!isMyTurn) return;
      const movingSign = isLocal ? gs.currentSign : mySign;
      const movingColor = colorName(movingSign);
      const analysis = gs.board.analyzeMove(movingSign, [x, y]);
      if (analysis.overwrite || analysis.suicide || analysis.ko) return;
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
      const name = targetColor === 'black' ? data.game.blackName : data.game.whiteName;
      return name ?? (targetColor === 'black' ? 'Black' : 'White');
    }
    if (targetColor === myColor) return displayName;
    return data.game[targetColor + 'Name'] ?? '...';
  }

  function resolveStripName(targetColor) {
    if (isLocal) {
      const name = targetColor === 'black' ? data.game.blackName : data.game.whiteName;
      return name ?? (targetColor === 'black' ? 'Black' : 'White');
    }
    if (isSpectator) {
      const name = targetColor === 'black' ? data.game.blackName : data.game.whiteName;
      return name ?? (targetColor === 'black' ? 'Black' : 'White');
    }
    if (targetColor === myColor) return displayName;
    return data.game[targetColor + 'Name'] ?? (gs.status === 'waiting' ? 'Waiting...' : targetColor);
  }

  const topStripColor = $derived(isSpectator ? 'black' : oppColor);
  const bottomStripColor = $derived(isSpectator ? 'white' : myColor);

  function handleKeydown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (analysisMode) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        analysisNav('prev');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        analysisNav('next');
      } else if (e.key === 'Home') {
        e.preventDefault();
        analysisNav('first');
      } else if (e.key === 'End') {
        e.preventDefault();
        analysisNav('last');
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
        if (data.game.blackName === displayName) gs.mySign = 1;
        else if (data.game.whiteName === displayName) gs.mySign = -1;
      }
      chatMessages = data.chat ?? [];
      analysisMode = false;
      analysisNode = null;

      gameSocket.onMessage((msg) => {
        if (msg.type === 'joined') {
          gs.status = 'playing';
          if (msg.color === 'black') data.game.blackName = msg.name;
          else data.game.whiteName = msg.name;
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
          signMap={analysisSignMap}
          lastMove={analysisNode?.lastMove}
          size={gs.boardSize}
          {vertexSize}
          showCoords={boardState.showCoords}
          currentSign={analysisNode?.signToPlay ?? 1}
          childrenMap={analysisChildrenMap}
          markerMap={analysisMarkerMap}
          areaMap={analysisStatus === 'scoring' ? analysisAreaMap : analysisEstimateAreaMap}
          deadStones={analysisStatus === 'scoring' ? analysisDeadStones : null}
          onVertexClick={onAnalysisVertexClick}
        />
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
          {analysisMoveRows}
          {analysisNode}
          boardSize={gs.boardSize}
          onSelectNode={(node) => (analysisNode = node)}
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
          {analysisTool}
          {analysisStatus}
          {analysisScore}
          {analysisEstimatedScore}
          {analysisShowEstimate}
          onSetTool={(tool) => (analysisTool = tool)}
          onStartScoring={analysisStartScoring}
          onStopScoring={analysisStopScoring}
          onToggleEstimate={() => (analysisShowEstimate = !analysisShowEstimate)}
          onExit={() => {
            analysisMode = false;
            analysisNode = null;
            analysisStopScoring();
          }}
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
        canPrev={!!analysisNode?.parent}
        canNext={analysisNode?.children.length > 0}
        onFirst={() => analysisNav('first')}
        onPrev={() => analysisNav('prev')}
        onNext={() => analysisNav('next')}
        onLast={() => analysisNav('last')}
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
