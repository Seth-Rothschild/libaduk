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

  function formatResult(result) {
    if (!result) return null;
    if (result.endsWith('+R')) return 'by resignation';
    if (result.endsWith('+T')) return 'on time';
    return result;
  }
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
        {winner === 1 ? 'Black' : 'White'} wins{formatResult(winnerResult) ? ` ${formatResult(winnerResult)}` : ''}.
      {:else if winnerResult}
        {winner === mySign ? 'You win!' : 'You lose.'} &mdash; {formatResult(winnerResult)}
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
