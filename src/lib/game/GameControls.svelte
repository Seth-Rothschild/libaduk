<script>
  let {
    status,
    isSpectator,
    isMyTurn,
    isLocal,
    myColor,
    blackApproved,
    whiteApproved,
    opponentOnline = null,
    onPass,
    onResign,
    onForceResign,
    onAbort,
    onApproveScore,
    onApproveBlack,
    onApproveWhite,
    onAnalysis = null
  } = $props();
</script>

{#if !isSpectator && status === 'waiting'}
  <button class="button button-red" onclick={onAbort}>Abort</button>
{:else if !isSpectator && status === 'playing'}
  <button class="button button-metal" onclick={onPass} disabled={!isMyTurn}>Pass</button>
  {#if opponentOnline === false}
    <button class="button button-red" onclick={onForceResign}>Force Resignation</button>
  {:else}
    <button class="button button-red" onclick={onResign}>Resign</button>
  {/if}
{:else if !isSpectator && status === 'scoring'}
  {#if isLocal}
    <button
      class="button"
      class:button-metal={!blackApproved}
      class:button-green={blackApproved}
      onclick={onApproveBlack}
      disabled={blackApproved}
    >
      {blackApproved ? 'Black ✓' : 'Black accepts'}
    </button>
    <button
      class="button"
      class:button-metal={!whiteApproved}
      class:button-green={whiteApproved}
      onclick={onApproveWhite}
      disabled={whiteApproved}
    >
      {whiteApproved ? 'White ✓' : 'White accepts'}
    </button>
  {:else}
    {@const myApproved = myColor === 'black' ? blackApproved : whiteApproved}
    <button
      class="button"
      class:button-metal={!myApproved}
      class:button-green={myApproved}
      onclick={onApproveScore}
      disabled={myApproved}
    >
      {myApproved ? 'Score accepted' : 'Accept score'}
    </button>
  {/if}
{/if}
{#if status === 'gameover' && onAnalysis}
  <button class="button button-green" onclick={onAnalysis}>Analysis board</button>
{/if}
