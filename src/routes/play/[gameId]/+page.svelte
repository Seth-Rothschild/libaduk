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
  import { OgsGameBridge } from '$lib/game/ogsGameBridge.svelte.js';

  let { data } = $props();
  const username = $derived(data.user?.username ?? '');
  const displayName = $derived(username || getGuestId());

  const KOMI = $derived(isOgs && ogsBridge ? ogsBridge.komi : (data.game.komi ?? 6.5));

  const gameId = $derived(page.params.gameId);
  const isOgs = $derived(data.game.gameType === 'ogs');

  let boardContainerWidth = $state(0);
  let boardContainerHeight = $state(0);
  let chatMessages = $state(data.chat ?? []);
  let blackName = $state(data.game.blackName ?? null);
  let whiteName = $state(data.game.whiteName ?? null);
  let blackOnline = $state(false);
  let whiteOnline = $state(false);
  let clockPausedAt = $state(null);

  const isAI = $derived(data.game.gameType === 'ai');
  let ogsBridge = $state(null);
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
    if (isOgs && ogsBridge) {
      ogsBridge.sendChat(text);
    }
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
      gs.currentSign === mySign &&
      (!isCorrGame || gs.corrState?.activeColor === myColor)
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
  const initialMs = $derived(
    isOgs
      ? (ogsBridge?.clock?.black_time?.thinking_time ?? 0) * 1000 || null
      : hasClock
        ? (gs.timeControl.initial ?? 0) * 1000
        : null
  );
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
  function ogsTimeToClockData(t) {
    if (!t) return null;
    const mainMs = t.thinking_time * 1000;
    return {
      mainMs,
      byoMs: t.period_time * 1000,
      byoPeriods: t.periods,
      periodMs: t.period_time * 1000,
      inByoYomi: mainMs <= 0
    };
  }

  const ogsClock = $derived(isOgs ? ogsBridge?.clock : null);
  const ogsBlackClockData = $derived(ogsTimeToClockData(ogsClock?.black_time));
  const ogsWhiteClockData = $derived(ogsTimeToClockData(ogsClock?.white_time));
  // Adjust last_move server timestamp to client time using the 'now' field
  const ogsTurnStartedAt = $derived(
    ogsClock ? Date.now() - (ogsClock.now ?? Date.now()) + ogsClock.last_move : null
  );
  const ogsActiveColor = $derived.by(() => {
    if (!ogsClock) return null;
    return ogsClock.current_player === ogsClock.black_player_id ? 'black' : 'white';
  });

  const myClockData = $derived(
    isOgs
      ? myColor === 'black'
        ? ogsBlackClockData
        : ogsWhiteClockData
      : (gs.clockState?.[myColor] ?? previewClockData)
  );
  const oppClockData = $derived(
    isOgs
      ? oppColor === 'black'
        ? ogsBlackClockData
        : ogsWhiteClockData
      : (gs.clockState?.[oppColor] ?? previewClockData)
  );

  function activePlayerOnline() {
    if (isAI) return true;
    const activeColor = gs.clockState?.activeColor;
    if (activeColor === 'black') return blackOnline;
    if (activeColor === 'white') return whiteOnline;
    return true;
  }

  const myClockRunning = $derived(
    isOgs
      ? gs.status === 'playing' && ogsActiveColor === myColor
      : gs.status === 'playing' &&
          !!gs.clockState?.turnStartedAt &&
          gs.clockState?.activeColor === myColor &&
          activePlayerOnline()
  );
  const oppClockRunning = $derived(
    isOgs
      ? gs.status === 'playing' && ogsActiveColor === oppColor
      : gs.status === 'playing' &&
          !!gs.clockState?.turnStartedAt &&
          gs.clockState?.activeColor === oppColor &&
          activePlayerOnline()
  );

  const scoreBoard = $derived.by(() => {
    if (gs.status !== 'scoring') return displayBoard;
    const dead = isOgs && ogsBridge ? ogsBridge.deadStones : gs.deadStones;
    return buildScoreBoard(gs.board, dead);
  });

  const areaMap = $derived(gs.status === 'scoring' ? influence.areaMap(scoreBoard.signMap) : null);
  const score = $derived(areaMap ? computeScore(areaMap, gs.boardSize, KOMI) : null);

  const displayDeadStones = $derived(
    gs.status === 'scoring' ? (isOgs && ogsBridge ? ogsBridge.deadStones : gs.deadStones) : null
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
        KOMI,
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
    analysis = new AnalysisState(gs.boardSize, KOMI);
    analysis.loadTree(tree);
  }

  function enterAnalysisFromMoves() {
    analysis = new AnalysisState(gs.boardSize, KOMI);
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
      if (isOgs && ogsBridge) {
        gs.applyMove(x, y, movingSign);
        gs.tickClock();
        gameSocket.send({ type: 'move', x, y });
        ogsBridge.sendMove(x, y);
      } else if (isAI) {
        gs.applyMove(x, y, movingSign);
        gs.tickClock();
        aiMoveHistory.push({ color: movingSign, x, y });
        gameSocket.send({ type: 'move', x, y });
        triggerAiMove();
      } else {
        gameSocket.send({ type: 'move', x, y });
      }
    } else if (gs.status === 'scoring') {
      if (isOgs && ogsBridge) {
        ogsBridge.toggleDeadStone(x, y);
      } else {
        gs.deadStones = toggleDeadStones(gs.board, gs.deadStones, x, y);
        gs.blackApproved = false;
        gs.whiteApproved = false;
      }
    }
  }

  function pass() {
    if (!isMyTurn) return;
    applyPass();
    gameSocket.send({ type: 'pass' });
    if (isOgs && ogsBridge) {
      ogsBridge.sendPass();
    }
    if (isAI) {
      aiMoveHistory.push({ color: mySign, x: -1, y: -1 });
      if (gs.consecutivePasses < 2) {
        triggerAiMove();
      }
    }
  }

  function applyPass() {
    gs.consecutivePasses++;
    gs.lastMove = null;
    gs.animatedVertex = null;
    gs.currentSign = gs.currentSign === 1 ? -1 : 1;
    gs.recordPass();
    gs.tickClock();
    if (!isOgs && gs.consecutivePasses >= 2) {
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
    gameSocket.send({ type: 'gameover', winner, result, clockState: serializeClockState() });
    if (isOgs && ogsBridge) {
      ogsBridge.sendResign();
    }
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
    if (isOgs && ogsBridge) {
      if (ogsBridge.phase === 'stone removal') {
        ogsBridge.acceptScoring();
      }
      return;
    }
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
      clockState: serializeClockState()
    });
  }

  const opponentOnline = $derived(
    isAI || isOgs ? null : oppColor === 'black' ? blackOnline : whiteOnline
  );

  function resolvePlayerName(targetColor) {
    if (isSpectator) {
      const name = targetColor === 'black' ? blackName : whiteName;
      return name ?? (targetColor === 'black' ? 'Black' : 'White');
    }
    if (targetColor === myColor) return displayName;
    const oppName = targetColor === 'black' ? blackName : whiteName;
    return oppName ?? '...';
  }

  function resolveStripName(targetColor) {
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
          const isDuplicate = chatMessages.some((m) => m.user === msg.user && m.text === msg.text);
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
      });
      gameSocket.join(currentGameId, data.viewerColor ?? null);

      if (data.game.gameType === 'ai') {
        initAiEngine();
      }

      if (data.game.gameType === 'ogs' && data.game.ogsGameId && data.game.ogsUserId) {
        const bridge = new OgsGameBridge(data.game.ogsGameId, data.game.ogsUserId);

        bridge.onGameStart = (color, ogsBlackName, ogsWhiteName) => {
          gs.mySign = color === 'black' ? 1 : -1;
          if (gs.status === 'waiting') gs.status = 'playing';
          blackName = ogsBlackName;
          whiteName = ogsWhiteName;
          const isFirstMove = gs.moveHistory.length === 0;
          if (isFirstMove) {
            for (const [x, y] of bridge.handicapStones) {
              gs.applyMove(x, y, 1);
            }
            if (bridge.handicapStones.length > 0) {
              gs.currentSign = -1;
            }
          }
          gameSocket.join(currentGameId, color);
          fetch('/api/game/ogs-start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              gameId: currentGameId,
              blackName: ogsBlackName,
              whiteName: ogsWhiteName
            })
          });
        };

        bridge.onOpponentMove = (x, y) => {
          const opponentSign = gs.currentSign;
          gs.applyMove(x, y, opponentSign);
          gs.tickClock();
          gameSocket.send({ type: 'move', x, y });
        };

        bridge.onOpponentPass = () => {
          applyPass();
          gameSocket.send({ type: 'pass' });
        };

        bridge.onPhaseChange = (phase) => {
          if (phase === 'stone removal') {
            gs.status = 'scoring';
            gs.deadStones = [];
          } else if (phase === 'play') {
            gs.status = 'playing';
          }
        };

        bridge.onGameOver = (winner, result) => {
          gs.status = 'gameover';
          if (winner) gs.winner = winner === 'black' ? 1 : -1;
          if (result) gs.winnerResult = result;
          if (winner && result) {
            fetch('/api/game/finish', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ gameId: currentGameId, winner, result })
            });
          }
        };

        bridge.onChat = (user, text) => {
          const isDuplicate = chatMessages.some((m) => m.text === text);
          if (!isDuplicate) chatMessages.push({ user, text });
        };

        bridge.connect();
        ogsBridge = bridge;
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
      if (ogsBridge) {
        ogsBridge.destroy();
        ogsBridge = null;
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

    {#if !isCorrGame || isOgs}
      <Clock
        clockData={oppClockData}
        running={oppClockRunning}
        position="top"
        {initialMs}
        turnStartedAt={isOgs ? ogsTurnStartedAt : gs.clockState?.turnStartedAt}
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
          komi={KOMI}
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

    {#if isOgs && ogsBridge && gs.status === 'scoring'}
      <div class="rcontrols">
        <button class="button button-metal" onclick={() => ogsBridge.rejectScoring()}>
          Resume Play
        </button>
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

    {#if !isCorrGame || isOgs}
      <Clock
        clockData={myClockData}
        running={myClockRunning}
        position="bottom"
        {initialMs}
        turnStartedAt={isOgs ? ogsTurnStartedAt : gs.clockState?.turnStartedAt}
        onTimeout={() => handleTimeout(myColor)}
      />
    {/if}
  </div>
</div>

{#if showJoinModal}
  <JoinGameModal game={data.game} joinerName={displayName} onJoined={handleJoined} />
{/if}
