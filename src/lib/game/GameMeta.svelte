<script>
  let {
    boardSize,
    status,
    winner,
    winnerResult,
    mySign,
    isLocal,
    isSpectator,
    blackName,
    whiteName
  } = $props();
</script>

<div class="game__meta">
  <section>
    <div class="game__meta__infos" data-icon="&#xe015;">
      <div class="setup">Casual &bull; {boardSize}&times;{boardSize} &bull; Go</div>
    </div>
    <div class="game__meta__players">
      <div class="player color-icon is black text">{blackName}</div>
      <div class="player color-icon is white text">{whiteName}</div>
    </div>
  </section>
  {#if status === 'gameover'}
    <section class="status">
      {#if isLocal || isSpectator}
        {winner === 1 ? 'Black' : 'White'} wins{winnerResult ? ` — ${winnerResult}` : ''}.
      {:else if winnerResult}
        {winnerResult} &mdash; {winner === mySign ? 'You win!' : 'You lose.'}
      {:else}
        {winner === mySign ? 'You win!' : 'You lose.'}
      {/if}
    </section>
  {/if}
  {#if status === 'abandoned'}
    <section class="status">{isSpectator ? 'A player left.' : 'Opponent left.'}</section>
  {/if}
  {#if status === 'aborted'}
    <section class="status">Game aborted.</section>
  {/if}
</div>
