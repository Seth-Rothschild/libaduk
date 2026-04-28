<script>
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import GoBoard from '$lib/game/GoBoard.svelte';
  import Clock from '$lib/game/Clock.svelte';
  import PlayerStrip from '$lib/game/PlayerStrip.svelte';
  import GameMeta from '$lib/game/GameMeta.svelte';
  import AnalysisMoves from '$lib/game/AnalysisMoves.svelte';
  import KibbitzChat from '$lib/game/KibbitzChat.svelte';
  import { boardSettings } from '$lib/nav/boardSettings.svelte.js';
  import { getGuestId } from '$lib/state/guestId.js';
  import { getMe } from '$lib/state/user.svelte.js';
  import { computeVertexSize } from '$lib/game/layout.js';
  import { ogsLiveGame } from '$lib/lobby/ogsLiveGame.svelte.js';
  import { formatOgsRank } from '$lib/lobby/ogsSeekGraph.svelte.js';

  const LINGER_MS = 10000;

  let ws = null;
  let activeGameId;
  let lingerTimer = null;

  function clearLingerTimer() {
    if (lingerTimer) {
      clearTimeout(lingerTimer);
      lingerTimer = null;
    }
  }

  const username = $derived(getMe()?.username ?? '');
  const displayName = $derived(username || getGuestId());

  let boardContainerWidth = $state(0);
  let boardContainerHeight = $state(0);
  let chatMessages = $state([]);
  let chatHighlightVertex = $state(null);
  let movesAreaEl = $state(null);

  const boardSize = $derived(ogsLiveGame.game?.width ?? 19);
  const displayBoard = $derived(ogsLiveGame.board);
  const signMap = $derived(displayBoard?.signMap ?? []);
  const vertexSize = $derived(
    computeVertexSize(boardContainerWidth, boardContainerHeight, boardSize)
  );

  function nameWithRank(player) {
    if (!player?.username) return null;
    if (player.rank == null) return player.username;
    return `${player.username} (${formatOgsRank(player)})`;
  }

  const blackLabel = $derived(nameWithRank(ogsLiveGame.game?.black) ?? 'Black');
  const whiteLabel = $derived(nameWithRank(ogsLiveGame.game?.white) ?? 'White');

  const gameResult = $derived(ogsLiveGame.result);
  const gameStatus = $derived(gameResult ? 'gameover' : 'playing');
  const winnerSign = $derived(gameResult?.winner === 'black' ? 1 : -1);

  const blackClock = $derived(ogsLiveGame.clock?.black ?? null);
  const whiteClock = $derived(ogsLiveGame.clock?.white ?? null);
  const blackRunning = $derived(ogsLiveGame.clock?.activeColor === 'black');
  const whiteRunning = $derived(ogsLiveGame.clock?.activeColor === 'white');

  const moveNodes = $derived.by(() =>
    ogsLiveGame.moves.map((m) => ({
      lastMove: m.x >= 0 ? [m.x, m.y] : null,
      moveName: undefined,
      children: []
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

  const latestMoveNode = $derived(moveNodes[moveNodes.length - 1] ?? null);

  $effect(() => {
    ogsLiveGame.moves.length;
    if (!movesAreaEl) return;
    const scroller = movesAreaEl.querySelector('.analysis-moves');
    if (scroller) scroller.scrollTop = scroller.scrollHeight;
  });

  function wsSend(msg) {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function handleChatSend(text) {
    wsSend({ type: 'tv-chat', user: displayName, text });
  }

  async function syncToServerGameId(gameId) {
    if (activeGameId !== undefined && gameId === activeGameId) return;
    clearLingerTimer();
    activeGameId = gameId;
    ogsLiveGame.stop();
    await ogsLiveGame.start(gameId ?? null);
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

    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${protocol}://${location.host}/ws`);

    ws.addEventListener('open', () => wsSend({ type: 'tv-join' }));

    ws.addEventListener('message', (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === 'tv-state') {
        chatMessages = msg.chat ?? [];
        syncToServerGameId(msg.gameId);
      } else if (msg.type === 'tv-game') {
        syncToServerGameId(msg.gameId);
      } else if (msg.type === 'tv-chat' && msg.entry) {
        chatMessages.push(msg.entry);
      }
    });

    return () => {
      clearLingerTimer();
      ogsLiveGame.onGameStart = null;
      ogsLiveGame.onGameEnd = null;
      ogsLiveGame.stop();
      activeGameId = undefined;
      if (ws && ws.readyState !== WebSocket.CLOSED) ws.close();
      ws = null;
    };
  });
</script>

<div class="round">
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
    />

    <KibbitzChat
      {username}
      messages={chatMessages}
      onSend={handleChatSend}
      {boardSize}
      onCoordHover={(v) => (chatHighlightVertex = v)}
    />
  </aside>

  <div class="round__app">
    <div class="round__app__table"></div>

    <div
      class="round__app__board"
      bind:clientWidth={boardContainerWidth}
      bind:clientHeight={boardContainerHeight}
    >
      {#if displayBoard}
        <GoBoard
          {signMap}
          lastMove={ogsLiveGame.lastMove}
          shiftMap={boardSettings.fuzzyPlacement ? ogsLiveGame.shiftMap : null}
          animatedVertex={ogsLiveGame.animatedVertex}
          size={boardSize}
          {vertexSize}
          showCoords={boardSettings.showCoords}
          interactive={false}
          onVertexClick={null}
          highlightVertex={chatHighlightVertex}
        />
      {/if}
    </div>

    {#if ogsLiveGame.clock}
      <Clock clockData={whiteClock} running={whiteRunning} position="top" />
    {/if}

    <PlayerStrip color="white" name={whiteLabel} captures={0} position="top" />

    <div class="rmoves rmoves--tv" bind:this={movesAreaEl}>
      <AnalysisMoves
        analysisMoveRows={moveRows}
        analysisNode={latestMoveNode}
        {boardSize}
        onSelectNode={() => {}}
      />
    </div>

    <PlayerStrip color="black" name={blackLabel} captures={0} position="bottom" />

    {#if ogsLiveGame.clock}
      <Clock clockData={blackClock} running={blackRunning} position="bottom" />
    {/if}
  </div>
</div>

<style>
  .rmoves.rmoves--tv {
    padding: 0;
  }
</style>
