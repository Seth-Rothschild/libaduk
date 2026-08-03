<script>
  // @ts-check
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
    getNodePath,
    findNodeById,
    followNodePath
  } from '$lib/game/analysisState.svelte.js';

  function getNodeMoveNum(node) {
    let depth = 0;
    let n = node;
    while (n.parent) {
      depth++;
      n = n.parent;
    }
    return depth;
  }

  function scrollActiveIntoView(el, isActive) {
    $effect(() => {
      if (isActive) el.scrollIntoView({ block: 'nearest' });
    });
    return {
      update(newIsActive) {
        if (newIsActive) el.scrollIntoView({ block: 'nearest' });
      }
    };
  }
  import { MemorizeState } from '$lib/game/memorizeState.svelte.js';
  import { gameSocket } from '$lib/state/socket.svelte.js';
  import GameChat from '$lib/game/GameChat.svelte';
  import GameMeta from '$lib/game/GameMeta.svelte';
  import AnalysisInfo from '$lib/game/AnalysisInfo.svelte';
  import GameStatusMessage from '$lib/game/GameStatusMessage.svelte';
  import AnalysisMoves from '$lib/game/AnalysisMoves.svelte';
  import EditBar from '$lib/game/EditBar.svelte';
  import GameGraph from '$lib/game/GameGraph.svelte';
  import JoinGameModal from '$lib/game/JoinGameModal.svelte';
  import ShareModal from '$lib/game/ShareModal.svelte';
  import {
    colorName,
    computeScore,
    buildScoreBoard,
    scoreVerdictShort,
    exportSgf,
    parseSgfCoords,
    formatVertex
  } from '$lib/game/board';
  import { encodeMove } from '$lib/goban.js';
  import { initEngine, generateMove, hasModel, isReady, dispose } from '$lib/ai/engine.js';
  import { t } from '$lib/i18n/i18n.svelte.js';
  import ModelManager from '$lib/ai/ModelManager.svelte';
  import { formatOgsClock, formatOgsRank } from '$lib/lobby/ogsSeekGraph.svelte.js';
  import { formatClock } from '$lib/format.js';

  function getOgsToken() {
    for (const pair of document.cookie.split(';')) {
      const [key, value] = pair.trim().split('=');
      if (key === 'ogs_token') return decodeURIComponent(value);
    }
    return null;
  }

  function resolveViewerColor(gamedata) {
    if (data.viewerColor) return data.viewerColor;
    const players = gamedata?.players;
    if (!players) return null;
    const myNames = [displayName, getMe()?.ogs?.username].filter(Boolean);
    if (myNames.includes(players.black?.username)) return 'black';
    if (myNames.includes(players.white?.username)) return 'white';
    return null;
  }

  let { data } = $props();
  const username = $derived(data.user?.username ?? '');
  const displayName = $derived(username || getGuestId());

  let komi = $state(data.game.gamedata?.komi ?? 6.5);

  const gameId = $derived(page.params.gameId);
  const isOgs = $derived(data.game.gameType === 'ogs');

  let chatMessages = $state(data.chat ?? []);
  let chatHighlightVertex = $state(null);
  let chatInputText = $state('');
  let typingUsers = $state(new Set());
  const typingTimers = new Map();
  let blackName = $state(data.game.gamedata?.players?.black?.username ?? null);
  let whiteName = $state(data.game.gamedata?.players?.white?.username ?? null);
  let blackOnline = $state(false);
  let whiteOnline = $state(false);
  let spectators = $state([]);
  let pendingMove = $state(null);
  let controlRequest = $state(null);
  let showShareModal = $state(false);

  const isAI = $derived(data.game.gameType === 'ai');
  const aiDifficulty = $derived(data.game.aiDifficulty ?? 5);
  let aiThinking = $state(false);
  let showModelPrompt = $state(false);
  let engineError = $state(null);
  let engineLoading = $state(false);

  function handleCtrlClick(coord) {
    if (boardSettings.ctrlClickBehavior === 'nothing') {
      return;
    } else if (boardSettings.ctrlClickBehavior === 'chat') {
      chatInputText = chatInputText ? chatInputText + ' ' + coord : coord;
    } else if (boardSettings.ctrlClickBehavior === 'clipboard') {
      navigator.clipboard?.writeText(coord);
    }
  }

  $effect(() => {
    gameSocket.send('typing', { isTyping: chatInputText.trim().length > 0 });
  });

  function handleChatSend(text) {
    gameSocket.send('game/chat', {
      game_id: gameId,
      type: 'main',
      body: text,
      move_number: gs.totalPly
    });
  }

  let gs = $state(new GameState());

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
    gameSocket.join(gameId, color, null, displayName);
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
    gameSocket.send('game/timed_out', { game_id: gameId });
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

  function currentMoveHistory() {
    const firstColor = gs.gamedata?.initial_player === 'white' ? -1 : 1;
    const history = [];
    for (let i = 1; i < gs.lastMoveHistory.length; i++) {
      const vertex = gs.lastMoveHistory[i];
      const color = i % 2 === 1 ? firstColor : -firstColor;
      if (vertex) {
        history.push({ color, x: vertex[0], y: vertex[1] });
      } else {
        history.push({ color, x: -1, y: -1 });
      }
    }
    return history;
  }

  function maybeTriggerAiMove() {
    if (!isAI || !isReady() || aiThinking) return;
    if (gs.status !== 'playing') return;
    if (gs.currentSign !== aiSign) return;
    triggerAiMove();
  }

  async function triggerAiMove() {
    aiThinking = true;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try {
      const result = await generateMove(
        gs.board.signMap,
        aiSign,
        komi,
        currentMoveHistory(),
        aiDifficulty
      );
      if (gs.status !== 'playing') return;

      if (result.move === 'pass') {
        gameSocket.send('game/move', { game_id: gameId, move: '..' });
      } else {
        const moveResult = gs.board.analyzeMove(aiSign, [result.x, result.y]);
        const isIllegal = moveResult.overwrite || moveResult.suicide || moveResult.ko;
        if (isIllegal) {
          gameSocket.send('game/move', { game_id: gameId, move: '..' });
        } else {
          gameSocket.send('game/move', { game_id: gameId, move: encodeMove(result.x, result.y) });
        }
      }
    } catch (err) {
      console.error('[AI] Move generation failed:', err);
    } finally {
      aiThinking = false;
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
      maybeTriggerAiMove();
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
      maybeTriggerAiMove();
    } catch (err) {
      engineError = err.message;
      engineLoading = false;
    }
  }

  // --- Analysis mode ---

  let analysis = $state(null);
  let memorize = $state(null);
  let movesAreaEl = $state(null);
  const analysisMode = $derived(analysis !== null);

  const currentMoveNum = $derived.by(() => {
    if (!analysis) return null;
    for (const row of analysis.moveRows) {
      if (row.black === analysis.currentNode) return row.moveNum * 2 - 1;
      if (row.white === analysis.currentNode) return row.moveNum * 2;
    }
    return null;
  });

  // The review holds this game's shared analysis tree (review id === game id).
  // Entries arrive as OGS move-strings via review/connect's full_state and the
  // live review/{id}/r broadcast; savedAnalysisPath is local-only, just where
  // this client was looking, so exiting and re-entering resumes in place.
  let savedAnalysisPath = null;
  let reviewConnected = false;
  let pendingReviewEntries = [];

  function flushPendingAnalysisTree() {
    if (pendingReviewEntries.length === 0 || !analysis) return;
    if (analysis.status === 'scoring' || analysis.showEstimate) return;
    for (const entry of pendingReviewEntries) {
      analysis.applyReviewEntry(entry, { follow: true });
    }
    analysis.animatedVertex = analysis.currentNode.lastMove ?? null;
    pendingReviewEntries = [];
  }

  function connectReview() {
    if (reviewConnected) return;
    reviewConnected = true;
    gameSocket.send('review/connect', { review_id: gameId });
  }

  function enterAnalysisFromMoves() {
    analysis = new AnalysisState(gs.boardSize, komi);
    const blackSetup = gs.gamedata?.initial_state?.black ?? '';
    const whiteSetup = gs.gamedata?.initial_state?.white ?? '';
    const stoneSetup = [
      ...parseSgfCoords(blackSetup).map(([x, y]) => ({ x, y, sign: 1 })),
      ...parseSgfCoords(whiteSetup).map(([x, y]) => ({ x, y, sign: -1 }))
    ];
    const initialSign = gs.gamedata?.initial_player === 'white' ? -1 : 1;
    const moves = [];
    for (let i = 1; i < gs.lastMoveHistory.length; i++) {
      const vertex = gs.lastMoveHistory[i];
      if (vertex) {
        moves.push({ type: 'move', x: vertex[0], y: vertex[1] });
      } else {
        moves.push({ type: 'pass' });
      }
    }
    analysis.loadMoves(moves, stoneSetup, initialSign);
    memorize = new MemorizeState(analysis, gs.boardSize);
  }

  function enterAnalysis(remoteEntries = null) {
    if (analysis) return;
    enterAnalysisFromMoves();
    connectReview();
    for (const entry of remoteEntries ?? []) {
      analysis.applyReviewEntry(entry, { follow: true });
    }
    if (!remoteEntries && savedAnalysisPath) {
      analysis.currentNode = followNodePath(analysis.root, savedAnalysisPath);
    }
    const bookmarkId = page.url.searchParams.get('bookmark');
    if (bookmarkId) {
      const target = findNodeById(analysis.root, bookmarkId);
      if (target) analysis.currentNode = target;
    }
  }

  function downloadSgf() {
    const sgf = exportSgf(analysis.root, gs.boardSize, {
      playerBlack: blackName,
      playerWhite: whiteName
    });
    const blob = new Blob([sgf], { type: 'application/x-go-sgf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analysis.sgf';
    a.click();
    URL.revokeObjectURL(url);
  }

  function exitAnalysis() {
    savedAnalysisPath = getNodePath(analysis.currentNode);
    analysis = null;
    memorize = null;
    controlRequest = null;
  }

  function requestControl() {
    controlRequest = displayName;
    gameSocket.send('request-control', { user: displayName });
  }

  function clearControl() {
    controlRequest = null;
    gameSocket.send('clear-control', {});
  }

  function resetAnalysis() {
    // Local-only: the review log is append-only, so this clears this client's
    // view but doesn't erase shared history. A later full_state refetch (e.g.
    // a fresh page load) will still show branches recorded before the reset.
    savedAnalysisPath = null;
    analysis = null;
    memorize = null;
    enterAnalysisFromMoves();
  }

  function persistAnalysisTree() {
    if (!analysis) return;
    savedAnalysisPath = getNodePath(analysis.currentNode);
    gameSocket.send('review/append', {
      review_id: gameId,
      m: analysis.encodeCurrentPath(),
      t: analysis.currentComment,
      bookmark: analysis.currentBookmark
    });
  }

  function navigateAnalysis(target = null) {
    if (analysis.status === 'scoring') analysis.stopScoring();
    else if (analysis.showEstimate) analysis.showEstimate = false;
    flushPendingAnalysisTree();
    const actions = ['prev', 'next', 'first', 'last', 'prev-variation', 'next-variation'];
    const isAction = actions.includes(target);
    if (isAction) {
      analysis.navigate(target);
    } else if (target) {
      analysis.currentNode = target;
      analysis.animatedVertex = null;
    }
    persistAnalysisTree();
    const url = new URL(page.url);
    const currentBookmark = analysis.currentNode?.bookmark;
    if (!isAction && currentBookmark) {
      url.searchParams.set('bookmark', analysis.currentNode.id);
    } else {
      url.searchParams.delete('bookmark');
    }
    history.replaceState({}, '', url);
  }

  function onAnalysisVertexClick(x, y) {
    analysis.onVertexClick(x, y);
    persistAnalysisTree();
  }

  $effect(() => {
    if (!analysis || !movesAreaEl) return;
    analysis.currentNode;
    const scroller = movesAreaEl.querySelector('.analysis-moves');
    if (!scroller) return;
    const active = scroller.querySelector('.move-entry.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  });

  // --- Game actions ---

  function confirmMove() {
    if (!pendingMove) return;
    onVertexClick(pendingMove[0], pendingMove[1]);
  }

  function onVertexClick(x, y) {
    if (isSpectator) return;
    if (gs.status === 'playing') {
      if (!isMyTurn) return;
      const moveResult = gs.board.analyzeMove(mySign, [x, y]);
      if (moveResult.overwrite || moveResult.suicide || moveResult.ko) return;
      const mode = boardSettings.moveConfirmation;
      const coordsMatch = pendingMove?.[0] === x && pendingMove?.[1] === y;
      const needsConfirm = mode === 'double-click' || mode === 'button';
      if (needsConfirm && !coordsMatch) {
        pendingMove = [x, y];
        return;
      }
      pendingMove = null;
      gameSocket.send('game/move', { game_id: gameId, move: encodeMove(x, y) });
    } else if (gs.status === 'scoring') {
      const isMarked = gs.deadStones.some(([dx, dy]) => dx === x && dy === y);
      gameSocket.send('game/removed_stones/set', {
        game_id: gameId,
        stones: encodeMove(x, y),
        removed: !isMarked
      });
    }
  }

  function resumePlay() {
    gameSocket.send('game/removed_stones/reject', { game_id: gameId });
  }

  function pass() {
    if (!isMyTurn) return;
    gameSocket.send('game/move', { game_id: gameId, move: '..' });
  }

  function cancel() {
    gameSocket.send('game/cancel', { game_id: gameId });
  }

  function resign() {
    gameSocket.send('game/resign', { game_id: gameId });
  }

  function forceResign() {
    gameSocket.send('room/force-resign', { game_id: gameId });
  }

  function approveScore() {
    if (myColor === 'black') gs.blackApproved = true;
    else gs.whiteApproved = true;
    gameSocket.send('game/removed_stones/accept', {
      game_id: gameId,
      stones: gs.removedString,
      strict_seki_mode: false
    });
  }

  const opponentOnline = $derived(
    isAI || isOgs ? null : oppColor === 'black' ? blackOnline : whiteOnline
  );

  const chatViewers = $derived.by(() => {
    const players = [];
    if (blackOnline && blackName) players.push(blackName);
    if (whiteOnline && whiteName) players.push(whiteName);
    return [...players, ...spectators];
  });

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
    const fallback =
      gs.status === 'waiting' ? t('Waiting...') : t(targetColor === 'black' ? 'Black' : 'White');
    if (isOgs) {
      const myOgsUsername = getMe()?.ogs?.username;
      if (myOgsUsername && storedName === myOgsUsername) return displayName;
      return storedName ?? fallback;
    }
    if (isSpectator) return storedName ?? t(targetColor === 'black' ? 'Black' : 'White');
    if (targetColor === myColor) return displayName;
    return storedName ?? fallback;
  }

  const topStripColor = $derived(isSpectator ? 'black' : oppColor);
  const bottomStripColor = $derived(isSpectator ? 'white' : myColor);

  function handleKeydown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (analysisMode) {
      if (memorize?.active) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          memorize.prev();
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          memorize.next();
        }
        return;
      }
      if (analysis.status === 'scoring' || analysis.showEstimate) {
        const isNavKey = [
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'Home',
          'End'
        ].includes(e.key);
        if (isNavKey) {
          e.preventDefault();
          navigateAnalysis();
        }
        return;
      }
      if (e.shiftKey) {
        e.preventDefault();
        const bookmarks = analysis.bookmarks;
        if (bookmarks.length > 0) {
          const idx = bookmarks.findIndex((b) => b.node === analysis.currentNode);
          if (e.key === 'ArrowUp') {
            const target = idx > 0 ? bookmarks[idx - 1] : bookmarks[bookmarks.length - 1];
            navigateAnalysis(target.node);
          } else if (e.key === 'ArrowDown') {
            const target =
              idx >= 0 && idx < bookmarks.length - 1 ? bookmarks[idx + 1] : bookmarks[0];
            navigateAnalysis(target.node);
          }
        }
        return;
      }
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
        navigateAnalysis(action);
      }
      if (e.key === 'b') {
        const bookmark = analysis.currentNode?.bookmark;
        const isOwner = !bookmark || bookmark.createdBy === displayName;
        if (isOwner) {
          analysis.toggleBookmark(displayName);
          navigateAnalysis();
        }
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
      if (data.game.gamedata) {
        gs.initFromGamedata(data.game.gamedata, resolveViewerColor(data.game.gamedata));
      }
      if (page.url.searchParams.has('analysis') && gs.totalPly > 0) {
        enterAnalysis();
      }
      if (gs.mySign === null) {
        if (blackName === displayName) gs.mySign = 1;
        else if (whiteName === displayName) gs.mySign = -1;
      }
      chatMessages = data.chat ?? [];

      const ogsToken = data.game.ogsGameId ? getOgsToken() : null;
      gameSocket.join(currentGameId, data.viewerColor ?? null, ogsToken, displayName);
      connectReview();

      const prefix = /** @type {`game/${string}/`} */ (`game/${currentGameId}/`);

      gameSocket.on(`${prefix}gamedata`, (gamedata) => {
        gs.initFromGamedata(gamedata, resolveViewerColor(gamedata));
        blackName = gamedata.players?.black?.username ?? blackName;
        whiteName = gamedata.players?.white?.username ?? whiteName;
        komi = gamedata.komi ?? komi;
        if (page.url.searchParams.has('analysis') && !analysis) {
          enterAnalysis();
        }
        maybeTriggerAiMove();
      });

      gameSocket.on(`${prefix}move`, (moveEvent) => {
        const [x, y] = moveEvent.move;
        if (x < 0) {
          gs.recordPass();
        } else {
          gs.applyMove(x, y, gs.currentSign);
        }
        maybeTriggerAiMove();
      });

      gameSocket.on(`${prefix}clock`, (clock) => {
        gs.applyClock(clock);
      });

      gameSocket.on(`${prefix}phase`, (phase) => {
        if (phase === 'stone removal') {
          gs.status = 'scoring';
          gs.deadStones = [];
          gs.removedString = '';
          gs.blackApproved = false;
          gs.whiteApproved = false;
        } else if (phase === 'play') {
          gs.status = 'playing';
          gs.consecutivePasses = 0;
          gs.deadStones = [];
          gs.removedString = '';
          gs.blackApproved = false;
          gs.whiteApproved = false;
        } else if (phase === 'finished') {
          gs.status = 'gameover';
        }
      });

      gameSocket.on(`${prefix}removed_stones`, (removal) => {
        if (removal.all_removed === undefined) return;
        gs.removedString = removal.all_removed;
        gs.deadStones = parseSgfCoords(removal.all_removed);
        gs.blackApproved = false;
        gs.whiteApproved = false;
      });

      gameSocket.on(`${prefix}removed_stones_accepted`, (accepted) => {
        if (accepted.phase !== 'finished') return;
        gs.status = 'gameover';
        const blackId = gs.gamedata?.players?.black?.id;
        if (accepted.winner != null && blackId != null) {
          gs.winner = accepted.winner === blackId ? 1 : -1;
          const margin = String(accepted.outcome ?? '').replace(' points', '');
          gs.winnerResult = `${gs.winner === 1 ? 'B' : 'W'}+${margin}`;
        }
      });

      gameSocket.on(`${prefix}chat`, (chatEvent) => {
        const line = 'line' in chatEvent ? chatEvent.line : chatEvent;
        const t = line.date ? line.date * 1000 : null;
        const isDuplicate = t
          ? chatMessages.some((m) => m.t === t)
          : chatMessages.some((m) => m.user === line.username && m.text === line.body);
        if (!isDuplicate) {
          chatMessages.push({ user: line.username, text: line.body, t });
        }
      });

      gameSocket.on('presence', (presence) => {
        if (presence.color === 'black') blackOnline = presence.online;
        else if (presence.color === 'white') whiteOnline = presence.online;
      });

      gameSocket.on('spectators', (event) => {
        spectators = event.names ?? [];
      });

      gameSocket.on('typing', (typing) => {
        if (typing.user === displayName) return;
        clearTimeout(typingTimers.get(typing.user));
        if (typing.isTyping) {
          typingUsers = new Set([...typingUsers, typing.user]);
          typingTimers.set(
            typing.user,
            setTimeout(() => {
              typingUsers = new Set([...typingUsers].filter((u) => u !== typing.user));
            }, 4000)
          );
        } else {
          typingUsers = new Set([...typingUsers].filter((u) => u !== typing.user));
          typingTimers.delete(typing.user);
        }
      });

      const reviewPrefix = /** @type {`review/${string}/`} */ (`review/${currentGameId}/`);

      gameSocket.on(`${reviewPrefix}full_state`, (entries) => {
        if (entries.length === 0) return;
        if (!analysis) enterAnalysis();
        for (const entry of entries) {
          analysis.applyReviewEntry(entry, { follow: true });
        }
      });

      gameSocket.on(`${reviewPrefix}r`, (entry) => {
        if (!analysis) {
          enterAnalysis();
        } else if (analysis.status === 'scoring' || analysis.showEstimate || memorize?.active) {
          pendingReviewEntries.push(entry);
          return;
        }
        analysis.applyReviewEntry(entry, { follow: true });
        analysis.animatedVertex = analysis.currentNode.lastMove ?? null;
      });

      gameSocket.on('request-control', (event) => {
        controlRequest = event.user;
      });

      gameSocket.on('clear-control', () => {
        controlRequest = null;
      });

      if (data.game.gameType === 'ai') {
        initAiEngine();
      }

      document.addEventListener('keydown', handleKeydown);
    });

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      gameSocket.leave();
      if (data.game.gameType === 'ai') {
        dispose();
      }
    };
  });
