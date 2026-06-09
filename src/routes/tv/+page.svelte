<script>
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import Clock from '$lib/game/Clock.svelte';
  import PlayerStrip from '$lib/game/PlayerStrip.svelte';
  import GameMeta from '$lib/game/GameMeta.svelte';
  import AnalysisMoves from '$lib/game/AnalysisMoves.svelte';
  import KibbitzChat from '$lib/game/KibbitzChat.svelte';
  import NavigationButtons from '$lib/game/NavigationButtons.svelte';
  import { boardSettings } from '$lib/nav/boardSettings.svelte.js';
  import { getGuestId } from '$lib/state/guestId.js';
  import { getMe } from '$lib/state/user.svelte.js';
  import { ogsLiveGame } from '$lib/lobby/ogsLiveGame.svelte.js';
  import { formatOgsRank } from '$lib/lobby/ogsSeekGraph.svelte.js';
  import { replayMoves } from '$lib/game/board/board.js';

  const LINGER_MS = 10000;

  let ws = null;
  let activeGameId;
  let lingerTimer = null;
  let reconnectTimer = null;
  let reconnectDelay = 500;
  let disposed = false;
  const MAX_RECONNECT_DELAY = 5000;

  function clearLingerTimer() {
    if (lingerTimer) {
      clearTimeout(lingerTimer);
      lingerTimer = null;
    }
  }

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  const username = $derived(getMe()?.username ?? '');
  const displayName = $derived(username || getGuestId());

  let chatMessages = $state([]);
  let chatViewers = $state([]);
  let chatHighlightVertex = $state(null);
  let chatInputText = $state('');
  let isMobile = $state(false);

  const BANNER_KEY = 'tv-welcome-dismissed';
  let bannerOpen = $state(false);

  function dismissBanner() {
    bannerOpen = false;
    localStorage.setItem(BANNER_KEY, '1');
  }

  function openBanner() {
    bannerOpen = true;
  }

  const coordModeEnabled = $derived(boardSettings.ctrlClickBehavior !== 'nothing');

  function handleCtrlClick(coord) {
    if (boardSettings.ctrlClickBehavior === 'nothing') {
      return;
    } else if (boardSettings.ctrlClickBehavior === 'chat') {
      chatInputText = chatInputText ? chatInputText + ' ' + coord : coord;
    } else if (boardSettings.ctrlClickBehavior === 'clipboard') {
      navigator.clipboard?.writeText(coord);
    }
  }
  let movesAreaEl = $state(null);
  let viewedIndex = $state(null);

  const boardSize = $derived(ogsLiveGame.game?.width ?? 19);
  const isLive = $derived(viewedIndex === null);
  const movesUpToView = $derived(
    ogsLiveGame.moves
      .slice(0, viewedIndex + 1)
      .map((m) => ({ ...m, type: m.x >= 0 ? 'move' : 'pass' }))
  );
  const displayBoard = $derived(
    isLive ? ogsLiveGame.board : replayMoves(movesUpToView, boardSize, ogsLiveGame.initialBoard)
  );
  const displayLastMove = $derived.by(() => {
    if (isLive) return ogsLiveGame.lastMove;
    const m = ogsLiveGame.moves[viewedIndex];
    return m && m.x >= 0 ? [m.x, m.y] : null;
  });
  const signMap = $derived(displayBoard?.signMap ?? []);

  function nameWithRank(player) {
    if (!player?.username) return null;
    if (player.rank == null) return player.username;
    return `${player.username} (${formatOgsRank(player)})`;
  }

  const blackLabel = $derived(nameWithRank(ogsLiveGame.game?.black) ?? 'Black');
  const whiteLabel = $derived(nameWithRank(ogsLiveGame.game?.white) ?? 'White');

  const gameResult = $derived(ogsLiveGame.result);
  const gameStatus = $derived(gameResult ? 'gameover' : 'playing');
  const isStuck = $derived(moveRows.length === 0);
  const winnerSign = $derived(gameResult?.winner === 'black' ? 1 : -1);

  const blackClock = $derived(ogsLiveGame.clock?.black ?? null);
  const whiteClock = $derived(ogsLiveGame.clock?.white ?? null);
  const blackRunning = $derived(!gameResult && ogsLiveGame.clock?.activeColor === 'black');
  const whiteRunning = $derived(!gameResult && ogsLiveGame.clock?.activeColor === 'white');

  const moveNodes = $derived.by(() =>
    ogsLiveGame.moves.map((m, i) => ({
      lastMove: m.x >= 0 ? [m.x, m.y] : null,
      moveName: undefined,
      children: [],
      index: i
    }))
  );

  const moveRows = $derived.by(() => {
    const rows = [];
    for (let i = 0; i < moveNodes.length; i += 2) {
      rows.push({
        moveNum: Math.floor(i / 2) + 1,
        black: moveNodes[i],
        white: i + 1 < moveNodes.length ? moveNodes[i + 1] : null
      });
    }
    return rows;
  });

  const viewedNode = $derived(
    isLive ? (moveNodes[moveNodes.length - 1] ?? null) : (moveNodes[viewedIndex] ?? null)
  );
  const currentIndex = $derived(isLive ? ogsLiveGame.moves.length - 1 : viewedIndex);
  const navCanPrev = $derived(currentIndex > 0);
  const navCanNext = $derived(!isLive);

  function navFirst() {
    viewedIndex = 0;
  }
  function navPrev() {
    viewedIndex = currentIndex - 1;
  }
  function navNext() {
    if (viewedIndex === ogsLiveGame.moves.length - 1) {
      viewedIndex = null;
    } else {
      viewedIndex = viewedIndex + 1;
    }
  }
  function navLast() {
    viewedIndex = null;
  }

  $effect(() => {
    viewedIndex;
    ogsLiveGame.moves.length;
    if (!movesAreaEl) return;
    const scroller = movesAreaEl.querySelector('.analysis-moves');
    if (!scroller) return;
    if (isLive) {
      scroller.scrollTop = scroller.scrollHeight;
      return;
    }
    const active = scroller.querySelector('.move-entry.active');
    if (active) active.scrollIntoView({ block: 'nearest' });
  });

  function handleKeyNav(e) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'ArrowLeft' && navCanPrev) {
      e.preventDefault();
      navPrev();
    } else if (e.key === 'ArrowRight' && navCanNext) {
      e.preventDefault();
      navNext();
    }
  }

  function wsSend(msg) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  function handleChatSend(text) {
    return wsSend({
      type: 'tv-chat',
      user: displayName,
      text,
      moveNumber: ogsLiveGame.moves.length
    });
  }

  async function syncToServerGameId(gameId) {
    if (activeGameId !== undefined && gameId === activeGameId) return;
    clearLingerTimer();
    activeGameId = gameId;
    ogsLiveGame.stop();
    await ogsLiveGame.start(gameId ?? null);
  }

  function connect() {
    if (disposed) return;
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${protocol}://${location.host}/ws`);

    ws.addEventListener('open', () => {
      reconnectDelay = 500;
      wsSend({ type: 'tv-join', name: displayName });
      const game = ogsLiveGame.game;
      if (activeGameId && game) {
        wsSend({
          type: 'tv-set-game',
          gameId: activeGameId,
          blackName: game.black?.username ?? null,
          whiteName: game.white?.username ?? null
        });
      }
    });

    ws.addEventListener('message', (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === 'tv-state') {
        chatMessages = msg.chat ?? [];
        chatViewers = msg.viewers ?? [];
        syncToServerGameId(msg.gameId);
      } else if (msg.type === 'tv-game') {
        syncToServerGameId(msg.gameId);
      } else if (msg.type === 'tv-chat' && msg.entry) {
        chatMessages.push(msg.entry);
      } else if (msg.type === 'tv-viewers') {
        chatViewers = msg.viewers ?? [];
      }
    });

    ws.addEventListener('close', () => {
      if (disposed) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
        connect();
      }, reconnectDelay);
    });
  }

  onMount(() => {
    ogsLiveGame.onGameStart = (game) => {
      activeGameId = game.id;
      wsSend({
        type: 'tv-set-game',
        gameId: game.id,
        blackName: game.black?.username ?? null,
        whiteName: game.white?.username ?? null
      });
    };
    ogsLiveGame.onGameEnd = (gameId) => {
      clearLingerTimer();
      lingerTimer = setTimeout(() => {
        lingerTimer = null;
        wsSend({ type: 'tv-game-ended', gameId });
      }, LINGER_MS);
    };

    bannerOpen = !localStorage.getItem(BANNER_KEY);

    const mq = window.matchMedia('(max-width: 799px)');
    isMobile = mq.matches;
    mq.addEventListener('change', (e) => (isMobile = e.matches));

    disposed = false;
    connect();

    return () => {
      disposed = true;
      clearLingerTimer();
      clearReconnectTimer();
      ogsLiveGame.onGameStart = null;
      ogsLiveGame.onGameEnd = null;
      ogsLiveGame.stop();
      activeGameId = undefined;
      if (ws && ws.readyState !== WebSocket.CLOSED) ws.close();
      ws = null;
    };
  });
