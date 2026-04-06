<script>
  import GoBoard from '$lib/game/GoBoard.svelte';
  import { ogsLiveGame } from './ogsLiveGame.svelte.js';
  import { formatOgsRank } from './ogsSeekGraph.svelte.js';

  const size = $derived(ogsLiveGame.game?.width ?? 19);
  const signMap = $derived(ogsLiveGame.board?.signMap ?? []);
  const shiftMap = $derived(ogsLiveGame.shiftMap);
  const lastMove = $derived(ogsLiveGame.lastMove);
  const animatedVertex = $derived(ogsLiveGame.animatedVertex);
  const whiteToMove = $derived(ogsLiveGame.clock?.activeColor === 'white');
  const blackToMove = $derived(ogsLiveGame.clock?.activeColor === 'black');

  const vertexSize = 12;
  const boardPx = $derived(Math.round((size + 0.8) * vertexSize));

  let containerEl = $state(null);
  let scale = $state(1);

  $effect(() => {
    if (!containerEl) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      scale = width / boardPx;
    });
    observer.observe(containerEl);
    return () => observer.disconnect();
  });

  function formatClock(time) {
    if (!time) return '--:--';
    if (time.inByoYomi) {
      const secs = Math.floor(time.byoMs / 1000);
      const mins = Math.floor(secs / 60);
      const rem = secs % 60;
      return `${mins}:${String(rem).padStart(2, '0')} (${time.byoPeriods})`;
    }
    const secs = Math.floor(time.mainMs / 1000);
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins}:${String(rem).padStart(2, '0')}`;
  }
</script>

<div class="lobby__top-game">
  <div class="lobby__top-game__player">
    <span class="text"
      >{ogsLiveGame.game.white.username} ({formatOgsRank(ogsLiveGame.game.white.rank)})</span
    >
    <span class="lobby__top-game__clock" class:active={whiteToMove}
      >{formatClock(ogsLiveGame.clock?.white)}</span
    >
  </div>

  <div class="lobby__top-game__board" bind:this={containerEl}>
    <a href="https://online-go.com/game/{ogsLiveGame.game.id}">
      <div
        style="transform: scale({scale}); transform-origin: top left; width: {boardPx}px; height: {boardPx}px;"
      >
        {#if signMap.length}
          <GoBoard
            {signMap}
            {size}
            {vertexSize}
            {shiftMap}
            {lastMove}
            {animatedVertex}
            interactive={false}
          />
        {/if}
      </div>
    </a>
  </div>
  <div class="lobby__top-game__player">
    <span class="text"
      >{ogsLiveGame.game.black.username} ({formatOgsRank(ogsLiveGame.game.black.rank)})</span
    >
    <span class="lobby__top-game__clock" class:active={blackToMove}
      >{formatClock(ogsLiveGame.clock?.black)}</span
    >
  </div>
</div>