</script>

{#if showModelPrompt}
  <dialog class="ai-model-dialog" open oncancel={(e) => e.preventDefault()}>
    <h2>{t('AI Model Required')}</h2>
    <p>{t('To play against the AI, download a KataGo ONNX model.')}</p>
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
      ogsGameId={gs.gamedata?.id ?? data.game.ogsGameId}
      ranked={gs.gamedata?.ranked ?? false}
      komi={gs.gamedata?.komi ?? data.game.komi ?? null}
      rules={gs.gamedata?.rules
        ? gs.gamedata.rules[0].toUpperCase() + gs.gamedata.rules.slice(1)
        : null}
      timeControl={gs.gamedata?.time_control
        ? formatOgsClock(gs.gamedata.time_control)
        : formatClock(gs.timeControl)}
      handicap={gs.gamedata?.handicap ?? data.game.handicap ?? 0}
      blackRank={isSpectator && gs.gamedata ? formatOgsRank(gs.gamedata.players?.black) : null}
      whiteRank={isSpectator && gs.gamedata ? formatOgsRank(gs.gamedata.players?.white) : null}
    />
    {#if analysisMode}
      <AnalysisInfo
        blackCaptures={analysis.blackCaptures}
        whiteCaptures={analysis.whiteCaptures}
        currentNode={analysis.currentNode}
        boardSize={gs.boardSize}
        comment={analysis.currentComment}
        onCommentChange={(text) => {
          analysis.setComment(text);
          persistAnalysisTree();
        }}
        isBookmarked={!!analysis.currentBookmark}
        bookmarkName={analysis.currentBookmark?.name ?? ''}
        bookmarkCreatedBy={analysis.currentBookmark?.createdBy ?? ''}
        {displayName}
        onBookmark={() => {
          analysis.toggleBookmark(displayName);
          navigateAnalysis();
        }}
        onBookmarkRename={(name) => {
          analysis.setBookmarkName(name);
          persistAnalysisTree();
        }}
      />
    {/if}
    <GameChat
      {username}
      {gameId}
      gameStatus={gs.status}
      bind:messages={chatMessages}
      bind:inputText={chatInputText}
      viewers={chatViewers}
      initialNote={data.note ?? ''}
      onSend={handleChatSend}
      boardSize={gs.boardSize}
      onCoordHover={(v) => (chatHighlightVertex = v)}
      moveCount={gs.totalPly}
      readOnly={data.game.gameType === 'uploaded'}
      {typingUsers}
    />
  </aside>

  <div class="round__app">
    <div class="round__app__table"></div>

    <div class="round__app__board" class:round__app__board--with-editbar={analysisMode}>
      <div class="round__app__board__inner">
        {#if analysisMode}
          <GoBoard
            signMap={analysis.signMap}
            lastMove={analysis.currentNode?.lastMove}
            animatedVertex={analysis.animatedVertex}
            size={gs.boardSize}
            showCoords={boardSettings.showCoords}
            currentSign={analysis.currentSign}
            childrenMap={memorize?.active ? null : analysis.childrenMap}
            markerMap={memorize?.active ? memorize.markerMap : analysis.markerMap}
            areaMap={analysis.displayAreaMap}
            deadStones={analysis.displayDeadStones}
            highlightVertex={chatHighlightVertex}
            onCtrlClick={handleCtrlClick}
            onVertexClick={(x, y) =>
              memorize?.active ? memorize.click(x, y) : onAnalysisVertexClick(x, y)}
          />
        {:else}
          <GoBoard
            {signMap}
            lastMove={gs.viewLastMove}
            shiftMap={boardSettings.fuzzyPlacement ? gs.viewShiftMap : null}
            animatedVertex={gs.isViewingHistory ? null : gs.animatedVertex}
            size={gs.boardSize}
            {areaMap}
            deadStones={displayDeadStones}
            showCoords={boardSettings.showCoords}
            currentSign={gs.currentSign}
            interactive={isMyTurn || gs.status === 'scoring'}
            highlightVertex={chatHighlightVertex}
            pendingVertex={pendingMove}
            onCtrlClick={handleCtrlClick}
            onVertexClick={!gs.isViewingHistory &&
            (gs.status === 'playing' || gs.status === 'scoring')
              ? onVertexClick
              : null}
          />
        {/if}
      </div>
      {#if analysisMode}
        {#if memorize?.active}
          <div
            class="memorize-bar"
            class:flash-correct={memorize.flash === 'correct'}
            class:flash-wrong={memorize.flash === 'wrong'}
          >
            <span class="memorize-progress">
              {#if memorize.done}
                Done — {memorize.total} moves
              {:else}
                {memorize.index + 1} / {memorize.total}
              {/if}
            </span>
            <div class="memorize-group">
              <span class="memorize-group__label">{t('Play as')}</span>
              <div class="memorize-side">
                {#each [['both', 'Both'], ['black', 'Black'], ['white', 'White']] as [s, label]}
                  <button
                    class="side-btn"
                    class:side-btn--active={memorize.side === s}
                    onclick={() => (memorize.side = s)}>{t(label)}</button
                  >
                {/each}
              </div>
            </div>
            <div class="memorize-group">
              <span class="memorize-group__label">{t('Hint')}</span>
              <div class="memorize-hints">
                <button
                  class="hint-btn"
                  class:hint-btn--active={memorize.activeHint === 'quadrant'}
                  onclick={() => memorize.applyHint('quadrant')}>{t('Quadrant')}</button
                >
                <button
                  class="hint-btn"
                  class:hint-btn--active={memorize.activeHint === 'grid16'}
                  onclick={() => memorize.applyHint('grid16')}>{t('16 moves')}</button
                >
                <button
                  class="hint-btn"
                  class:hint-btn--active={memorize.activeHint === 'grid9'}
                  onclick={() => memorize.applyHint('grid9')}>{t('9 moves')}</button
                >
                <button
                  class="hint-btn"
                  class:hint-btn--active={memorize.activeHint === 'grid4'}
                  onclick={() => memorize.applyHint('grid4')}>{t('4 moves')}</button
                >
              </div>
            </div>
            <button
              class="score-bar__close memorize-bar__close"
              onclick={() => {
                memorize.exit();
                flushPendingAnalysisTree();
              }}>✕</button
            >
          </div>
        {:else if analysis.status === 'scoring' || analysis.showEstimate}
          <div class="score-bar">
            <span class="score-bar__verdict">
              {#if analysis.status === 'scoring' && analysis.score}
                {scoreVerdictShort(analysis.score)}
              {:else if analysis.showEstimate && analysis.estimatedScore}
                {scoreVerdictShort(analysis.estimatedScore)}
              {/if}
            </span>
            <span class="score-bar__label">
              {t(analysis.status === 'scoring' ? 'Remove dead stones' : 'Toggle group status')}
            </span>
            <button class="score-bar__close" onclick={navigateAnalysis}>✕</button>
          </div>
        {:else}
          {#if controlRequest}
            <div class="control-request-bar">
              <span class="control-request-bar__label">{controlRequest} wants to try something</span
              >
              {#if controlRequest === displayName}
                <button class="control-request-bar__btn" onclick={clearControl}>Cancel</button>
              {:else}
                <button class="control-request-bar__btn" onclick={clearControl}>Acknowledge</button>
              {/if}
            </div>
          {/if}
          <EditBar
            tool={analysis.tool}
            onSetTool={(t) => (analysis.tool = t)}
            {controlRequest}
            {displayName}
            onControlToggle={() => (controlRequest ? clearControl() : requestControl())}
          />
        {/if}
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

    <div class="rmoves" class:rmoves--analysis={analysisMode} bind:this={movesAreaEl}>
      {#if analysisMode}
        {#if !memorize?.active && analysis.bookmarks.length > 0}
          <div class="bookmark-list">
            <table class="moves-table">
              <thead>
                <tr>
                  <th class="moves-col-num"></th>
                  <th>Bookmarks</th>
                </tr>
              </thead>
              <tbody>
                {#each analysis.bookmarks as { node, name }, i}
                  <tr>
                    <td class="moves-col-num">{i + 1}.</td>
                    <td>
                      <button
                        class="move-entry"
                        class:active={node === analysis.currentNode}
                        onclick={() => navigateAnalysis(node)}
                        use:scrollActiveIntoView={node === analysis.currentNode}
                      >
                        Move {getNodeMoveNum(node)}: {name ||
                          (node.lastMove ? formatVertex(node.lastMove, gs.boardSize) : 'Start')}
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
        <AnalysisMoves
          analysisMoveRows={analysis.moveRows}
          analysisNode={analysis.currentNode}
          boardSize={gs.boardSize}
          onSelectNode={memorize?.active ? null : navigateAnalysis}
        />
      {:else}
        {#if gs.isViewingHistory}
          <div class="history-indicator">Move {gs.currentViewPly} of {gs.totalPly}</div>
        {:else if isAI && engineLoading}
          <div class="ai-status">{t('Loading AI engine...')}</div>
        {:else if isAI && aiThinking}
          <div class="ai-status">{t('AI is thinking...')}</div>
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

    {#if analysisMode && !memorize?.active}
      <div class="rgraph">
        <GameGraph
          root={analysis.root}
          currentNode={analysis.currentNode}
          version={analysis.version}
          onSelectNode={navigateAnalysis}
          moveNum={currentMoveNum}
        />
      </div>
    {/if}

    <div class="rcontrols">
      {#if analysisMode}
        {#if analysis.status === 'scoring' && analysis.score && !memorize?.active}
          <div class="score-display">
            <span class="color-icon is black text">{analysis.score.blackArea}</span>
            <span class="color-icon is white text">
              {analysis.score.whiteArea} + {komi} = {analysis.score.whiteScore.toFixed(1)}
            </span>
            <strong>{scoreVerdictShort(analysis.score)}</strong>
          </div>
        {:else if analysis.showEstimate && analysis.estimatedScore && !memorize?.active}
          <div class="score-display">
            <span class="color-icon is black text">{analysis.estimatedScore.blackArea}</span>
            <span class="color-icon is white text">
              {analysis.estimatedScore.whiteArea} + {komi} = {analysis.estimatedScore.whiteScore.toFixed(
                1
              )}
            </span>
            <strong>{scoreVerdictShort(analysis.estimatedScore)}</strong>
          </div>
        {:else}
          <div class="score-display score-display--empty"></div>
        {/if}
        <div class="segmented">
          <button
            class="seg-btn"
            class:seg-btn--active={analysis.status === 'scoring'}
            disabled={memorize?.active}
            onclick={() => {
              analysis.showEstimate = false;
              analysis.status === 'scoring' ? analysis.stopScoring() : analysis.startScoring();
            }}>{t('Score')}</button
          >
          <button
            class="seg-btn"
            class:seg-btn--active={analysis.showEstimate}
            disabled={memorize?.active}
            onclick={() => {
              if (analysis.status === 'scoring') analysis.stopScoring();
              analysis.showEstimate = !analysis.showEstimate;
              flushPendingAnalysisTree();
            }}>{t('Estimate')}</button
          >
        </div>
        <button
          class="button"
          class:button-memorize-active={memorize?.active}
          class:button-metal={!memorize?.active}
          onclick={() => {
            if (memorize?.active) {
              memorize.exit();
              flushPendingAnalysisTree();
            } else {
              if (analysis.status === 'scoring') analysis.stopScoring();
              analysis.showEstimate = false;
              memorize.enter();
            }
          }}>{t('Memorize')}</button
        >
      {:else}
        {#if !isSpectator && (gs.status === 'waiting' || (gs.status === 'playing' && gs.totalPly < 2))}
          <button class="button button-red" onclick={cancel}>{t('Cancel Game')}</button>
        {:else if !isSpectator && gs.status === 'playing'}
          {#if pendingMove && boardSettings.moveConfirmation === 'button'}
            <button class="button button-confirm" onclick={confirmMove}>{t('Confirm move')}</button>
          {:else}
            <button class="button button-metal" onclick={pass} disabled={!isMyTurn}
              >{t('Pass')}</button
            >
          {/if}
          {#if opponentOnline === false && !isCorrGame}
            <button class="button button-red" onclick={forceResign}>{t('Force Resignation')}</button
            >
          {:else}
            <button class="button button-red" onclick={resign}>{t('Resign')}</button>
          {/if}
        {:else if !isSpectator && gs.status === 'scoring'}
          {@const myApproved = myColor === 'black' ? gs.blackApproved : gs.whiteApproved}
          <button
            class="button"
            class:button-metal={!myApproved}
            class:button-green={myApproved}
            onclick={approveScore}
            disabled={myApproved}
          >
            {t(myApproved ? 'Score accepted' : 'Accept score')}
          </button>
          <button class="button button-metal" onclick={resumePlay}>{t('Resume play')}</button>
        {/if}
        {#if gs.status === 'gameover'}
          {#if !analysisMode}
            <button class="button button-green" onclick={enterAnalysis}
              >{t('Analysis board')}</button
            >
          {/if}
        {/if}
      {/if}
    </div>

    {#if memorize?.active}
      <NavigationButtons
        canPrev={memorize.index > 0}
        canNext={!memorize.done}
        onFirst={() => {
          while (memorize.index > 0) memorize.prev();
        }}
        onPrev={() => memorize.prev()}
        onNext={() => memorize.next()}
        onLast={() => {
          while (!memorize.done) memorize.next();
        }}
        menuItems={[
          { label: t('Export SGF'), onclick: downloadSgf },
          { label: t('Open as Kifu'), href: `/kifu/${gameId}` },
          { label: t('Back to game'), onclick: exitAnalysis }
        ]}
      />
    {:else if analysisMode}
      <NavigationButtons
        canPrev={analysis.canGoPrev}
        canNext={analysis.canGoNext}
        onFirst={() => navigateAnalysis('first')}
        onPrev={() => navigateAnalysis('prev')}
        onNext={() => navigateAnalysis('next')}
        onLast={() => navigateAnalysis('last')}
        menuItems={[
          { label: t('Export SGF'), onclick: downloadSgf },
          { label: t('Open as Kifu'), href: `/kifu/${gameId}` },
          { label: t('Open scratch board'), href: `/scratch/${gameId}` },
          { label: t('Share'), onclick: () => (showShareModal = true) },
          { label: t('Reset analysis'), onclick: resetAnalysis },
          { label: t('Back to game'), onclick: exitAnalysis }
        ]}
      />
    {:else if gs.totalPly > 0}
      <NavigationButtons
        canPrev={gs.currentViewPly > 0}
        canNext={gs.currentViewPly < gs.totalPly}
        onFirst={() => gs.jumpFirst()}
        onPrev={() => gs.jumpPrev()}
        onNext={() => gs.jumpNext()}
        onLast={() => gs.jumpLast()}
        menuItems={analysisMode
          ? [
              { label: t('Export SGF'), onclick: downloadSgf },
              { label: 'Open in Kifu', href: `/kifu/${gameId}` },
              { label: 'Back to game', onclick: exitAnalysis }
            ]
          : []}
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

{#if showShareModal}
  <ShareModal url={page.url.href} onClose={() => (showShareModal = false)} />
{/if}

<style>
  .rgraph {
    display: flex;
    flex-direction: column;
  }

  .bookmark-list {
    border-bottom: 1px solid var(--c-border);
    padding: 0.2em 0;
    max-height: 50%;
    overflow-y: auto;
  }
</style>