</script>

<svelte:window onkeydown={handleKeyNav} />

<div class="round round--tv">
  {#if bannerOpen}
    <div class="tv-banner-backdrop" role="dialog" aria-modal="true" onclick={dismissBanner}>
      <div class="tv-banner" onclick={(e) => e.stopPropagation()}>
        <button class="tv-banner__close-x" onclick={dismissBanner} aria-label="Close">✕</button>
        <h2 class="tv-banner__title">Welcome to the Libaduk TV Chat Room!</h2>
        <p class="tv-banner__body">
          Here you can see a live game from highly ranked players on <a
            href="https://online-go.com/observe-games"
            target="_blank"
            rel="noopener">OGS</a
          >, talk to other Libaduk users, and ask questions about the site. Say hello!
        </p>
        <div class="tv-banner__actions">
          <a href="/about" class="tv-banner__btn tv-banner__btn--secondary">See more</a>
          <button class="tv-banner__btn tv-banner__btn--primary" onclick={dismissBanner}
            >Close</button
          >
        </div>
      </div>
    </div>
  {:else}
    <button
      class="tv-info-btn"
      onclick={openBanner}
      aria-label="Show welcome info"
      title="Show welcome info">ℹ</button
    >
  {/if}

  {#if isMobile}
    <KibbitzChat
      {username}
      messages={chatMessages}
      viewers={chatViewers}
      onSend={handleChatSend}
      {boardSize}
      onCoordHover={(v) => (chatHighlightVertex = v)}
      bind:inputText={chatInputText}
    />
  {/if}

  <aside class="round__side">
    <GameMeta
      {boardSize}
      status={gameStatus}
      winner={gameResult ? winnerSign : null}
      winnerResult={gameResult?.result ?? null}
      mySign={-1}
      isSpectator
      blackName={blackLabel}
      whiteName={whiteLabel}
      gameType="ogs"
      gameUrl={page.url.href}
      ogsGameId={ogsLiveGame.game?.id ?? null}
      ranked={ogsLiveGame.game?.ranked ?? false}
      komi={ogsLiveGame.game?.komi ?? null}
      rules={ogsLiveGame.game?.rules ?? null}
      timeControl={ogsLiveGame.game?.timeControl ?? null}
      handicap={ogsLiveGame.game?.handicap ?? 0}
    />
    {#if !isMobile}
      <KibbitzChat
        {username}
        messages={chatMessages}
        viewers={chatViewers}
        onSend={handleChatSend}
        {boardSize}
        onCoordHover={(v) => (chatHighlightVertex = v)}
        bind:inputText={chatInputText}
      />
    {/if}
  </aside>

  <div class="round__app">
    <div class="round__app__table"></div>

    <div class="round__app__board">
      {#if displayBoard}
        <GoBoard
          {signMap}
          lastMove={displayLastMove}
          shiftMap={boardSettings.fuzzyPlacement ? ogsLiveGame.shiftMap : null}
          animatedVertex={ogsLiveGame.animatedVertex}
          size={boardSize}
          showCoords={boardSettings.showCoords}
          interactive={false}
          onVertexClick={null}
          highlightVertex={chatHighlightVertex}
          onCtrlClick={handleCtrlClick}
          {coordModeEnabled}
        />
      {/if}
    </div>

    {#if ogsLiveGame.clock}
      <Clock
        clockData={whiteClock}
        running={whiteRunning}
        position="top"
        turnStartedAt={ogsLiveGame.clock.turnStartedAt}
      />
    {/if}

    <PlayerStrip color="white" name={whiteLabel} captures={0} position="top" />

    <div class="rmoves rmoves--tv" bind:this={movesAreaEl}>
      <AnalysisMoves
        analysisMoveRows={moveRows}
        analysisNode={viewedNode}
        {boardSize}
        onSelectNode={(node) => (viewedIndex = node.index)}
      />
      <NavigationButtons
        canPrev={navCanPrev}
        canNext={navCanNext}
        onFirst={navFirst}
        onPrev={navPrev}
        onNext={navNext}
        onLast={navLast}
      />
      {#if isStuck}
        <button
          class="find-game-btn"
          onclick={() => wsSend({ type: 'tv-game-ended', gameId: activeGameId })}
        >
          Find new game
        </button>
      {/if}
    </div>

    <PlayerStrip color="black" name={blackLabel} captures={0} position="bottom" />

    {#if ogsLiveGame.clock}
      <Clock
        clockData={blackClock}
        running={blackRunning}
        position="bottom"
        turnStartedAt={ogsLiveGame.clock.turnStartedAt}
      />
    {/if}
  </div>
</div>

<style>
  @media (max-width: 799px) {
    .round--tv {
      display: flex;
      flex-direction: column;
    }
  }

  .rmoves.rmoves--tv {
    padding: 0;
  }

  .tv-banner-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 200;
  }

  .tv-banner {
    position: relative;
    background: var(--c-bg-box);
    border: 2px solid var(--c-secondary);
    border-radius: 6px;
    padding: 2rem 2.5rem;
    max-width: 480px;
    width: 90%;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    color: var(--c-font);
  }

  .tv-banner__close-x {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 28px;
    height: 28px;
    background: var(--c-bg-box);
    border: none;
    border-radius: 50%;
    font-size: 1rem;
    cursor: pointer;
    color: var(--c-font-dim);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tv-banner__close-x:hover {
    background: var(--c-bad);
    color: #fff;
  }

  .tv-banner__title {
    margin: 0 0 0.75rem;
    font-size: 1.1rem;
    color: var(--c-font-clearer);
  }

  .tv-banner__body {
    margin: 0 0 1.25rem;
    line-height: 1.5;
    font-size: 0.95rem;
  }

  .tv-banner__actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
  }

  .tv-banner__btn {
    padding: 0.4rem 1rem;
    border-radius: 4px;
    font-size: 0.9rem;
    cursor: pointer;
    text-decoration: none;
    border: 1px solid transparent;
  }

  .tv-banner__btn--primary {
    background: var(--c-secondary);
    color: #fff;
    border-color: var(--c-secondary);
  }

  .tv-banner__btn--secondary {
    background: none;
    color: var(--c-font);
    border-color: var(--c-border);
  }

  .tv-banner__btn--secondary:hover {
    background: var(--c-bg-zebra);
  }

  .tv-info-btn {
    position: fixed;
    bottom: 1rem;
    right: 1rem;
    z-index: 100;
    background: none;
    color: var(--c-font-dim);
    border: 1px solid var(--c-border);
    border-radius: 50%;
    width: 2rem;
    height: 2rem;
    font-size: 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tv-info-btn:hover {
    color: var(--c-font);
    border-color: var(--c-font-dim);
  }

  .find-game-btn {
    display: block;
    width: 100%;
    padding: 0.5rem;
    margin-top: 0.5rem;
    background: var(--c-accent, #629924);
    color: #fff;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
  }
</style>
