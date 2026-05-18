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

  let now = $state(Date.now());

  $effect(() => {
    const id = setInterval(() => {
      now = Date.now();
    }, 100);
    return () => clearInterval(id);
  });

  function clockElapsed(isActive) {
    if (!isActive || !ogsLiveGame.clock?.turnStartedAt) return 0;
    return Math.max(0, now - ogsLiveGame.clock.turnStartedAt);
  }

  function formatClock(time, isActive) {
    if (!time) return '--:--';
    const elapsed = clockElapsed(isActive);
    if (time.inByoYomi) {
      let remaining = time.byoMs - elapsed;
      let periods = time.byoPeriods;
      const step = time.periodMs > 0 ? time.periodMs : time.byoMs;
      while (remaining <= 0 && periods > 1) {
        periods--;
        remaining += step;
      }
      const secs = Math.floor(Math.max(0, remaining) / 1000);
      return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} (${periods})`;
    }
    const mainRemaining = time.mainMs - elapsed;
    if (mainRemaining <= 0 && time.byoPeriods > 0) {
      let remaining = time.byoMs + mainRemaining;
      let periods = time.byoPeriods;
      const step = time.periodMs > 0 ? time.periodMs : time.byoMs;
      while (remaining <= 0 && periods > 1) {
        periods--;
        remaining += step;
      }
      const secs = Math.floor(Math.max(0, remaining) / 1000);
      return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')} (${periods})`;
    }
    const secs = Math.floor(Math.max(0, mainRemaining) / 1000);
    return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  }
</script>

<div class="lobby__top-game">
  <div class="lobby__top-game__player">
    <span class="text"
      >{ogsLiveGame.game.white.username} ({formatOgsRank(ogsLiveGame.game.white)})</span
    >
    <span class="lobby__top-game__clock" class:active={whiteToMove}
      >{formatClock(ogsLiveGame.clock?.white, whiteToMove)}</span
    >
  </div>

  <div class="lobby__top-game__board-wrap">
    <div class="lobby__top-game__board">
      <a href="/tv">
        {#if signMap.length}
          <GoBoard {signMap} {size} {shiftMap} {lastMove} {animatedVertex} interactive={false} />
        {/if}
      </a>
    </div>
  </div>
  <div class="lobby__top-game__player">
    <span class="text"
      >{ogsLiveGame.game.black.username} ({formatOgsRank(ogsLiveGame.game.black)})</span
    >
    <span class="lobby__top-game__clock" class:active={blackToMove}
      >{formatClock(ogsLiveGame.clock?.black, blackToMove)}</span
    >
  </div>
</div>
